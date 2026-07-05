from typing import Optional

from pydantic import BaseModel


class Place(BaseModel):
    name: str
    lat: float
    lon: float
    osm_type: str
    osm_id: int
    sport: Optional[str] = None
    distance_miles: float
    distance_km: float
    tags: dict


class PlacesResponse(BaseModel):
    count: int
    results: list[Place]


class GeocodeResponse(BaseModel):
    lat: float
    lon: float
    display_name: str
