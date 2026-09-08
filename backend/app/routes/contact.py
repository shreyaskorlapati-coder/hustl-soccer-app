import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_user
from app.logging_config import get_logger
from app.models.db_models import UserDB

router = APIRouter(prefix="/api/contact")
logger = get_logger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", SMTP_FROM)


class ContactRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=5000)


class ContactResponse(BaseModel):
    message: str


def _send_contact_email(from_user_email: str, from_user_name: str, subject: str, message: str) -> bool:
    if not SMTP_HOST or not SMTP_USER:
        logger.warning(
            f"[CONTACT] SMTP not configured. Message from {from_user_email}: {subject}"
        )
        return True

    email_subject = f"[Hustl Contact] {subject}"
    body_text = (
        f"Contact form submission from Hustl app:\n\n"
        f"From: {from_user_name} ({from_user_email})\n"
        f"Subject: {subject}\n\n"
        f"Message:\n{message}\n"
    )
    body_html = f"""
    <h2>Contact Form Submission</h2>
    <p><strong>From:</strong> {from_user_name} ({from_user_email})</p>
    <p><strong>Subject:</strong> {subject}</p>
    <hr>
    <p><strong>Message:</strong></p>
    <p style="white-space: pre-wrap;">{message}</p>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = email_subject
    msg["From"] = SMTP_FROM
    msg["To"] = CONTACT_EMAIL
    msg["Reply-To"] = from_user_email
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [CONTACT_EMAIL], msg.as_string())
        logger.info(f"Contact email sent from {from_user_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send contact email from {from_user_email}: {exc}")
        return False


@router.post("", response_model=ContactResponse)
async def send_contact_message(
    request: ContactRequest,
    current_user: Annotated[UserDB, Depends(get_current_user)],
):
    """Send a contact/feedback message from the user."""
    logger.info(f"Contact message from user: id={current_user.id}, subject={request.subject}")

    success = _send_contact_email(
        from_user_email=current_user.email,
        from_user_name=current_user.name,
        subject=request.subject,
        message=request.message,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send message. Please try again later.",
        )

    return ContactResponse(message="Your message has been sent. We'll get back to you soon!")
