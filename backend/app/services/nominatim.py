import asyncio
import time

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "SportsFinderApp/1.0 (contact@example.com)"
MIN_REQUEST_INTERVAL = 1.0  # Nominatim usage policy caps requests at 1/sec.

_last_request_time = 0.0
_rate_limit_lock = asyncio.Lock()


class GeocodeError(Exception):
    pass


async def _respect_rate_limit() -> None:
    global _last_request_time
    async with _rate_limit_lock:
        elapsed = time.monotonic() - _last_request_time
        if elapsed < MIN_REQUEST_INTERVAL:
            await asyncio.sleep(MIN_REQUEST_INTERVAL - elapsed)
        _last_request_time = time.monotonic()


async def geocode_location(query: str) -> dict:
    await _respect_rate_limit()

    params = {"q": query, "format": "json", "limit": 1}
    headers = {"User-Agent": USER_AGENT}

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(NOMINATIM_URL, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()

    if not data:
        raise GeocodeError(f"No results found for '{query}'")

    result = data[0]
    return {
        "lat": float(result["lat"]),
        "lon": float(result["lon"]),
        "display_name": result["display_name"],
    }
