import json
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import init_db
from app.logging_config import get_logger, setup_logging
from app.routes import auth, contact, games, geocode, notifications, places, places_crud, teams, tournaments, users

setup_logging()
logger = get_logger(__name__)

SENSITIVE_FIELDS = {"password", "token", "password_hash", "secret", "authorization"}
MAX_BODY_LOG_SIZE = 10000


def sanitize_body(body: dict | list | str) -> dict | list | str:
    if isinstance(body, dict):
        return {
            k: "***REDACTED***" if k.lower() in SENSITIVE_FIELDS else sanitize_body(v)
            for k, v in body.items()
        }
    if isinstance(body, list):
        return [sanitize_body(item) for item in body]
    return body


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application...")
    # Skip DB init for serverless (Vercel) - migrations should be run separately
    if os.getenv("SKIP_DB_INIT", "").lower() != "true":
        await init_db()
    logger.info("Application started successfully")
    yield
    logger.info("Shutting down application...")


app = FastAPI(
    title="Nearby Sports Finder API",
    description="Find nearby sports facilities using OpenStreetMap data.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.perf_counter()
    request_id = f"{int(start_time * 1000)}"

    request_body = None
    if request.method in ("POST", "PUT", "PATCH"):
        try:
            body_bytes = await request.body()
            if body_bytes:
                body_text = body_bytes.decode("utf-8")
                if len(body_text) <= MAX_BODY_LOG_SIZE:
                    try:
                        request_body = sanitize_body(json.loads(body_text))
                    except json.JSONDecodeError:
                        request_body = body_text[:500]
                else:
                    request_body = f"<body too large: {len(body_text)} bytes>"
        except Exception:
            request_body = "<error reading body>"

    query_params = dict(request.query_params) if request.query_params else None

    logger.info(
        f"[{request_id}] --> {request.method} {request.url.path}"
        + (f" query={query_params}" if query_params else "")
        + (f" body={json.dumps(request_body)}" if request_body else "")
    )

    response = await call_next(request)

    response_body = None
    if response.status_code != 204:
        response_body_bytes = b""
        async for chunk in response.body_iterator:
            response_body_bytes += chunk

        if response_body_bytes:
            try:
                body_text = response_body_bytes.decode("utf-8")
                if len(body_text) <= MAX_BODY_LOG_SIZE:
                    try:
                        response_body = sanitize_body(json.loads(body_text))
                    except json.JSONDecodeError:
                        response_body = body_text[:500]
                else:
                    response_body = f"<body too large: {len(body_text)} bytes>"
            except Exception:
                response_body = "<error reading response>"

        response = Response(
            content=response_body_bytes,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    duration_ms = (time.perf_counter() - start_time) * 1000

    logger.info(
        f"[{request_id}] <-- {response.status_code} duration={duration_ms:.2f}ms"
        + (f" body={json.dumps(response_body)}" if response_body else "")
    )

    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, tags=["auth"])
app.include_router(users.router, tags=["users"])
app.include_router(games.router, tags=["games"])
app.include_router(teams.router, tags=["teams"])
app.include_router(tournaments.router, tags=["tournaments"])
app.include_router(geocode.router, tags=["geocode"])
app.include_router(places.router, tags=["places"])
app.include_router(places_crud.router, tags=["places-crud"])
app.include_router(notifications.router, tags=["notifications"])
app.include_router(contact.router, tags=["contact"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
