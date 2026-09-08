from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Place(BaseModel):
    name: str
    address: Optional[str] = None
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


class PlaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    sport: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    tags: Optional[dict] = None


class PlaceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    sport: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    tags: Optional[dict] = None


class PlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: Optional[str] = None
    lat: float
    lon: float
    sport: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[dict] = None
    created_at: datetime
    updated_at: datetime


class PlaceListResponse(BaseModel):
    count: int
    results: list[PlaceOut]


class PlaceWithDistance(PlaceOut):
    distance_meters: float
    distance_miles: float
    distance_km: float


class PlaceNearbyResponse(BaseModel):
    count: int
    results: list[PlaceWithDistance]
