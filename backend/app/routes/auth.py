import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.utils import create_access_token, hash_password, verify_password
from app.database import get_db
from app.logging_config import get_logger
from app.models.db_models import PasswordResetTokenDB, UserDB
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    GoogleCallbackRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    SignupRequest,
    UserResponse,
)

logger = get_logger(__name__)

router = APIRouter(prefix="/auth")

GOOGLE_WEB_CLIENT_ID = os.getenv("GOOGLE_WEB_CLIENT_ID", "")
GOOGLE_IOS_CLIENT_ID = os.getenv("GOOGLE_IOS_CLIENT_ID", "")
GOOGLE_ANDROID_CLIENT_ID = os.getenv("GOOGLE_ANDROID_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")

GOOGLE_CLIENT_IDS = [cid for cid in [GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID] if cid]

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_VALID_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
PASSWORD_RESET_EXPIRE_MINUTES = 15


def _send_reset_email(to_email: str, name: str, code: str) -> None:
    """Send a password-reset OTP via SMTP. Skipped when SMTP is not configured."""
    if not SMTP_HOST or not SMTP_USER:
        logger.warning(
            f"[PASSWORD RESET] SMTP not configured. OTP for {to_email}: {code}"
        )
        return

    subject = "Your Hustl password reset code"
    body_text = (
        f"Hi {name},\n\n"
        f"Your password reset code is: {code}\n\n"
        f"It expires in {PASSWORD_RESET_EXPIRE_MINUTES} minutes.\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "— The Hustl Team"
    )
    body_html = f"""
    <p>Hi {name},</p>
    <p>Your password reset code is:</p>
    <h2 style="letter-spacing:8px;font-size:32px;">{code}</h2>
    <p>It expires in <strong>{PASSWORD_RESET_EXPIRE_MINUTES} minutes</strong>.</p>
    <p>If you did not request this, you can safely ignore this email.</p>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        logger.info(f"Password reset email sent to {to_email}")
    except Exception as exc:
        logger.error(f"Failed to send reset email to {to_email}: {exc}")


def _verify_google_id_token(raw_token: str) -> dict:
    """
    Verify a Google id_token against all configured client IDs.

    google_id_token.verify_oauth2_token validates the signature, expiry, and
    issuer.  We pass audience=None and check it ourselves so that a single
    call works for any of our registered client IDs (web, iOS, Android).
    """
    if not GOOGLE_CLIENT_IDS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured on the server.",
        )

    try:
        idinfo = google_id_token.verify_oauth2_token(
            raw_token,
            google_requests.Request(),
            audience=None,
        )
    except ValueError as exc:
        logger.warning(f"Google id_token verification failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google token.",
        ) from exc

    # Normalise: aud can be a string or a list depending on the token type.
    aud = idinfo.get("aud")
    aud_set = set(aud) if isinstance(aud, list) else {aud}
    if not aud_set.intersection(GOOGLE_CLIENT_IDS):
        logger.warning(f"Google token audience mismatch: {aud}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token audience is not recognised.",
        )

    if idinfo.get("iss") not in GOOGLE_VALID_ISSUERS:
        logger.warning(f"Google token invalid issuer: {idinfo.get('iss')}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token issuer is not recognised.",
        )

    return idinfo


def _link_google_to_existing(user: UserDB, google_id: str, picture: str | None) -> None:
    """Attach a Google identity to an existing email-based account."""
    if user.google_id and user.google_id != google_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already linked to a different Google account.",
        )
    user.google_id = google_id
    # Preserve both login paths when the user has a password.
    user.auth_provider = "email+google" if user.password_hash else "google"
    if picture and not user.profile_picture:
        user.profile_picture = picture


async def _upsert_google_user(idinfo: dict, db: AsyncSession) -> UserDB:
    """
    Create or update a user record from a verified Google identity payload.

    - If the google_id already exists → update profile_picture if changed.
    - If the email exists with no google_id linked → link the Google identity
      while preserving the password_hash so email+password login still works.
    - Otherwise → create a new user.
    """
    google_id: str = idinfo["sub"]
    email: str = idinfo.get("email", "").lower()
    name: str = idinfo.get("name") or email.split("@")[0]
    picture: str | None = idinfo.get("picture")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account does not have an email address.",
        )
    if not idinfo.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email address is not verified.",
        )

    # 1. Returning user — look up by google_id.
    result = await db.execute(select(UserDB).where(UserDB.google_id == google_id))
    user = result.scalar_one_or_none()
    if user:
        if picture and user.profile_picture != picture:
            user.profile_picture = picture
        logger.debug(f"Returning Google user: {user.id}")
        await db.commit()
        await db.refresh(user)
        return user

    # 2. Merge — same email, no Google link yet.
    result = await db.execute(select(UserDB).where(UserDB.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        _link_google_to_existing(existing, google_id, picture)
        logger.info(f"Linked Google to existing user: {existing.id}")
        await db.commit()
        await db.refresh(existing)
        return existing

    # 3. Brand-new user via Google.
    user = UserDB(
        email=email,
        name=name,
        google_id=google_id,
        auth_provider="google",
        profile_picture=picture,
        password_hash=None,
    )
    db.add(user)
    logger.info(f"Created new user via Google: {email}")
    await db.commit()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Email / password endpoints
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, db: AsyncSession = Depends(get_db)):
    email_lower = request.email.lower()

    existing = await db.execute(select(UserDB).where(UserDB.email == email_lower))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    new_user = UserDB(
        email=email_lower,
        name=request.name.strip(),
        password_hash=hash_password(request.password),
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(f"New user registered: {new_user.id}")
    return AuthResponse(user=UserResponse.from_db(new_user), token=create_access_token(new_user.id))


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    email_lower = request.email.lower()

    result = await db.execute(select(UserDB).where(UserDB.email == email_lower))
    user = result.scalar_one_or_none()

    # Keep the error message generic to prevent account enumeration.
    if not user or not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    logger.info(f"User logged in: {user.id}")
    return AuthResponse(user=UserResponse.from_db(user), token=create_access_token(user.id))


# ---------------------------------------------------------------------------
# Google OAuth — mobile id_token flow
# ---------------------------------------------------------------------------

@router.post("/google", response_model=AuthResponse)
async def google_auth(request: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate using a Google id_token obtained by the mobile client
    (e.g. via expo-auth-session or @react-native-google-signin/google-signin).

    The client sends the raw id_token; the server verifies it with Google's
    public keys and upserts the user record.
    """
    idinfo = _verify_google_id_token(request.id_token)
    user = await _upsert_google_user(idinfo, db)

    logger.info(f"User authenticated via Google id_token: {user.id}")
    return AuthResponse(user=UserResponse.from_db(user), token=create_access_token(user.id))


# ---------------------------------------------------------------------------
# Google OAuth — web authorization-code flow
# ---------------------------------------------------------------------------

@router.post("/google/callback", response_model=AuthResponse)
async def google_callback(request: GoogleCallbackRequest, db: AsyncSession = Depends(get_db)):
    """
    Exchange a Google authorization code for user info (web / Expo Web flow).

    After the browser completes the Google consent screen, your frontend
    receives a one-time ``code``.  POST it here together with the
    ``redirect_uri`` that was used during the authorization request; the
    server exchanges it with Google, verifies the returned id_token, and
    returns an app-level JWT.

    Required env vars: GOOGLE_WEB_CLIENT_ID, GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI (used as the allowed default; callers may override
    per-request via the ``redirect_uri`` field).
    """
    if not GOOGLE_WEB_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google web authentication is not configured on the server.",
        )

    redirect_uri = request.redirect_uri or GOOGLE_REDIRECT_URI
    if not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri is required.",
        )

    # Exchange the authorization code for tokens.
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": request.code,
                    "client_id": GOOGLE_WEB_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning(f"Google token exchange failed: {exc.response.text}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to exchange Google authorization code.",
            ) from exc
        except httpx.RequestError as exc:
            logger.error(f"Google token exchange network error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not reach Google authentication servers.",
            ) from exc

    token_data = token_resp.json()
    raw_id_token = token_data.get("id_token")

    if not raw_id_token:
        logger.warning("Google token exchange response did not contain an id_token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google did not return an identity token.",
        )

    idinfo = _verify_google_id_token(raw_id_token)
    user = await _upsert_google_user(idinfo, db)

    logger.info(f"User authenticated via Google web callback: {user.id}")
    return AuthResponse(user=UserResponse.from_db(user), token=create_access_token(user.id))


# ---------------------------------------------------------------------------
# Password reset — request OTP
# ---------------------------------------------------------------------------

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Generate a 6-digit OTP and send it to the user's email.

    Always returns 200 with a generic message to prevent account enumeration.
    In development (no SMTP configured) the code is printed to the server log.
    """
    email_lower = request.email.lower()

    result = await db.execute(select(UserDB).where(UserDB.email == email_lower))
    user = result.scalar_one_or_none()

    if user and user.password_hash:
        # Invalidate any existing unused tokens for this user.
        await db.execute(
            delete(PasswordResetTokenDB).where(
                PasswordResetTokenDB.user_id == user.id,
                PasswordResetTokenDB.used.is_(False),
            )
        )

        code = f"{secrets.randbelow(1000000):06d}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)

        token_record = PasswordResetTokenDB(
            user_id=user.id,
            token_hash=hash_password(code),
            expires_at=expires_at,
        )
        db.add(token_record)
        await db.commit()

        _send_reset_email(user.email, user.name, code)
        logger.info(f"Password reset OTP generated for user: {user.id}")

    # Return the same response regardless of whether the email exists.
    return MessageResponse(
        message="If an account with that email exists, a reset code has been sent."
    )


# ---------------------------------------------------------------------------
# Password reset — verify OTP and set new password
# ---------------------------------------------------------------------------

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Validate the OTP and replace the user's password."""
    email_lower = request.email.lower()

    result = await db.execute(select(UserDB).where(UserDB.email == email_lower))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code.",
        )

    now = datetime.now(timezone.utc)
    tokens_result = await db.execute(
        select(PasswordResetTokenDB).where(
            PasswordResetTokenDB.user_id == user.id,
            PasswordResetTokenDB.used.is_(False),
            PasswordResetTokenDB.expires_at > now,
        )
    )
    tokens = tokens_result.scalars().all()

    matched_token = None
    for token in tokens:
        if verify_password(request.code, token.token_hash):
            matched_token = token
            break

    if not matched_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code.",
        )

    matched_token.used = True
    user.password_hash = hash_password(request.new_password)
    await db.commit()

    logger.info(f"Password reset successfully for user: {user.id}")
    return MessageResponse(message="Your password has been reset. You can now log in.")
