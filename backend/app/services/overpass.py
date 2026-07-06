import asyncio

import httpx

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
USER_AGENT = "SportsFinderApp/1.0 (contact@example.com)"
MAX_RETRIES = 3
TIMEOUT_SECONDS = 25.0


class OverpassError(Exception):
    pass


async def fetch_overpass_data(query: str) -> dict:
    """Executes an Overpass QL query with retry/backoff and endpoint fallback."""
    last_error: Exception | None = None
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "text/plain; charset=utf-8",
    }

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        for attempt in range(1, MAX_RETRIES + 1):
            for endpoint in OVERPASS_ENDPOINTS:
                try:
                    response = await client.post(endpoint, content=query, headers=headers)
                    if response.status_code == 200:
                        return response.json()
                    if response.status_code in (406, 429, 504):
                        last_error = OverpassError(f"{endpoint} returned HTTP {response.status_code}")
                        continue
                    response.raise_for_status()
                except (httpx.HTTPError, ValueError) as exc:
                    last_error = OverpassError(f"{endpoint} failed: {exc}")
                    continue

            await asyncio.sleep(2**attempt)

    raise OverpassError(f"Overpass API request failed after {MAX_RETRIES} attempts: {last_error}")
