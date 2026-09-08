from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import WKTElement
from geoalchemy2.functions import ST_Distance, ST_DWithin, ST_X, ST_Y
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.logging_config import get_logger
from app.models.db_models import PlaceDB
from app.models.place import (
    PlaceCreate,
    PlaceListResponse,
    PlaceNearbyResponse,
    PlaceOut,
    PlaceUpdate,
    PlaceWithDistance,
)

router = APIRouter(prefix="/api/places")
logger = get_logger(__name__)

PLACE_NOT_FOUND = "Place not found"
METERS_PER_MILE = 1609.34
METERS_PER_KM = 1000.0


def _make_point(lon: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lon} {lat})", srid=4326)


def _place_to_response(place: PlaceDB) -> PlaceOut:
    return PlaceOut(
        id=place.id,
        name=place.name,
        address=place.address,
        lat=place.lat,
        lon=place.lon,
        sport=place.sport,
        description=place.description,
        tags=place.tags,
        created_at=place.created_at,
        updated_at=place.updated_at,
    )


@router.post("", response_model=PlaceOut, status_code=201)
async def create_place(place: PlaceCreate, db: AsyncSession = Depends(get_db)):
    logger.info(f"Creating place: name={place.name} sport={place.sport} lat={place.lat} lon={place.lon}")
    db_place = PlaceDB(
        name=place.name,
        address=place.address,
        sport=place.sport,
        description=place.description,
        tags=place.tags or {},
        location=_make_point(place.lon, place.lat),
    )
    db.add(db_place)
    await db.commit()
    await db.refresh(db_place)

    result = await db.execute(
        select(
            PlaceDB,
            ST_X(PlaceDB.location).label("lon"),
            ST_Y(PlaceDB.location).label("lat"),
        ).where(PlaceDB.id == db_place.id)
    )
    row = result.one()
    db_place.lon = row.lon
    db_place.lat = row.lat
    logger.info(f"Created place: id={db_place.id}")
    return _place_to_response(db_place)


@router.get("", response_model=PlaceListResponse)
async def list_places(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sport: str | None = Query(None),
    search: str | None = Query(None, description="Search places by name"),
    db: AsyncSession = Depends(get_db),
):
    logger.debug(f"Listing places: skip={skip} limit={limit} sport={sport} search={search}")
    query = select(
        PlaceDB,
        ST_X(PlaceDB.location).label("lon"),
        ST_Y(PlaceDB.location).label("lat"),
    )
    if sport:
        query = query.where(PlaceDB.sport == sport.lower())
    if search:
        query = query.where(PlaceDB.name.ilike(f"%{search}%"))
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    places = []
    for row in rows:
        place = row[0]
        place.lon = row.lon
        place.lat = row.lat
        places.append(_place_to_response(place))

    count_query = select(func.count(PlaceDB.id))
    if sport:
        count_query = count_query.where(PlaceDB.sport == sport.lower())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    logger.debug(f"Found {total} places, returning {len(places)}")
    return PlaceListResponse(count=total, results=places)


@router.get("/nearby", response_model=PlaceNearbyResponse)
async def get_nearby_places(
    lat: float = Query(..., ge=-180, le=180),
    lon: float = Query(..., ge=-180, le=180),
    radius_meters: int = Query(5000, ge=100, le=50000),
    sport: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Nearby search: lat={lat} lon={lon} radius={radius_meters}m sport={sport}")
    user_point = _make_point(lon, lat)
    distance_expr = ST_Distance(
        func.ST_Transform(PlaceDB.location, 3857),
        func.ST_Transform(func.ST_GeomFromText(f"POINT({lon} {lat})", 4326), 3857),
    )

    query = (
        select(
            PlaceDB,
            ST_X(PlaceDB.location).label("lon"),
            ST_Y(PlaceDB.location).label("lat"),
            distance_expr.label("distance_meters"),
        )
        .where(ST_DWithin(PlaceDB.location, user_point, radius_meters / 111320.0))
        .order_by(distance_expr)
        .limit(limit)
    )

    if sport:
        query = query.where(PlaceDB.sport == sport.lower())

    result = await db.execute(query)
    rows = result.all()

    places = []
    for row in rows:
        place = row[0]
        distance_m = row.distance_meters or 0
        places.append(
            PlaceWithDistance(
                id=place.id,
                name=place.name,
                address=place.address,
                lat=row.lat,
                lon=row.lon,
                sport=place.sport,
                description=place.description,
                tags=place.tags,
                created_at=place.created_at,
                updated_at=place.updated_at,
                distance_meters=round(distance_m, 2),
                distance_miles=round(distance_m / METERS_PER_MILE, 2),
                distance_km=round(distance_m / METERS_PER_KM, 2),
            )
        )

    logger.info(f"Nearby search found {len(places)} places")
    return PlaceNearbyResponse(count=len(places), results=places)


@router.get("/{place_id}", response_model=PlaceOut)
async def get_place(place_id: int, db: AsyncSession = Depends(get_db)):
    logger.debug(f"Fetching place: id={place_id}")
    result = await db.execute(
        select(
            PlaceDB,
            ST_X(PlaceDB.location).label("lon"),
            ST_Y(PlaceDB.location).label("lat"),
        ).where(PlaceDB.id == place_id)
    )
    row = result.one_or_none()
    if not row:
        logger.warning(f"Place not found: id={place_id}")
        raise HTTPException(status_code=404, detail=PLACE_NOT_FOUND)

    place = row[0]
    place.lon = row.lon
    place.lat = row.lat
    return _place_to_response(place)


@router.put("/{place_id}", response_model=PlaceOut)
async def update_place(
    place_id: int, place_update: PlaceUpdate, db: AsyncSession = Depends(get_db)
):
    logger.info(f"Updating place: id={place_id}")
    result = await db.execute(select(PlaceDB).where(PlaceDB.id == place_id))
    db_place = result.scalar_one_or_none()
    if not db_place:
        logger.warning(f"Place not found for update: id={place_id}")
        raise HTTPException(status_code=404, detail=PLACE_NOT_FOUND)

    update_data = place_update.model_dump(exclude_unset=True)
    lat_updated = "lat" in update_data
    lon_updated = "lon" in update_data

    for field, value in update_data.items():
        if field not in ("lat", "lon"):
            setattr(db_place, field, value)

    if lat_updated or lon_updated:
        current = await db.execute(
            select(ST_X(PlaceDB.location), ST_Y(PlaceDB.location)).where(
                PlaceDB.id == place_id
            )
        )
        current_lon, current_lat = current.one()
        new_lon = update_data.get("lon", current_lon)
        new_lat = update_data.get("lat", current_lat)
        db_place.location = _make_point(new_lon, new_lat)

    await db.commit()
    await db.refresh(db_place)

    result = await db.execute(
        select(
            PlaceDB,
            ST_X(PlaceDB.location).label("lon"),
            ST_Y(PlaceDB.location).label("lat"),
        ).where(PlaceDB.id == db_place.id)
    )
    row = result.one()
    db_place.lon = row.lon
    db_place.lat = row.lat
    logger.info(f"Updated place: id={place_id}")
    return _place_to_response(db_place)


@router.delete("/{place_id}", status_code=204)
async def delete_place(place_id: int, db: AsyncSession = Depends(get_db)):
    logger.info(f"Deleting place: id={place_id}")
    result = await db.execute(select(PlaceDB).where(PlaceDB.id == place_id))
    db_place = result.scalar_one_or_none()
    if not db_place:
        logger.warning(f"Place not found for delete: id={place_id}")
        raise HTTPException(status_code=404, detail=PLACE_NOT_FOUND)

    await db.delete(db_place)
    await db.commit()
    logger.info(f"Deleted place: id={place_id}")
    return None
