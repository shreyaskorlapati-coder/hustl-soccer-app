from datetime import datetime
import uuid

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


team_members = Table(
    "team_members",
    Base.metadata,
    Column("team_id", UUID(as_uuid=False), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String(50), nullable=False, default="member"),
    Column("joined_at", DateTime(timezone=True), server_default=func.now()),
)

game_participants = Table(
    "game_participants",
    Base.metadata,
    Column("game_id", UUID(as_uuid=False), ForeignKey("games.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("joined_at", DateTime(timezone=True), server_default=func.now()),
)


class UserDB(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    favorite_sports: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # OAuth fields
    auth_provider: Mapped[str] = mapped_column(String(20), nullable=False, default="email")
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    profile_picture: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    games_created = relationship("GameDB", back_populates="creator", foreign_keys="GameDB.creator_id")
    games_joined = relationship("GameDB", secondary="game_participants", back_populates="participants")
    teams_owned = relationship("TeamDB", back_populates="owner", foreign_keys="TeamDB.owner_id")
    teams = relationship("TeamDB", secondary=team_members, back_populates="members")


class PlaceDB(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sport: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    tags: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class GameDB(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    sport: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(500), nullable=False)
    game_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    players_needed: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    players_joined: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skill_level: Mapped[str] = mapped_column(String(50), nullable=False, default="INTERMEDIATE")
    privacy: Mapped[str] = mapped_column(String(50), nullable=False, default="PUBLIC")
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="OPEN", index=True)
    home_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    away_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    creator_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True
    )
    team_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    opponent_team_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    creator = relationship("UserDB", back_populates="games_created", foreign_keys=[creator_id])
    team = relationship("TeamDB", foreign_keys=[team_id], backref="home_games")
    opponent_team = relationship("TeamDB", foreign_keys=[opponent_team_id], backref="away_games")
    participants = relationship("UserDB", secondary="game_participants", back_populates="games_joined")
    goals = relationship("GoalDB", back_populates="game", cascade="all, delete-orphan")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class GoalDB(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    game_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    team_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scorer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    minute: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    game = relationship("GameDB", back_populates="goals")
    team = relationship("TeamDB")
    scorer = relationship("UserDB")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TeamDB(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sport: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    owner_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True
    )
    owner = relationship("UserDB", back_populates="teams_owned", foreign_keys=[owner_id])
    members = relationship("UserDB", secondary=team_members, back_populates="teams")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


tournament_teams = Table(
    "tournament_teams",
    Base.metadata,
    Column("tournament_id", UUID(as_uuid=False), ForeignKey("tournaments.id", ondelete="CASCADE"), primary_key=True),
    Column("team_id", UUID(as_uuid=False), ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    Column("seed", Integer, nullable=True),
    Column("registered_at", DateTime(timezone=True), server_default=func.now()),
)


class TournamentDB(Base):
    __tablename__ = "tournaments"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sport: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    max_teams: Mapped[int] = mapped_column(Integer, nullable=False, default=16)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="REGISTRATION", index=True)
    current_round: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    organizer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True
    )
    organizer = relationship("UserDB")
    teams = relationship("TeamDB", secondary=tournament_teams, backref="tournaments")
    matches = relationship("TournamentMatchDB", back_populates="tournament", cascade="all, delete-orphan")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TournamentMatchDB(Base):
    __tablename__ = "tournament_matches"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tournament_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round_name: Mapped[str] = mapped_column(String(50), nullable=False)
    match_number: Mapped[int] = mapped_column(Integer, nullable=False)
    
    team1_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    team2_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    team1_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    team2_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    winner_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")
    
    tournament = relationship("TournamentDB", back_populates="matches")
    team1 = relationship("TeamDB", foreign_keys=[team1_id])
    team2 = relationship("TeamDB", foreign_keys=[team2_id])
    winner = relationship("TeamDB", foreign_keys=[winner_id])

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PasswordResetTokenDB(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user = relationship("UserDB", backref="password_reset_tokens")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class DeviceTokenDB(Base):
    __tablename__ = "device_tokens"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    platform: Mapped[str] = mapped_column(String(20), nullable=False)  # ios, android, web
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    user = relationship("UserDB", backref="device_tokens")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class NotificationPreferenceDB(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    
    # Game notifications
    game_reminders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    game_player_joined: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    game_player_left: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    game_cancelled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    game_updated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    # Team notifications
    team_invitations: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    team_member_joined: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    team_member_left: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    # Tournament notifications
    tournament_updates: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tournament_match_reminders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tournament_results: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    
    # Reminder timing (hours before game)
    reminder_hours_before: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    
    user = relationship("UserDB", backref="notification_preferences")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class NotificationDB(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Reference to related entity (game_id, team_id, tournament_id, etc.)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    
    # Additional data as JSON
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    is_pushed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    
    user = relationship("UserDB", backref="notifications")
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
