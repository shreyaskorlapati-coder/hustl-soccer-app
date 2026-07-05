from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import geocode, places

app = FastAPI(
    title="Nearby Sports Finder API",
    description="Find nearby sports facilities using OpenStreetMap data.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(geocode.router, tags=["geocode"])
app.include_router(places.router, tags=["places"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
