from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Platform(str, Enum):
    IOS = "ios"
    ANDROID = "android"
    WEB = "web"


class NotificationType(str, Enum):
    # Game notifications
    GAME_REMINDER = "game_reminder"
    GAME_PLAYER_JOINED = "game_player_joined"
    GAME_PLAYER_LEFT = "game_player_left"
    GAME_CANCELLED = "game_cancelled"
    GAME_UPDATED = "game_updated"
    GAME_FULL = "game_full"
    
    # Team notifications
    TEAM_INVITATION = "team_invitation"
    TEAM_MEMBER_JOINED = "team_member_joined"
    TEAM_MEMBER_LEFT = "team_member_left"
    
    # Tournament notifications
    TOURNAMENT_REGISTRATION_OPEN = "tournament_registration_open"
    TOURNAMENT_BRACKET_GENERATED = "tournament_bracket_generated"
    TOURNAMENT_MATCH_REMINDER = "tournament_match_reminder"
    TOURNAMENT_MATCH_RESULT = "tournament_match_result"
    TOURNAMENT_COMPLETED = "tournament_completed"


class ReferenceType(str, Enum):
    GAME = "game"
    TEAM = "team"
    TOURNAMENT = "tournament"
    USER = "user"


# Device Token Schemas
class DeviceTokenRegister(BaseModel):
    token: str = Field(..., min_length=10, max_length=500)
    platform: Platform
    device_name: str | None = Field(None, max_length=255)


class DeviceTokenOut(BaseModel):
    id: str
    token: str
    platform: str
    device_name: str | None
    is_active: bool
    created_at: datetime


# Notification Preference Schemas
class NotificationPreferenceUpdate(BaseModel):
    game_reminders: bool | None = None
    game_player_joined: bool | None = None
    game_player_left: bool | None = None
    game_cancelled: bool | None = None
    game_updated: bool | None = None
    
    team_invitations: bool | None = None
    team_member_joined: bool | None = None
    team_member_left: bool | None = None
    
    tournament_updates: bool | None = None
    tournament_match_reminders: bool | None = None
    tournament_results: bool | None = None
    
    reminder_hours_before: int | None = Field(None, ge=1, le=72)


class NotificationPreferenceOut(BaseModel):
    id: str
    user_id: str
    
    game_reminders: bool
    game_player_joined: bool
    game_player_left: bool
    game_cancelled: bool
    game_updated: bool
    
    team_invitations: bool
    team_member_joined: bool
    team_member_left: bool
    
    tournament_updates: bool
    tournament_match_reminders: bool
    tournament_results: bool
    
    reminder_hours_before: int
    
    created_at: datetime
    updated_at: datetime


# Notification Schemas
class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    notification_type: str
    reference_type: str | None
    reference_id: str | None
    data: dict | None
    is_read: bool
    created_at: datetime
    read_at: datetime | None


class NotificationListResponse(BaseModel):
    count: int
    unread_count: int
    results: list[NotificationOut]


class MarkNotificationsReadRequest(BaseModel):
    notification_ids: list[str] | None = None
    mark_all: bool = False


class NotificationSendRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1, max_length=1000)
    notification_type: NotificationType
    reference_type: ReferenceType | None = None
    reference_id: str | None = None
    data: dict | None = None
    user_ids: list[str]
