from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.logging_config import get_logger
from app.models.db_models import TeamDB, UserDB, team_members
from app.services.notifications import notification_service
from app.schemas.notification import NotificationType, ReferenceType
from app.schemas.team import (
    AddMemberRequest,
    TeamCreate,
    TeamDetailOut,
    TeamListResponse,
    TeamMemberInfo,
    TeamOut,
    TeamUpdate,
    OwnerInfo,
)

router = APIRouter(prefix="/api/teams")
logger = get_logger(__name__)

TEAM_NOT_FOUND = "Team not found"


def _team_to_response(team: TeamDB) -> TeamOut:
    return TeamOut(
        id=team.id,
        name=team.name,
        description=team.description,
        sport=team.sport,
        owner=OwnerInfo(id=team.owner.id, name=team.owner.name),
        member_count=len(team.members),
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


def _team_to_detail_response(team: TeamDB) -> TeamDetailOut:
    return TeamDetailOut(
        id=team.id,
        name=team.name,
        description=team.description,
        sport=team.sport,
        owner=OwnerInfo(id=team.owner.id, name=team.owner.name),
        member_count=len(team.members),
        members=[
            TeamMemberInfo(id=m.id, name=m.name, email=m.email, role="member")
            for m in team.members
        ],
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


@router.post("", response_model=TeamDetailOut, status_code=201)
async def create_team(
    team: TeamCreate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Creating team: name={team.name} sport={team.sport} owner={current_user.id}")

    db_team = TeamDB(
        name=team.name,
        description=team.description,
        sport=team.sport.value,
        owner_id=current_user.id,
    )

    db.add(db_team)
    await db.commit()
    await db.refresh(db_team, attribute_names=["owner", "members"])

    await db.execute(
        insert(team_members).values(
            team_id=db_team.id,
            user_id=current_user.id,
            role="owner",
        )
    )
    await db.commit()
    await db.refresh(db_team, attribute_names=["owner", "members"])

    logger.info(f"Created team: id={db_team.id}")
    return _team_to_detail_response(db_team)


@router.get("", response_model=TeamListResponse)
async def list_teams(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sport: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    logger.debug(f"Listing teams: skip={skip} limit={limit} sport={sport}")

    query = select(TeamDB).options(selectinload(TeamDB.owner), selectinload(TeamDB.members))

    if sport:
        query = query.where(TeamDB.sport == sport.lower())

    query = query.order_by(TeamDB.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    teams = result.scalars().all()

    count_query = select(func.count(TeamDB.id))
    if sport:
        count_query = count_query.where(TeamDB.sport == sport.lower())

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    logger.debug(f"Found {total} teams, returning {len(teams)}")
    return TeamListResponse(
        count=total,
        results=[_team_to_response(t) for t in teams],
    )


@router.get("/my-teams", response_model=TeamListResponse)
async def list_my_teams(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all teams the user is a member of (both created and joined)."""
    logger.debug(f"Listing teams for user: {current_user.id}")

    query = (
        select(TeamDB)
        .options(selectinload(TeamDB.owner), selectinload(TeamDB.members))
        .join(team_members, TeamDB.id == team_members.c.team_id)
        .where(team_members.c.user_id == current_user.id)
        .order_by(TeamDB.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    teams = result.scalars().unique().all()

    count_query = (
        select(func.count(TeamDB.id))
        .join(team_members, TeamDB.id == team_members.c.team_id)
        .where(team_members.c.user_id == current_user.id)
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    return TeamListResponse(
        count=total,
        results=[_team_to_response(t) for t in teams],
    )


@router.get("/my-created-teams", response_model=TeamListResponse)
async def list_my_created_teams(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get teams created/owned by the current user."""
    logger.debug(f"Listing teams created by user: {current_user.id}")

    query = (
        select(TeamDB)
        .options(selectinload(TeamDB.owner), selectinload(TeamDB.members))
        .where(TeamDB.owner_id == current_user.id)
        .order_by(TeamDB.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    teams = result.scalars().all()

    count_query = select(func.count(TeamDB.id)).where(TeamDB.owner_id == current_user.id)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    logger.debug(f"Found {total} teams created by user, returning {len(teams)}")
    return TeamListResponse(
        count=total,
        results=[_team_to_response(t) for t in teams],
    )


@router.get("/my-joined-teams", response_model=TeamListResponse)
async def list_my_joined_teams(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get teams the user has joined but does not own."""
    logger.debug(f"Listing teams joined by user: {current_user.id}")

    query = (
        select(TeamDB)
        .options(selectinload(TeamDB.owner), selectinload(TeamDB.members))
        .join(team_members, TeamDB.id == team_members.c.team_id)
        .where(team_members.c.user_id == current_user.id)
        .where(TeamDB.owner_id != current_user.id)
        .order_by(TeamDB.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    teams = result.scalars().unique().all()

    count_query = (
        select(func.count(TeamDB.id))
        .join(team_members, TeamDB.id == team_members.c.team_id)
        .where(team_members.c.user_id == current_user.id)
        .where(TeamDB.owner_id != current_user.id)
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    logger.debug(f"Found {total} teams joined by user, returning {len(teams)}")
    return TeamListResponse(
        count=total,
        results=[_team_to_response(t) for t in teams],
    )


@router.get("/{team_id}", response_model=TeamDetailOut)
async def get_team(team_id: str, db: AsyncSession = Depends(get_db)):
    logger.debug(f"Fetching team: id={team_id}")

    result = await db.execute(
        select(TeamDB)
        .options(selectinload(TeamDB.owner), selectinload(TeamDB.members))
        .where(TeamDB.id == team_id)
    )
    team = result.scalar_one_or_none()

    if not team:
        logger.warning(f"Team not found: id={team_id}")
        raise HTTPException(status_code=404, detail=TEAM_NOT_FOUND)

    return _team_to_detail_response(team)


@router.put("/{team_id}", response_model=TeamOut)
async def update_team(
    team_id: str,
    team_update: TeamUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Updating team: id={team_id} by user={current_user.id}")

    result = await db.execute(
        select(TeamDB)
        .options(selectinload(TeamDB.owner), selectinload(TeamDB.members))
        .where(TeamDB.id == team_id)
    )
    db_team = result.scalar_one_or_none()

    if not db_team:
        logger.warning(f"Team not found for update: id={team_id}")
        raise HTTPException(status_code=404, detail=TEAM_NOT_FOUND)

    if db_team.owner_id != current_user.id:
        logger.warning(f"User {current_user.id} not authorized to update team {team_id}")
        raise HTTPException(status_code=403, detail="Not authorized to update this team")

    update_data = team_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(value, "value"):
            value = value.value
        setattr(db_team, field, value)

    await db.commit()
    await db.refresh(db_team, attribute_names=["owner", "members"])

    logger.info(f"Updated team: id={team_id}")
    return _team_to_response(db_team)


@router.post("/{team_id}/members", response_model=TeamDetailOut)
async def add_member(
    team_id: str,
    member_request: AddMemberRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Adding member to team: team_id={team_id} by user={current_user.id}")

    result = await db.execute(
        select(TeamDB)
        .options(selectinload(TeamDB.owner), selectinload(TeamDB.members))
        .where(TeamDB.id == team_id)
    )
    db_team = result.scalar_one_or_none()

    if not db_team:
        raise HTTPException(status_code=404, detail=TEAM_NOT_FOUND)

    if db_team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add members to this team")

    user_to_add = None
    if member_request.user_id:
        user_result = await db.execute(
            select(UserDB).where(UserDB.id == member_request.user_id)
        )
        user_to_add = user_result.scalar_one_or_none()
    elif member_request.email:
        user_result = await db.execute(
            select(UserDB).where(UserDB.email == member_request.email)
        )
        user_to_add = user_result.scalar_one_or_none()

    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")

    existing_members = [m.id for m in db_team.members]
    if user_to_add.id in existing_members:
        raise HTTPException(status_code=400, detail="User is already a member of this team")

    await db.execute(
        insert(team_members).values(
            team_id=team_id,
            user_id=user_to_add.id,
            role=member_request.role.value,
        )
    )
    await db.commit()
    await db.refresh(db_team, attribute_names=["owner", "members"])

    logger.info(f"Added member {user_to_add.id} to team {team_id}")
    return _team_to_detail_response(db_team)


@router.delete("/{team_id}/members/{user_id}", response_model=TeamDetailOut)
async def remove_member(
    team_id: str,
    user_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Removing member from team: team_id={team_id} user_id={user_id}")

    result = await db.execute(
        select(TeamDB)
        .options(selectinload(TeamDB.owner), selectinload(TeamDB.members))
        .where(TeamDB.id == team_id)
    )
    db_team = result.scalar_one_or_none()

    if not db_team:
        raise HTTPException(status_code=404, detail=TEAM_NOT_FOUND)

    if db_team.owner_id != current_user.id and user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to remove this member")

    if user_id == db_team.owner_id:
        raise HTTPException(status_code=400, detail="Cannot remove the team owner")

    await db.execute(
        team_members.delete().where(
            (team_members.c.team_id == team_id) & (team_members.c.user_id == user_id)
        )
    )
    await db.commit()
    await db.refresh(db_team, attribute_names=["owner", "members"])

    logger.info(f"Removed member {user_id} from team {team_id}")
    return _team_to_detail_response(db_team)


@router.post("/{team_id}/join", response_model=TeamDetailOut)
async def join_team(
    team_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"User {current_user.id} joining team {team_id}")

    result = await db.execute(
        select(TeamDB)
        .options(selectinload(TeamDB.owner), selectinload(TeamDB.members))
        .where(TeamDB.id == team_id)
    )
    db_team = result.scalar_one_or_none()

    if not db_team:
        raise HTTPException(status_code=404, detail=TEAM_NOT_FOUND)

    existing_members = [m.id for m in db_team.members]
    if current_user.id in existing_members:
        raise HTTPException(status_code=400, detail="Already a member of this team")

    await db.execute(
        insert(team_members).values(
            team_id=team_id,
            user_id=current_user.id,
            role="member",
        )
    )
    await db.commit()
    await db.refresh(db_team, attribute_names=["owner", "members"])

    # Notify team owner that someone joined
    await notification_service.create_notification(
        db=db,
        user_id=db_team.owner_id,
        title="New Team Member!",
        body=f"{current_user.name} joined your team {db_team.name}",
        notification_type=NotificationType.TEAM_MEMBER_JOINED,
        reference_type=ReferenceType.TEAM,
        reference_id=team_id,
        data={"member_name": current_user.name, "team_name": db_team.name},
    )
    await db.commit()

    logger.info(f"User {current_user.id} joined team {team_id}")
    return _team_to_detail_response(db_team)


@router.post("/{team_id}/leave", status_code=204)
async def leave_team(
    team_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"User {current_user.id} leaving team {team_id}")

    result = await db.execute(select(TeamDB).where(TeamDB.id == team_id))
    db_team = result.scalar_one_or_none()

    if not db_team:
        raise HTTPException(status_code=404, detail=TEAM_NOT_FOUND)

    if db_team.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Owner cannot leave the team. Transfer ownership or delete the team.")

    await db.execute(
        team_members.delete().where(
            (team_members.c.team_id == team_id) & (team_members.c.user_id == current_user.id)
        )
    )
    await db.commit()

    # Notify team owner that someone left
    await notification_service.create_notification(
        db=db,
        user_id=db_team.owner_id,
        title="Team Member Left",
        body=f"{current_user.name} left your team {db_team.name}",
        notification_type=NotificationType.TEAM_MEMBER_LEFT,
        reference_type=ReferenceType.TEAM,
        reference_id=team_id,
        data={"member_name": current_user.name, "team_name": db_team.name},
    )
    await db.commit()

    logger.info(f"User {current_user.id} left team {team_id}")
    return None


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Deleting team: id={team_id} by user={current_user.id}")

    result = await db.execute(select(TeamDB).where(TeamDB.id == team_id))
    db_team = result.scalar_one_or_none()

    if not db_team:
        logger.warning(f"Team not found for delete: id={team_id}")
        raise HTTPException(status_code=404, detail=TEAM_NOT_FOUND)

    if db_team.owner_id != current_user.id:
        logger.warning(f"User {current_user.id} not authorized to delete team {team_id}")
        raise HTTPException(status_code=403, detail="Not authorized to delete this team")

    await db.execute(
        team_members.delete().where(team_members.c.team_id == team_id)
    )
    await db.delete(db_team)
    await db.commit()

    logger.info(f"Deleted team: id={team_id}")
    return None
