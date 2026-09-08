import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.logging_config import get_logger
from app.models.db_models import TeamDB, TournamentDB, TournamentMatchDB, UserDB, team_members, tournament_teams
from app.services.notifications import notification_service
from app.schemas.notification import NotificationType, ReferenceType
from app.schemas.tournament import (
    MatchOut,
    MatchStatus,
    OrganizerInfo,
    RegisterTeamRequest,
    RoundName,
    SetMatchTeamsRequest,
    TeamInfo,
    TournamentCreate,
    TournamentListResponse,
    TournamentOut,
    TournamentStatus,
    TournamentUpdate,
    UpdateMatchScoreRequest,
)

router = APIRouter(prefix="/api/tournaments")
logger = get_logger(__name__)

TOURNAMENT_NOT_FOUND = "Tournament not found"


def _tournament_to_response(tournament: TournamentDB) -> TournamentOut:
    teams_info = [TeamInfo(id=t.id, name=t.name) for t in tournament.teams] if tournament.teams else []
    
    matches_info = []
    if tournament.matches:
        for m in tournament.matches:
            matches_info.append(MatchOut(
                id=m.id,
                round_name=m.round_name,
                match_number=m.match_number,
                team1=TeamInfo(id=m.team1.id, name=m.team1.name) if m.team1 else None,
                team2=TeamInfo(id=m.team2.id, name=m.team2.name) if m.team2 else None,
                team1_score=m.team1_score,
                team2_score=m.team2_score,
                winner=TeamInfo(id=m.winner.id, name=m.winner.name) if m.winner else None,
                status=m.status,
                created_at=m.created_at,
            ))
    
    return TournamentOut(
        id=tournament.id,
        name=tournament.name,
        sport=tournament.sport,
        description=tournament.description,
        max_teams=tournament.max_teams,
        status=tournament.status,
        current_round=tournament.current_round,
        organizer=OrganizerInfo(id=tournament.organizer.id, name=tournament.organizer.name),
        teams=teams_info,
        team_count=len(teams_info),
        matches=matches_info,
        created_at=tournament.created_at,
        updated_at=tournament.updated_at,
    )


@router.post("", response_model=TournamentOut, status_code=201)
async def create_tournament(
    tournament: TournamentCreate,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Creating tournament: name={tournament.name} by user={current_user.id}")

    db_tournament = TournamentDB(
        name=tournament.name,
        sport=tournament.sport.lower(),
        description=tournament.description,
        max_teams=tournament.max_teams,
        status=TournamentStatus.REGISTRATION.value,
        organizer_id=current_user.id,
    )

    db.add(db_tournament)
    await db.commit()
    await db.refresh(db_tournament, attribute_names=["organizer", "teams", "matches"])

    logger.info(f"Created tournament: id={db_tournament.id}")
    return _tournament_to_response(db_tournament)


@router.get("", response_model=TournamentListResponse)
async def list_tournaments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    sport: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    logger.debug(f"Listing tournaments: skip={skip} limit={limit}")

    query = select(TournamentDB).options(
        selectinload(TournamentDB.organizer),
        selectinload(TournamentDB.teams),
        selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team1),
        selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team2),
        selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.winner),
    )

    if sport:
        query = query.where(TournamentDB.sport == sport.lower())
    if status:
        query = query.where(TournamentDB.status == status)

    count_query = select(func.count(TournamentDB.id))
    if sport:
        count_query = count_query.where(TournamentDB.sport == sport.lower())
    if status:
        count_query = count_query.where(TournamentDB.status == status)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(TournamentDB.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    tournaments = result.scalars().all()

    return TournamentListResponse(
        count=total,
        results=[_tournament_to_response(t) for t in tournaments],
    )


@router.get("/my-tournaments", response_model=TournamentListResponse)
async def list_my_tournaments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.debug(f"Listing tournaments for user: {current_user.id}")

    user_team_ids = select(team_members.c.team_id).where(
        team_members.c.user_id == current_user.id
    )
    participating_tournament_ids = select(tournament_teams.c.tournament_id).where(
        tournament_teams.c.team_id.in_(user_team_ids)
    )
    user_filter = or_(
        TournamentDB.organizer_id == current_user.id,
        TournamentDB.id.in_(participating_tournament_ids),
    )

    query = select(TournamentDB).options(
        selectinload(TournamentDB.organizer),
        selectinload(TournamentDB.teams),
        selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team1),
        selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team2),
        selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.winner),
    ).where(user_filter)

    count_query = select(func.count(TournamentDB.id)).where(user_filter)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(TournamentDB.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    tournaments = result.scalars().all()

    return TournamentListResponse(
        count=total,
        results=[_tournament_to_response(t) for t in tournaments],
    )


@router.get("/{tournament_id}", response_model=TournamentOut)
async def get_tournament(
    tournament_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
            selectinload(TournamentDB.teams),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team1),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team2),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.winner),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail=TOURNAMENT_NOT_FOUND)

    return _tournament_to_response(tournament)


@router.post("/{tournament_id}/register", response_model=TournamentOut)
async def register_team(
    tournament_id: str,
    request: RegisterTeamRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Registering team {request.team_id} to tournament {tournament_id}")

    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
            selectinload(TournamentDB.teams),
            selectinload(TournamentDB.matches),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail=TOURNAMENT_NOT_FOUND)

    if tournament.status != TournamentStatus.REGISTRATION.value:
        raise HTTPException(status_code=400, detail="Tournament registration is closed")

    if len(tournament.teams) >= tournament.max_teams:
        raise HTTPException(status_code=400, detail="Tournament is full")

    team_result = await db.execute(select(TeamDB).where(TeamDB.id == request.team_id))
    team = team_result.scalar_one_or_none()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    if team.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only team owner can register team")

    if team.sport != tournament.sport:
        raise HTTPException(status_code=400, detail=f"Team sport ({team.sport}) doesn't match tournament sport ({tournament.sport})")

    if any(t.id == request.team_id for t in tournament.teams):
        raise HTTPException(status_code=400, detail="Team is already registered")

    await db.execute(
        tournament_teams.insert().values(
            tournament_id=tournament_id,
            team_id=request.team_id,
            seed=len(tournament.teams) + 1,
        )
    )

    await db.commit()

    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
            selectinload(TournamentDB.teams),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team1),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team2),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.winner),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one()

    logger.info(f"Team {request.team_id} registered to tournament {tournament_id}")
    return _tournament_to_response(tournament)


@router.post("/{tournament_id}/generate-bracket", response_model=TournamentOut)
async def generate_bracket(
    tournament_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Generating bracket for tournament {tournament_id}")

    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
            selectinload(TournamentDB.teams),
            selectinload(TournamentDB.matches),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail=TOURNAMENT_NOT_FOUND)

    if tournament.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only organizer can generate bracket")

    if len(tournament.teams) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 teams to generate bracket")

    for match in tournament.matches:
        await db.delete(match)

    teams = list(tournament.teams)
    num_teams = len(teams)
    
    num_rounds = math.ceil(math.log2(num_teams))
    bracket_size = 2 ** num_rounds
    
    total_matches = bracket_size - 1
    
    round_names = []
    if bracket_size == 2:
        round_names = [RoundName.FINAL.value]
    elif bracket_size == 4:
        round_names = [RoundName.SEMIFINALS.value, RoundName.SEMIFINALS.value, RoundName.FINAL.value]
    elif bracket_size == 8:
        round_names = [RoundName.QUARTERFINALS.value] * 4 + [RoundName.SEMIFINALS.value] * 2 + [RoundName.FINAL.value]
    elif bracket_size == 16:
        round_names = [RoundName.ROUND_OF_16.value] * 8 + [RoundName.QUARTERFINALS.value] * 4 + [RoundName.SEMIFINALS.value] * 2 + [RoundName.FINAL.value]
    else:
        round_names = [RoundName.ROUND_OF_32.value] * 16 + [RoundName.ROUND_OF_16.value] * 8 + [RoundName.QUARTERFINALS.value] * 4 + [RoundName.SEMIFINALS.value] * 2 + [RoundName.FINAL.value]

    first_round_matches = bracket_size // 2
    
    for i in range(total_matches):
        team1 = None
        team2 = None
        
        if i < first_round_matches:
            team1_idx = i * 2
            team2_idx = i * 2 + 1
            team1 = teams[team1_idx] if team1_idx < num_teams else None
            team2 = teams[team2_idx] if team2_idx < num_teams else None

        match = TournamentMatchDB(
            tournament_id=tournament_id,
            round_name=round_names[i] if i < len(round_names) else RoundName.FINAL.value,
            match_number=i + 1,
            team1_id=team1.id if team1 else None,
            team2_id=team2.id if team2 else None,
            status=MatchStatus.PENDING.value,
        )
        db.add(match)

    tournament.status = TournamentStatus.IN_PROGRESS.value
    tournament.current_round = round_names[0] if round_names else RoundName.FINAL.value

    await db.commit()

    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
            selectinload(TournamentDB.teams),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team1),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team2),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.winner),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one()

    # Notify all team owners that bracket is generated
    team_owner_ids = [t.owner_id for t in tournament.teams]
    if team_owner_ids:
        await notification_service.notify_users(
            db=db,
            user_ids=team_owner_ids,
            title="Tournament Bracket Generated!",
            body=f"The bracket for {tournament.name} is ready. Check your matchups!",
            notification_type=NotificationType.TOURNAMENT_BRACKET_GENERATED,
            reference_type=ReferenceType.TOURNAMENT,
            reference_id=tournament_id,
            data={"tournament_name": tournament.name},
        )
        await db.commit()

    logger.info(f"Bracket generated for tournament {tournament_id}")
    return _tournament_to_response(tournament)


@router.put("/{tournament_id}/matches/{match_id}/score", response_model=TournamentOut)
async def update_match_score(
    tournament_id: str,
    match_id: str,
    request: UpdateMatchScoreRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Updating match {match_id} score in tournament {tournament_id}")

    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail=TOURNAMENT_NOT_FOUND)

    if tournament.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only organizer can update scores")

    match_result = await db.execute(
        select(TournamentMatchDB).where(
            TournamentMatchDB.id == match_id,
            TournamentMatchDB.tournament_id == tournament_id,
        )
    )
    match = match_result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if not match.team1_id or not match.team2_id:
        raise HTTPException(status_code=400, detail="Both teams must be assigned before updating score")

    match.team1_score = request.team1_score
    match.team2_score = request.team2_score
    match.status = MatchStatus.COMPLETED.value

    if request.team1_score > request.team2_score:
        match.winner_id = match.team1_id
    elif request.team2_score > request.team1_score:
        match.winner_id = match.team2_id

    await db.commit()

    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
            selectinload(TournamentDB.teams),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team1),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team2),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.winner),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one()

    # Get team details for notification
    team1_result = await db.execute(select(TeamDB).where(TeamDB.id == match.team1_id))
    team1 = team1_result.scalar_one_or_none()
    team2_result = await db.execute(select(TeamDB).where(TeamDB.id == match.team2_id))
    team2 = team2_result.scalar_one_or_none()

    # Notify both team owners about the match result
    if team1 and team2:
        team_owner_ids = [team1.owner_id, team2.owner_id]
        winner_name = team1.name if match.winner_id == team1.id else team2.name
        await notification_service.notify_users(
            db=db,
            user_ids=team_owner_ids,
            title="Match Result Posted!",
            body=f"{team1.name} {request.team1_score} - {request.team2_score} {team2.name}. Winner: {winner_name}",
            notification_type=NotificationType.TOURNAMENT_MATCH_RESULT,
            reference_type=ReferenceType.TOURNAMENT,
            reference_id=tournament_id,
            data={
                "tournament_name": tournament.name,
                "team1_name": team1.name,
                "team2_name": team2.name,
                "team1_score": request.team1_score,
                "team2_score": request.team2_score,
                "winner_name": winner_name,
            },
        )
        await db.commit()

    return _tournament_to_response(tournament)


@router.put("/{tournament_id}/matches/{match_id}/teams", response_model=TournamentOut)
async def set_match_teams(
    tournament_id: str,
    match_id: str,
    request: SetMatchTeamsRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Setting teams for match {match_id} in tournament {tournament_id}")

    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
            selectinload(TournamentDB.teams),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail=TOURNAMENT_NOT_FOUND)

    if tournament.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only organizer can set match teams")

    match_result = await db.execute(
        select(TournamentMatchDB).where(
            TournamentMatchDB.id == match_id,
            TournamentMatchDB.tournament_id == tournament_id,
        )
    )
    match = match_result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    registered_team_ids = {t.id for t in tournament.teams}

    if request.team1_id:
        if request.team1_id not in registered_team_ids:
            raise HTTPException(status_code=400, detail="Team 1 is not registered in tournament")
        match.team1_id = request.team1_id

    if request.team2_id:
        if request.team2_id not in registered_team_ids:
            raise HTTPException(status_code=400, detail="Team 2 is not registered in tournament")
        match.team2_id = request.team2_id

    await db.commit()

    result = await db.execute(
        select(TournamentDB).options(
            selectinload(TournamentDB.organizer),
            selectinload(TournamentDB.teams),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team1),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.team2),
            selectinload(TournamentDB.matches).selectinload(TournamentMatchDB.winner),
        ).where(TournamentDB.id == tournament_id)
    )
    tournament = result.scalar_one()

    return _tournament_to_response(tournament)


@router.delete("/{tournament_id}", status_code=204)
async def delete_tournament(
    tournament_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Deleting tournament {tournament_id}")

    result = await db.execute(select(TournamentDB).where(TournamentDB.id == tournament_id))
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail=TOURNAMENT_NOT_FOUND)

    if tournament.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only organizer can delete tournament")

    await db.delete(tournament)
    await db.commit()

    logger.info(f"Deleted tournament {tournament_id}")
    return None
