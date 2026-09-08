from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.logging_config import get_logger
from app.models.db_models import GameDB, GoalDB, TeamDB, UserDB, game_participants, team_members
from app.services.notifications import notification_service
from app.schemas.notification import NotificationType, ReferenceType
from app.schemas.game import (
    GameCreate,
    GameListResponse,
    GameOut,
    GameStatus,
    GameUpdate,
    CreatorInfo,
    TeamInfo,
    GoalInfo,
    GoalCreate,
    ScorerInfo,
)

router = APIRouter(prefix="/api/games")
logger = get_logger(__name__)

GAME_NOT_FOUND = "Game not found"


def _game_to_response(game: GameDB) -> GameOut:
    team_info = None
    if game.team:
        team_info = TeamInfo(id=game.team.id, name=game.team.name)
    
    opponent_team_info = None
    if game.opponent_team:
        opponent_team_info = TeamInfo(id=game.opponent_team.id, name=game.opponent_team.name)
    
    goals_info = []
    if hasattr(game, 'goals') and game.goals:
        for goal in game.goals:
            goals_info.append(GoalInfo(
                id=goal.id,
                team_id=goal.team_id,
                team_name=goal.team.name if goal.team else "Unknown",
                scorer=ScorerInfo(id=goal.scorer.id, name=goal.scorer.name),
                minute=goal.minute,
                created_at=goal.created_at,
            ))
    
    return GameOut(
        id=game.id,
        sport=game.sport,
        location=game.location,
        game_date=game.game_date,
        players_needed=game.players_needed,
        players_joined=game.players_joined,
        skill_level=game.skill_level,
        privacy=game.privacy,
        description=game.description,
        status=game.status,
        home_score=game.home_score if hasattr(game, 'home_score') else 0,
        away_score=game.away_score if hasattr(game, 'away_score') else 0,
        creator=CreatorInfo(id=game.creator.id, name=game.creator.name),
        team=team_info,
        opponent_team=opponent_team_info,
        goals=goals_info,
        created_at=game.created_at,
        updated_at=game.updated_at,
    )


@router.post("", response_model=GameOut, status_code=201)
async def create_game(
    game: GameCreate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(
        f"Creating game: sport={game.sport} location={game.location} "
        f"date={game.game_date} creator={current_user.id}"
    )

    db_game = GameDB(
        sport=game.sport.value,
        location=game.location,
        game_date=game.game_date,
        players_needed=game.players_needed,
        players_joined=1,
        skill_level=game.skill_level.value,
        privacy=game.privacy.value,
        description=game.description,
        status=GameStatus.OPEN.value,
        creator_id=current_user.id,
        team_id=game.team_id,
        opponent_team_id=game.opponent_team_id,
    )

    db.add(db_game)
    await db.flush()

    await db.execute(
        game_participants.insert().values(game_id=db_game.id, user_id=current_user.id)
    )

    await db.commit()

    result = await db.execute(
        select(GameDB).options(
            selectinload(GameDB.creator),
            selectinload(GameDB.team),
            selectinload(GameDB.opponent_team),
            selectinload(GameDB.goals).selectinload(GoalDB.team),
            selectinload(GameDB.goals).selectinload(GoalDB.scorer)
        ).where(GameDB.id == db_game.id)
    )
    db_game = result.scalar_one()

    logger.info(f"Created game: id={db_game.id}")
    return _game_to_response(db_game)


@router.get("", response_model=GameListResponse)
async def list_games(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sport: str | None = Query(None),
    status: str | None = Query(None),
    upcoming_only: bool = Query(False),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Listing games for user {current_user.id}: skip={skip} limit={limit} sport={sport} status={status} upcoming_only={upcoming_only}")

    participated_game_ids = select(game_participants.c.game_id).where(
        game_participants.c.user_id == current_user.id
    )
    user_team_ids = select(team_members.c.team_id).where(
        team_members.c.user_id == current_user.id
    )

    user_filter = or_(
        GameDB.creator_id == current_user.id,
        GameDB.id.in_(participated_game_ids),
        GameDB.team_id.in_(user_team_ids),
        GameDB.opponent_team_id.in_(user_team_ids),
    )

    query = select(GameDB).options(selectinload(GameDB.creator), selectinload(GameDB.team), selectinload(GameDB.opponent_team), selectinload(GameDB.goals).selectinload(GoalDB.team), selectinload(GameDB.goals).selectinload(GoalDB.scorer)).where(user_filter)

    if sport:
        query = query.where(GameDB.sport == sport.lower())
    if status:
        query = query.where(GameDB.status == status.upper())
    if upcoming_only:
        query = query.where(GameDB.game_date >= datetime.now(timezone.utc))

    query = query.order_by(GameDB.game_date.asc()).offset(skip).limit(limit)

    result = await db.execute(query)
    games = result.scalars().all()

    count_query = select(func.count(GameDB.id)).where(user_filter)
    if sport:
        count_query = count_query.where(GameDB.sport == sport.lower())
    if status:
        count_query = count_query.where(GameDB.status == status.upper())
    if upcoming_only:
        count_query = count_query.where(GameDB.game_date >= datetime.now(timezone.utc))

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    logger.info(f"Found {total} games for user {current_user.id}, returning {len(games)}")
    return GameListResponse(
        count=total,
        results=[_game_to_response(g) for g in games],
    )


@router.get("/my-created-games", response_model=GameListResponse)
async def list_my_created_games(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sport: str | None = Query(None),
    status: str | None = Query(None),
    upcoming_only: bool = Query(True),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List games created by the current user."""
    logger.info(
        f"Listing created games for user_id={current_user.id} "
        f"skip={skip} limit={limit} sport={sport} status={status} upcoming_only={upcoming_only}"
    )

    base_filter = GameDB.creator_id == current_user.id

    query = (
        select(GameDB)
        .options(selectinload(GameDB.creator), selectinload(GameDB.team), selectinload(GameDB.opponent_team), selectinload(GameDB.goals).selectinload(GoalDB.team), selectinload(GameDB.goals).selectinload(GoalDB.scorer))
        .where(base_filter)
    )

    count_query = select(func.count(GameDB.id)).where(base_filter)

    if sport:
        query = query.where(GameDB.sport == sport.lower())
        count_query = count_query.where(GameDB.sport == sport.lower())
    if status:
        query = query.where(GameDB.status == status.upper())
        count_query = count_query.where(GameDB.status == status.upper())
    if upcoming_only:
        query = query.where(GameDB.game_date >= datetime.now(timezone.utc))
        count_query = count_query.where(GameDB.game_date >= datetime.now(timezone.utc))

    query = query.order_by(GameDB.game_date.asc()).offset(skip).limit(limit)

    result = await db.execute(query)
    games = result.scalars().all()

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    logger.info(f"Found {total} created games for user_id={current_user.id}, returning {len(games)}")
    return GameListResponse(
        count=total,
        results=[_game_to_response(g) for g in games],
    )


@router.get("/my-joined-games", response_model=GameListResponse)
async def list_my_joined_games(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sport: str | None = Query(None),
    status: str | None = Query(None),
    upcoming_only: bool = Query(True),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List games the user has joined (excluding games they created)."""
    logger.info(
        f"Listing joined games for user_id={current_user.id} "
        f"skip={skip} limit={limit} sport={sport} status={status} upcoming_only={upcoming_only}"
    )

    participated_game_ids = select(game_participants.c.game_id).where(
        game_participants.c.user_id == current_user.id
    )

    base_filters = [
        GameDB.id.in_(participated_game_ids),
        GameDB.creator_id != current_user.id,
    ]

    query = (
        select(GameDB)
        .options(selectinload(GameDB.creator), selectinload(GameDB.team), selectinload(GameDB.opponent_team), selectinload(GameDB.goals).selectinload(GoalDB.team), selectinload(GameDB.goals).selectinload(GoalDB.scorer))
        .where(*base_filters)
    )

    count_query = select(func.count(GameDB.id)).where(*base_filters)

    if sport:
        query = query.where(GameDB.sport == sport.lower())
        count_query = count_query.where(GameDB.sport == sport.lower())
    if status:
        query = query.where(GameDB.status == status.upper())
        count_query = count_query.where(GameDB.status == status.upper())
    if upcoming_only:
        query = query.where(GameDB.game_date >= datetime.now(timezone.utc))
        count_query = count_query.where(GameDB.game_date >= datetime.now(timezone.utc))

    query = query.order_by(GameDB.game_date.asc()).offset(skip).limit(limit)

    result = await db.execute(query)
    games = result.scalars().all()

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    logger.info(f"Found {total} joined games for user_id={current_user.id}, returning {len(games)}")
    return GameListResponse(
        count=total,
        results=[_game_to_response(g) for g in games],
    )


@router.get("/{game_id}", response_model=GameOut)
async def get_game(game_id: str, db: AsyncSession = Depends(get_db)):
    logger.debug(f"Fetching game: id={game_id}")

    result = await db.execute(
        select(GameDB).options(selectinload(GameDB.creator), selectinload(GameDB.team), selectinload(GameDB.opponent_team), selectinload(GameDB.goals).selectinload(GoalDB.team), selectinload(GameDB.goals).selectinload(GoalDB.scorer)).where(GameDB.id == game_id)
    )
    game = result.scalar_one_or_none()

    if not game:
        logger.warning(f"Game not found: id={game_id}")
        raise HTTPException(status_code=404, detail=GAME_NOT_FOUND)

    return _game_to_response(game)


@router.put("/{game_id}", response_model=GameOut)
async def update_game(
    game_id: str,
    game_update: GameUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Updating game: id={game_id} by user={current_user.id}")

    result = await db.execute(
        select(GameDB).options(selectinload(GameDB.creator), selectinload(GameDB.team), selectinload(GameDB.opponent_team), selectinload(GameDB.goals).selectinload(GoalDB.team), selectinload(GameDB.goals).selectinload(GoalDB.scorer)).where(GameDB.id == game_id)
    )
    db_game = result.scalar_one_or_none()

    if not db_game:
        logger.warning(f"Game not found for update: id={game_id}")
        raise HTTPException(status_code=404, detail=GAME_NOT_FOUND)

    if db_game.creator_id != current_user.id:
        logger.warning(f"User {current_user.id} not authorized to update game {game_id}")
        raise HTTPException(status_code=403, detail="Not authorized to update this game")

    update_data = game_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(value, "value"):
            value = value.value
        setattr(db_game, field, value)

    await db.commit()

    # Re-fetch the game with all relationships to avoid MissingGreenlet error
    result = await db.execute(
        select(GameDB)
        .options(
            selectinload(GameDB.creator),
            selectinload(GameDB.team),
            selectinload(GameDB.opponent_team),
            selectinload(GameDB.goals).selectinload(GoalDB.team),
            selectinload(GameDB.goals).selectinload(GoalDB.scorer),
        )
        .where(GameDB.id == game_id)
    )
    db_game = result.scalar_one()

    logger.info(f"Updated game: id={game_id}")
    return _game_to_response(db_game)


@router.post("/{game_id}/join", response_model=GameOut)
async def join_game(
    game_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"User {current_user.id} joining game {game_id}")

    result = await db.execute(
        select(GameDB).options(selectinload(GameDB.creator), selectinload(GameDB.team), selectinload(GameDB.opponent_team), selectinload(GameDB.goals).selectinload(GoalDB.team), selectinload(GameDB.goals).selectinload(GoalDB.scorer)).where(GameDB.id == game_id)
    )
    db_game = result.scalar_one_or_none()

    if not db_game:
        raise HTTPException(status_code=404, detail=GAME_NOT_FOUND)

    if db_game.status != GameStatus.OPEN.value:
        raise HTTPException(status_code=400, detail="Game is not open for joining")

    if db_game.players_joined >= db_game.players_needed:
        raise HTTPException(status_code=400, detail="Game is already full")

    existing = await db.execute(
        select(game_participants).where(
            game_participants.c.game_id == game_id,
            game_participants.c.user_id == current_user.id,
        )
    )
    if existing.first():
        raise HTTPException(status_code=400, detail="You have already joined this game")

    await db.execute(
        game_participants.insert().values(game_id=game_id, user_id=current_user.id)
    )

    db_game.players_joined += 1
    if db_game.players_joined >= db_game.players_needed:
        db_game.status = GameStatus.FULL.value

    await db.commit()
    await db.refresh(db_game, attribute_names=["creator"])

    # Notify game creator that someone joined
    await notification_service.create_notification(
        db=db,
        user_id=db_game.creator_id,
        title="New Player Joined!",
        body=f"{current_user.name} joined your game at {db_game.location}",
        notification_type=NotificationType.GAME_PLAYER_JOINED,
        reference_type=ReferenceType.GAME,
        reference_id=game_id,
        data={"player_name": current_user.name, "game_location": db_game.location},
    )
    
    # If game is now full, notify all participants
    if db_game.status == GameStatus.FULL.value:
        participant_ids = await notification_service.get_game_participants(db, game_id)
        await notification_service.notify_users(
            db=db,
            user_ids=participant_ids,
            title="Game is Full!",
            body=f"Your game at {db_game.location} now has all players needed",
            notification_type=NotificationType.GAME_FULL,
            reference_type=ReferenceType.GAME,
            reference_id=game_id,
            exclude_user_id=current_user.id,
        )
    
    await db.commit()

    logger.info(f"User {current_user.id} joined game {game_id}")
    return _game_to_response(db_game)


@router.post("/{game_id}/leave", response_model=GameOut)
async def leave_game(
    game_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"User {current_user.id} leaving game {game_id}")

    result = await db.execute(
        select(GameDB).options(selectinload(GameDB.creator), selectinload(GameDB.team), selectinload(GameDB.opponent_team), selectinload(GameDB.goals).selectinload(GoalDB.team), selectinload(GameDB.goals).selectinload(GoalDB.scorer)).where(GameDB.id == game_id)
    )
    db_game = result.scalar_one_or_none()

    if not db_game:
        raise HTTPException(status_code=404, detail=GAME_NOT_FOUND)

    if db_game.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="Game creator cannot leave. Delete the game instead.")

    existing = await db.execute(
        select(game_participants).where(
            game_participants.c.game_id == game_id,
            game_participants.c.user_id == current_user.id,
        )
    )
    if not existing.first():
        raise HTTPException(status_code=400, detail="You are not part of this game")

    await db.execute(
        game_participants.delete().where(
            game_participants.c.game_id == game_id,
            game_participants.c.user_id == current_user.id,
        )
    )

    db_game.players_joined -= 1
    if db_game.status == GameStatus.FULL.value and db_game.players_joined < db_game.players_needed:
        db_game.status = GameStatus.OPEN.value

    await db.commit()
    await db.refresh(db_game, attribute_names=["creator"])

    # Notify game creator that someone left
    await notification_service.create_notification(
        db=db,
        user_id=db_game.creator_id,
        title="Player Left Game",
        body=f"{current_user.name} left your game at {db_game.location}",
        notification_type=NotificationType.GAME_PLAYER_LEFT,
        reference_type=ReferenceType.GAME,
        reference_id=game_id,
        data={"player_name": current_user.name, "game_location": db_game.location},
    )
    await db.commit()

    logger.info(f"User {current_user.id} left game {game_id}")
    return _game_to_response(db_game)


@router.post("/{game_id}/goals", response_model=GameOut)
async def add_goal(
    game_id: str,
    goal: GoalCreate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Adding goal to game {game_id} by user {current_user.id}")

    result = await db.execute(
        select(GameDB).options(
            selectinload(GameDB.creator), 
            selectinload(GameDB.team), 
            selectinload(GameDB.opponent_team),
            selectinload(GameDB.goals).selectinload(GoalDB.team),
            selectinload(GameDB.goals).selectinload(GoalDB.scorer)
        ).where(GameDB.id == game_id)
    )
    db_game = result.scalar_one_or_none()

    if not db_game:
        raise HTTPException(status_code=404, detail=GAME_NOT_FOUND)

    if db_game.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only game creator can add goals")

    if goal.team_id not in [db_game.team_id, db_game.opponent_team_id]:
        raise HTTPException(status_code=400, detail="Team is not part of this game")

    db_goal = GoalDB(
        game_id=game_id,
        team_id=goal.team_id,
        scorer_id=goal.scorer_id,
        minute=goal.minute,
    )
    db.add(db_goal)

    if goal.team_id == db_game.team_id:
        db_game.home_score += 1
    else:
        db_game.away_score += 1

    await db.commit()
    
    result = await db.execute(
        select(GameDB).options(
            selectinload(GameDB.creator), 
            selectinload(GameDB.team), 
            selectinload(GameDB.opponent_team),
            selectinload(GameDB.goals).selectinload(GoalDB.team),
            selectinload(GameDB.goals).selectinload(GoalDB.scorer)
        ).where(GameDB.id == game_id)
    )
    db_game = result.scalar_one()

    logger.info(f"Goal added to game {game_id}")
    return _game_to_response(db_game)


@router.delete("/{game_id}/goals/{goal_id}", response_model=GameOut)
async def delete_goal(
    game_id: str,
    goal_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Deleting goal {goal_id} from game {game_id}")

    result = await db.execute(
        select(GameDB).options(
            selectinload(GameDB.creator), 
            selectinload(GameDB.team), 
            selectinload(GameDB.opponent_team),
            selectinload(GameDB.goals).selectinload(GoalDB.team),
            selectinload(GameDB.goals).selectinload(GoalDB.scorer)
        ).where(GameDB.id == game_id)
    )
    db_game = result.scalar_one_or_none()

    if not db_game:
        raise HTTPException(status_code=404, detail=GAME_NOT_FOUND)

    if db_game.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only game creator can delete goals")

    goal_result = await db.execute(select(GoalDB).where(GoalDB.id == goal_id, GoalDB.game_id == game_id))
    db_goal = goal_result.scalar_one_or_none()

    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if db_goal.team_id == db_game.team_id:
        db_game.home_score = max(0, db_game.home_score - 1)
    else:
        db_game.away_score = max(0, db_game.away_score - 1)

    await db.delete(db_goal)
    await db.commit()

    result = await db.execute(
        select(GameDB).options(
            selectinload(GameDB.creator), 
            selectinload(GameDB.team), 
            selectinload(GameDB.opponent_team),
            selectinload(GameDB.goals).selectinload(GoalDB.team),
            selectinload(GameDB.goals).selectinload(GoalDB.scorer)
        ).where(GameDB.id == game_id)
    )
    db_game = result.scalar_one()

    logger.info(f"Goal {goal_id} deleted from game {game_id}")
    return _game_to_response(db_game)


@router.delete("/{game_id}", status_code=204)
async def delete_game(
    game_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Deleting game: id={game_id} by user={current_user.id}")

    result = await db.execute(select(GameDB).where(GameDB.id == game_id))
    db_game = result.scalar_one_or_none()

    if not db_game:
        logger.warning(f"Game not found for delete: id={game_id}")
        raise HTTPException(status_code=404, detail=GAME_NOT_FOUND)

    if db_game.creator_id != current_user.id:
        logger.warning(f"User {current_user.id} not authorized to delete game {game_id}")
        raise HTTPException(status_code=403, detail="Not authorized to delete this game")

    await db.delete(db_game)
    await db.commit()

    logger.info(f"Deleted game: id={game_id}")
    return None
