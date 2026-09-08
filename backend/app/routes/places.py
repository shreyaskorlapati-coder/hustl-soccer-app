import time
import logging

from fastapi import APIRouter, HTTPException, Query

from app.models.place import Place, PlacesResponse
from app.services.overpass import OverpassError, fetch_overpass_data
from app.utils.distance import haversine_km, haversine_miles
from app.utils.osm_query import SUPPORTED_SPORTS, build_overpass_query

router = APIRouter()
logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 300
MAX_RESULTS = 50
_cache: dict[str, tuple[float, list[dict]]] = {}


def _cache_key(lat: float, lon: float, sport: str, radius: int) -> str:
    return f"{round(lat, 3)}:{round(lon, 3)}:{sport}:{radius}"


def _build_address(tags: dict) -> str | None:
    if full_addr := tags.get("addr:full"):
        return full_addr

    parts = []
    if housenumber := tags.get("addr:housenumber"):
        parts.append(housenumber)
    if street := tags.get("addr:street"):
        parts.append(street)
    if city := tags.get("addr:city"):
        parts.append(city)
    if state := tags.get("addr:state"):
        parts.append(state)
    if postcode := tags.get("addr:postcode"):
        parts.append(postcode)

    return ", ".join(parts) if parts else None


def _normalize_elements(elements: list[dict], lat: float, lon: float) -> list[Place]:
    seen_ids: set[tuple[str, int]] = set()
    places: list[Place] = []

    for el in elements:
        osm_id = el.get("id")
        osm_type = el.get("type")
        key = (osm_type, osm_id)
        if key in seen_ids:
            continue
        seen_ids.add(key)

        if osm_type == "node":
            place_lat, place_lon = el.get("lat"), el.get("lon")
        else:
            center = el.get("center") or {}
            place_lat, place_lon = center.get("lat"), center.get("lon")

        if place_lat is None or place_lon is None:
            continue

        tags = el.get("tags", {})
        name = tags.get("name", "Unnamed Facility")

        places.append(
            Place(
                name=name,
                address=_build_address(tags),
                lat=place_lat,
                lon=place_lon,
                osm_type=osm_type,
                osm_id=osm_id,
                sport=tags.get("sport"),
                distance_miles=round(haversine_miles(lat, lon, place_lat, place_lon), 2),
                distance_km=round(haversine_km(lat, lon, place_lat, place_lon), 2),
                tags=tags,
            )
        )

    return places


@router.get("/places", response_model=PlacesResponse)
async def get_places(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    sport: str = Query("general"),
    radius: int = Query(5000, ge=100, le=25000, description="Search radius in meters"),
):
    sport = sport.lower()
    if sport not in SUPPORTED_SPORTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported sport '{sport}'. Supported: {SUPPORTED_SPORTS}",
        )

    key = _cache_key(lat, lon, sport, radius)
    cached = _cache.get(key)
    if cached and (time.time() - cached[0]) < CACHE_TTL_SECONDS:
        elements = cached[1]
    else:
        query = build_overpass_query(sport, lat, lon, radius)
        try:
            data = await fetch_overpass_data(query)
        except OverpassError as exc:
            logger.exception("Overpass lookup failed for sport=%s lat=%s lon=%s radius=%s", sport, lat, lon, radius)
            raise HTTPException(status_code=502, detail=str(exc))
        elements = data.get("elements", [])
        _cache[key] = (time.time(), elements)

    places = _normalize_elements(elements, lat, lon)
    places.sort(key=lambda p: p.distance_miles)
    places = places[:MAX_RESULTS]

    return PlacesResponse(count=len(places), results=places)
