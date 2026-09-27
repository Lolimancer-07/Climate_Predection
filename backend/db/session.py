"""
backend/db/session.py
Async SQLAlchemy session factory + PostGIS initialization.
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cyclone:cyclone@localhost:5432/cyclone_platform")
# Convert sync URL to async driver
ASYNC_DB_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(ASYNC_DB_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup (dev mode). Use Alembic in production."""
    try:
        async with engine.begin() as conn:
            # Enable PostGIS extension
            await conn.execute(
                __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS postgis;")
            )
            from backend.db import models  # noqa: F401 — registers all models
            await conn.run_sync(Base.metadata.create_all)
        print("✓ Connected to PostgreSQL + PostGIS database.")
    except Exception as e:
        print(f"⚠️  Database connection skipped ({e}). Running in in-memory / demo mode.")
