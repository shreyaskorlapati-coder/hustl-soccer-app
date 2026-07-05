from fastapi import APIRouter, HTTPException, Query

from app.models.place import GeocodeResponse
from app.services.nominatim import GeocodeError, geocode_location

router = APIRouter()


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode(q: str = Query(..., min_length=1, description="Location text to geocode")):
    try:
        result = await geocode_location(q)
    except GeocodeError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Geocoding service error: {exc}")

    return GeocodeResponse(**result)
