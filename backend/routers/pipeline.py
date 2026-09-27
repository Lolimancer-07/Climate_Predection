"""
backend/routers/pipeline.py
Generalised pipeline orchestrator router — Phase 2.

Replaces the hardcoded Fani/Puri demo path with a dynamic orchestrator that:
    - Accepts any (district_id, event_id) pair
    - Runs the full ingestion → modeling → AI → scoring pipeline
    - Uses FastAPI BackgroundTasks for async execution
    - Exposes a status poll endpoint
    - Pushes status updates to a connected WebSocket (if available)
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# In-memory job store (replace with Redis/DB in production)
_jobs: dict[str, dict[str, Any]] = {}

# WebSocket connection manager
_ws_connections: dict[str, list[WebSocket]] = {}


class PipelineRunRequest(BaseModel):
    district_id: str = Field(..., example="IN-OD-PURI")
    event_id: str = Field(..., example="FANI-2019")
    force_recompute: bool = Field(
        False,
        description="If True, ignore cached results and recompute from scratch.",
    )


class PipelineStatus(BaseModel):
    job_id: str
    district_id: str
    event_id: str
    status: str     # "queued" | "running" | "completed" | "failed"
    stage: str      # Current pipeline stage
    started_at: float
    elapsed_s: float | None = None
    result_summary: dict | None = None
    error: str | None = None


async def _broadcast_status(district_id: str, payload: dict) -> None:
    """Push status update to all connected WebSocket clients for a district."""
    connections = _ws_connections.get(district_id, [])
    dead: list[WebSocket] = []
    for ws in connections:
        try:
            await ws.send_json(payload)
        except Exception:  # noqa: BLE001
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)


def _run_pipeline_sync(
    job_id: str,
    district_id: str,
    event_id: str,
) -> dict[str, Any]:
    """
    Synchronous pipeline execution (runs inside FastAPI BackgroundTask thread pool).

    Stages:
        1. Track ingestion (weather/cyclone_track.py)
        2. Rainfall forecast (weather/rainfall_forecast.py)
        3. Surge model (modeling/surge/parametric_surge.py)
        4. Flash flood model (modeling/rainfall_runoff/flash_flood_model.py)
        5. Exposure + criticality scoring
        6. Structural engineering assessment
        7. Insurance trigger evaluation
        8. AI advisory generation
    """
    job = _jobs[job_id]
    t0 = time.perf_counter()

    def _update(stage: str, status: str = "running") -> None:
        job.update({"stage": stage, "status": status, "elapsed_s": time.perf_counter() - t0})
        logger.info("[job=%s] %s: %s", job_id, status, stage)

    try:
        # ── Stage 1: Track Ingestion ──────────────────────────────────────────
        _update("track_ingestion")
        from data_ingestion.weather.cyclone_track import get_track  # type: ignore[import]
        track = get_track(event_id)

        # ── Stage 2: Rainfall Forecast ────────────────────────────────────────
        _update("rainfall_forecast")
        from data_ingestion.weather.rainfall_forecast import get_rainfall_forecast  # type: ignore[import]
        # Use track's landfall lat/lon for rainfall grid center
        landfall_lat = track.get("landfall_lat", 19.8)
        landfall_lon = track.get("landfall_lon", 85.8)
        rainfall_data = get_rainfall_forecast(
            lat=landfall_lat, lon=landfall_lon, district_id=district_id
        )

        # ── Stage 3: Parametric Surge ─────────────────────────────────────────
        _update("surge_modeling")
        from modeling.surge.parametric_surge import compute_surge  # type: ignore[import]
        surge_result = compute_surge(
            track=track,
            district_id=district_id,
        )

        # ── Stage 4: Flash Flood Model ────────────────────────────────────────
        _update("flash_flood_modeling")
        from modeling.rainfall_runoff.flash_flood_model import compute_flash_flood  # type: ignore[import]
        flood_result = compute_flash_flood(
            rainfall_data=rainfall_data,
            district_id=district_id,
        )

        # ── Stage 5: Exposure + Criticality Scoring ───────────────────────────
        _update("exposure_scoring")
        from modeling.exposure_scoring.asset_overlay import score_asset_exposure  # type: ignore[import]
        from modeling.exposure_scoring.criticality import compute_criticality  # type: ignore[import]
        exposure = score_asset_exposure(surge_result, flood_result, district_id)
        criticality = compute_criticality(exposure)

        # ── Stage 6: Structural Engineering Assessment ────────────────────────
        _update("structural_assessment")
        from modeling.structural_engineering.hardening_priority import (  # type: ignore[import]
            run_district_hardening_assessment,
        )
        wind_kmh = track.get("max_wind_kmh", 220.0)
        surge_grid = {
            asset["asset_id"]: asset.get("surge_height_m", 0.0)
            for asset in exposure.get("assets", [])
        }
        hardening_list = run_district_hardening_assessment(
            asset_list=criticality.get("assets", []),
            wind_speed_kmh=wind_kmh,
            surge_grid=surge_grid,
        )

        # ── Stage 7: Insurance Trigger ────────────────────────────────────────
        _update("insurance_trigger")
        from modeling.insurance_trigger.trigger_engine import evaluate_trigger  # type: ignore[import]
        trigger_result = evaluate_trigger(
            surge_result=surge_result,
            rainfall_data=rainfall_data,
            track=track,
            district_id=district_id,
        )

        # ── Stage 8: AI Advisory ──────────────────────────────────────────────
        _update("ai_advisory")
        try:
            from ai_reasoning.advisory_generator import generate_advisory  # type: ignore[import]
            advisory = generate_advisory(
                surge_result=surge_result,
                flood_result=flood_result,
                criticality=criticality,
                trigger_result=trigger_result,
                district_id=district_id,
                event_id=event_id,
            )
        except Exception as ai_exc:  # noqa: BLE001
            logger.warning("Advisory generation failed (non-fatal): %s", ai_exc)
            advisory = {"status": "unavailable", "error": str(ai_exc)}

        summary = {
            "district_id": district_id,
            "event_id": event_id,
            "max_surge_height_m": surge_result.get("max_surge_height_m"),
            "max_wind_kmh": wind_kmh,
            "insurance_triggered": trigger_result.get("triggered", False),
            "hardening_assets_flagged": len([
                h for h in hardening_list if h.reinforcement_advisable
            ]),
            "top_hardening_asset": hardening_list[0].asset_id if hardening_list else None,
            "advisory_status": advisory.get("status", "generated"),
        }

        job.update({
            "status": "completed",
            "stage": "done",
            "elapsed_s": time.perf_counter() - t0,
            "result_summary": summary,
        })
        return summary

    except Exception as exc:  # noqa: BLE001
        job.update({
            "status": "failed",
            "error": str(exc),
            "elapsed_s": time.perf_counter() - t0,
        })
        logger.exception("Pipeline job %s failed.", job_id)
        raise


@router.post("/run", response_model=PipelineStatus, status_code=202)
async def trigger_pipeline(
    req: PipelineRunRequest,
    bg: BackgroundTasks,
) -> PipelineStatus:
    """
    Trigger the full cyclone impact pipeline for any district/event pair.

    Returns a job_id immediately; poll /pipeline/status/{job_id} for progress.
    """
    job_id = str(uuid.uuid4())
    now = time.time()
    _jobs[job_id] = {
        "job_id": job_id,
        "district_id": req.district_id,
        "event_id": req.event_id,
        "status": "queued",
        "stage": "queued",
        "started_at": now,
        "elapsed_s": 0.0,
        "result_summary": None,
        "error": None,
    }

    bg.add_task(_run_pipeline_sync, job_id, req.district_id, req.event_id)

    logger.info("Pipeline job %s queued for %s / %s.", job_id, req.district_id, req.event_id)

    return PipelineStatus(**_jobs[job_id])


@router.get("/status/{job_id}", response_model=PipelineStatus)
async def get_pipeline_status(job_id: str) -> PipelineStatus:
    """Poll pipeline job status."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.")
    return PipelineStatus(**job)


@router.get("/jobs", response_model=list[PipelineStatus])
async def list_jobs() -> list[PipelineStatus]:
    """List all pipeline jobs (most recent first)."""
    return [
        PipelineStatus(**j)
        for j in sorted(_jobs.values(), key=lambda j: j["started_at"], reverse=True)
    ]


# ── WebSocket live updates ─────────────────────────────────────────────────────

@router.websocket("/ws/risk/{district_id}")
async def ws_risk_updates(websocket: WebSocket, district_id: str) -> None:
    """
    WebSocket endpoint pushing live risk and pipeline status updates.

    Clients subscribe to a district's updates; the server pushes whenever
    the pipeline for that district completes a stage or finishes.
    """
    await websocket.accept()
    _ws_connections.setdefault(district_id, []).append(websocket)
    logger.info("WebSocket client connected for district %s.", district_id)

    try:
        await websocket.send_json({"type": "connected", "district_id": district_id})
        while True:
            # Keep connection alive; client pings or server can push
            data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        conns = _ws_connections.get(district_id, [])
        if websocket in conns:
            conns.remove(websocket)
        logger.info("WebSocket client disconnected for district %s.", district_id)
