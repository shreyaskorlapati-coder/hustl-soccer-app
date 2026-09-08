from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class TeamSport(str, Enum):
    SOCCER = "soccer"
    BASKETBALL = "basketball"
    FOOTBALL = "football"
    VOLLEYBALL = "volleyball"
    BASEBALL = "baseball"
    TENNIS = "tennis"
    OTHER = "other"


class MemberRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class TeamMemberInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: str = "member"


class OwnerInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    sport: TeamSport = TeamSport.SOCCER


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    sport: Optional[TeamSport] = None


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    sport: str
    owner: OwnerInfo
    member_count: int
    created_at: datetime
    updated_at: datetime


class TeamDetailOut(TeamOut):
    members: list[TeamMemberInfo] = []


class TeamListResponse(BaseModel):
    count: int
    results: list[TeamOut]


class AddMemberRequest(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: MemberRole = MemberRole.MEMBER
