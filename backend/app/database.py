import logging
import os

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/soccer_app",
)

# Convert postgresql:// to postgresql+asyncpg:// for async SQLAlchemy
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Disable prepared statements for compatibility with pgbouncer/Supabase pooler
connect_args = {
    "statement_cache_size": 0,
    "prepared_statement_cache_size": 0,
}

# Configure SSL based on connection target
if "localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL:
    # Disable SSL for local Docker postgres (no SSL configured)
    connect_args["ssl"] = False
elif "supabase.co" in DATABASE_URL or "supabase.com" in DATABASE_URL:
    # Supabase requires SSL connections
    import ssl
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = ssl_context

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    connect_args=connect_args,
)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    from app.models.db_models import PlaceDB, UserDB  # noqa: F401

    logger.info("Initializing database...")
    async with engine.begin() as conn:
        logger.debug("Creating PostGIS extension")
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        logger.debug("Creating database tables")
        await conn.run_sync(Base.metadata.create_all)
        logger.debug("Creating spatial index")
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_places_location ON places USING gist (location)")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS idx_places_sport ON places (sport)")
        )
        
        logger.debug("Running migrations")
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'games' AND column_name = 'team_id'
                ) THEN
                    ALTER TABLE games ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
                    CREATE INDEX IF NOT EXISTS idx_games_team_id ON games (team_id);
                END IF;
                
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'games' AND column_name = 'opponent_team_id'
                ) THEN
                    ALTER TABLE games ADD COLUMN opponent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
                    CREATE INDEX IF NOT EXISTS idx_games_opponent_team_id ON games (opponent_team_id);
                END IF;
                
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'games' AND column_name = 'home_score'
                ) THEN
                    ALTER TABLE games ADD COLUMN home_score INTEGER NOT NULL DEFAULT 0;
                END IF;
                
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'games' AND column_name = 'away_score'
                ) THEN
                    ALTER TABLE games ADD COLUMN away_score INTEGER NOT NULL DEFAULT 0;
                END IF;
                
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'phone'
                ) THEN
                    ALTER TABLE users ADD COLUMN phone VARCHAR(20);
                END IF;
                
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'favorite_sports'
                ) THEN
                    ALTER TABLE users ADD COLUMN favorite_sports JSONB DEFAULT '[]'::jsonb;
                END IF;
            END $$;
        """))
    logger.info("Database initialized successfully")


async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
