import asyncio

import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
MAX_RETRIES = 3
TIMEOUT_SECONDS = 25.0


class OverpassError(Exception):
    pass


async def fetch_overpass_data(query: str) -> dict:
    """Executes an Overpass QL query with retry/backoff on rate limiting or gateway timeouts."""
    last_error: Exception | None = None

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = await client.post(OVERPASS_URL, data={"data": query})
                if response.status_code == 200:
                    return response.json()
                if response.status_code in (429, 504):
                    await asyncio.sleep(2**attempt)
                    continue
                response.raise_for_status()
            except httpx.HTTPError as exc:
                last_error = exc
                await asyncio.sleep(2**attempt)

    raise OverpassError(f"Overpass API request failed after {MAX_RETRIES} attempts: {last_error}")
