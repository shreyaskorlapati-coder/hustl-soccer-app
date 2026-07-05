# Sports Finder

Find nearby sports facilities using OpenStreetMap data (Overpass + Nominatim), with a FastAPI backend and a React Native (Expo) frontend. No Google Maps API involved anywhere in the stack.

## Run the backend

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Run the frontend

```
cd frontend
npm install
npx expo start
```

If testing on a physical device, set `extra.apiUrl` in `frontend/app.json` to your machine's LAN IP (e.g. `http://192.168.1.20:8000`) since `localhost` won't resolve from the device.

## API reference

### `GET /geocode?q=Frisco Texas`

```json
{
  "lat": 33.1507,
  "lon": -96.8236,
  "display_name": "Frisco, Collin County, Texas, United States"
}
```

### `GET /places?lat=33.1507&lon=-96.8236&sport=soccer&radius=5000`

```json
{
  "count": 1,
  "results": [
    {
      "name": "Frontier Park Soccer Complex",
      "lat": 33.12,
      "lon": -96.80,
      "osm_type": "way",
      "osm_id": 123456789,
      "sport": "soccer",
      "distance_miles": 3.2,
      "distance_km": 5.15,
      "tags": { "sport": "soccer", "leisure": "pitch", "name": "Frontier Park Soccer Complex" }
    }
  ]
}
```

Supported `sport` values: `soccer`, `basketball`, `tennis`, `baseball`, `volleyball`, `golf`, `swimming`, `general`.

### End-to-end flow

1. Frontend gets the user's GPS coordinates, or geocodes their manual text input via `GET /geocode`.
2. Frontend calls `GET /places` with those coordinates, the selected sport, and radius.
3. Backend builds an Overpass QL query from the sport-to-tag mapping, fetches matching nodes/ways/relations, dedupes them, computes Haversine distance from the user, sorts nearest-first, and caps results at 50.
4. Frontend renders the list (with Directions / View on Map actions) and an OSM-tiled map with pins.
