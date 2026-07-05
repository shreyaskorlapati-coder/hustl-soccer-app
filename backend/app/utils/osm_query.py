from typing import Optional

# Maps a user-facing sport selection to the OSM tags used to query it.
# "general" intentionally has no sport filter -- it matches any pitch/sports_centre.
SPORT_TAG_MAP: dict[str, dict[str, Optional[str]]] = {
    "soccer": {"leisure": "pitch", "sport": "soccer"},
    "basketball": {"leisure": "pitch", "sport": "basketball"},
    "tennis": {"leisure": "pitch", "sport": "tennis"},
    "baseball": {"leisure": "pitch", "sport": "baseball"},
    "volleyball": {"leisure": "pitch", "sport": "volleyball"},
    "golf": {"leisure": "golf_course", "sport": None},
    "swimming": {"leisure": "swimming_pool", "sport": None},
    "general": {"leisure": None, "sport": None},
}

SUPPORTED_SPORTS = list(SPORT_TAG_MAP.keys())


def _tag_filter(key: str, value: Optional[str]) -> str:
    return f'["{key}"="{value}"]' if value else ""


def build_overpass_query(sport: str, lat: float, lon: float, radius: int) -> str:
    """Builds an Overpass QL query for the given sport within `radius` meters of (lat, lon)."""
    sport = sport.lower()
    if sport not in SPORT_TAG_MAP:
        raise ValueError(f"Unsupported sport '{sport}'. Supported: {SUPPORTED_SPORTS}")

    if sport == "general":
        blocks = [
            f'  {el}(around:{radius},{lat},{lon})["leisure"="{leisure_value}"];'
            for leisure_value in ("pitch", "sports_centre")
            for el in ("node", "way", "relation")
        ]
    else:
        tags = SPORT_TAG_MAP[sport]
        leisure_filter = _tag_filter("leisure", tags["leisure"])
        sport_filter = _tag_filter("sport", tags["sport"])
        blocks = [
            f"  {el}(around:{radius},{lat},{lon}){leisure_filter}{sport_filter};"
            for el in ("node", "way", "relation")
        ]

    body = "\n".join(blocks)
    return f"[out:json][timeout:25];\n(\n{body}\n);\nout center tags;"
