"""
backend/routers/ingest.py
POST /ingest/cyclone-event — Register a new cyclone bulletin.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import CycloneEvent

router = APIRouter()


class TrackPointIn(BaseModel):
    lat: float
    lon: float
    timestamp: datetime


class CycloneEventIn(BaseModel):
    name: str
    source: str         # IMD | JTWC | GDACS
    category: str
    eta: datetime
    track_points: list[TrackPointIn]
    event_id: Optional[str] = None


class CycloneEventOut(BaseModel):
    event_id: str
    name: str
    source: str
    category: str
    eta: datetime
    ingested_at: datetime

    class Config:
        from_attributes = True


@router.post("/cyclone-event", response_model=CycloneEventOut, status_code=201)
async def ingest_cyclone_event(
    payload: CycloneEventIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new cyclone bulletin.
    Idempotent: if event_id already exists, returns the existing record.
    """
    if payload.event_id:
        existing = await db.get(CycloneEvent, payload.event_id)
        if existing:
            return existing

    # Build WKT LineString from track points
    if len(payload.track_points) >= 2:
        coords = " ".join(f"{p.lon} {p.lat}" for p in payload.track_points)
        wkt = f"LINESTRING({coords})"
    else:
        wkt = None

    event = CycloneEvent(
        event_id=payload.event_id or None,  # DB default if None
        name=payload.name,
        source=payload.source,
        category=payload.category,
        eta=payload.eta,
        track_geom=wkt,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event
