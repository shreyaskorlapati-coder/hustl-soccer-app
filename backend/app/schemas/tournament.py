from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TournamentStatus(str, Enum):
    REGISTRATION = "REGISTRATION"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class MatchStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class RoundName(str, Enum):
    ROUND_OF_32 = "R32"
    ROUND_OF_16 = "R16"
    QUARTERFINALS = "QF"
    SEMIFINALS = "SF"
    FINAL = "FINAL"


class TournamentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sport: str = Field(..., min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=1000)
    max_teams: int = Field(default=16, ge=4, le=64)


class TournamentUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    status: TournamentStatus | None = None


class OrganizerInfo(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class TeamInfo(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class MatchOut(BaseModel):
    id: str
    round_name: str
    match_number: int
    team1: TeamInfo | None = None
    team2: TeamInfo | None = None
    team1_score: int | None = None
    team2_score: int | None = None
    winner: TeamInfo | None = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class TournamentOut(BaseModel):
    id: str
    name: str
    sport: str
    description: str | None
    max_teams: int
    status: str
    current_round: str | None
    organizer: OrganizerInfo
    teams: list[TeamInfo] = []
    team_count: int = 0
    matches: list[MatchOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TournamentListResponse(BaseModel):
    count: int
    results: list[TournamentOut]


class RegisterTeamRequest(BaseModel):
    team_id: str


class UpdateMatchScoreRequest(BaseModel):
    team1_score: int = Field(..., ge=0)
    team2_score: int = Field(..., ge=0)


class SetMatchTeamsRequest(BaseModel):
    team1_id: str | None = None
    team2_id: str | None = None
