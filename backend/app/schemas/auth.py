from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    """Payload for the mobile id_token flow (POST /auth/google)."""

    id_token: str = Field(..., min_length=1)


class GoogleCallbackRequest(BaseModel):
    """Payload for the web authorization-code flow (POST /auth/google/callback)."""

    code: str = Field(..., min_length=1, description="One-time authorization code from Google.")
    redirect_uri: str | None = Field(
        None,
        description=(
            "The redirect_uri used during the authorization request. "
            "Falls back to GOOGLE_REDIRECT_URI env var when omitted."
        ),
    )


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: str | None = None
    favorite_sports: list[str] = []
    auth_provider: str = "email"
    profile_picture: str | None = None
    createdAt: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, user) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            phone=user.phone,
            favorite_sports=user.favorite_sports or [],
            auth_provider=getattr(user, 'auth_provider', 'email'),
            profile_picture=getattr(user, 'profile_picture', None),
            createdAt=user.created_at,
        )


class AuthResponse(BaseModel):
    user: UserResponse
    token: str


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    favorite_sports: Optional[list[str]] = None


class UserPasswordUpdate(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class UserListResponse(BaseModel):
    count: int
    results: list[UserResponse]


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(..., min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str
