from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SportType(str, Enum):
    SOCCER = "soccer"
    BASKETBALL = "basketball"
    FOOTBALL = "football"
    BASEBALL = "baseball"
    VOLLEYBALL = "volleyball"
    OTHER = "other"


class SkillLevel(str, Enum):
    BEGINNER = "BEGINNER"
    CASUAL = "CASUAL"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"
    ELITE = "ELITE"


class PrivacyType(str, Enum):
    PUBLIC = "PUBLIC"
    FRIENDS_ONLY = "FRIENDS ONLY"
    PRIVATE = "PRIVATE"


class GameStatus(str, Enum):
    OPEN = "OPEN"
    FULL = "FULL"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class GameCreate(BaseModel):
    sport: SportType
    location: str = Field(..., min_length=1, max_length=500)
    game_date: datetime
    players_needed: int = Field(default=10, ge=2, le=30)
    skill_level: SkillLevel = SkillLevel.INTERMEDIATE
    privacy: PrivacyType = PrivacyType.PUBLIC
    description: str | None = Field(default=None, max_length=1000)
    team_id: str | None = None
    opponent_team_id: str | None = None


class GameUpdate(BaseModel):
    sport: SportType | None = None
    location: str | None = Field(default=None, max_length=500)
    game_date: datetime | None = None
    players_needed: int | None = Field(default=None, ge=2, le=30)
    skill_level: SkillLevel | None = None
    privacy: PrivacyType | None = None
    description: str | None = Field(default=None, max_length=1000)
    status: GameStatus | None = None
    team_id: str | None = None
    opponent_team_id: str | None = None


class CreatorInfo(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class TeamInfo(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class ScorerInfo(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class GoalInfo(BaseModel):
    id: str
    team_id: str
    team_name: str
    scorer: ScorerInfo
    minute: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class GoalCreate(BaseModel):
    team_id: str
    scorer_id: str
    minute: int | None = None


class GameOut(BaseModel):
    id: str
    sport: str
    location: str
    game_date: datetime
    players_needed: int
    players_joined: int
    skill_level: str
    privacy: str
    description: str | None
    status: str
    home_score: int = 0
    away_score: int = 0
    creator: CreatorInfo
    team: TeamInfo | None = None
    opponent_team: TeamInfo | None = None
    goals: list[GoalInfo] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GameListResponse(BaseModel):
    count: int
    results: list[GameOut]
