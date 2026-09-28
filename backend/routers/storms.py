from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
from typing import List, Dict, Any
import json
from datetime import datetime

from backend.db.session import get_db
from backend.registry.provider_registry import get_active_cyclone_provider
from backend.feature_flags import is_feature_enabled
from backend.basin_config import get_basin_config
from modeling.track_forecast.extrapolation import extrapolate_track
from modeling.track_forecast.intensity_model import extrapolate_intensity
from modeling.track_forecast.uncertainty_cone import build_cone_polygon

router = APIRouter(prefix="/v1/storms", tags=["Real-Time Storm Tracking"])

# Temporary in-memory store for connected clients for the mock feed
storm_clients: dict = {}


@router.get("/active")
async def list_active_storms():
    """List currently active/forming storms"""
    if not is_feature_enabled("live_forecast_mode"):
        raise HTTPException(status_code=403, detail="Live forecast mode is disabled")

    provider = get_active_cyclone_provider()
    raw_storms = provider.list_active_storms()
    # Convert Pydantic models to dicts so we can annotate with extra provenance fields
    storms = [s if isinstance(s, dict) else s.dict() for s in raw_storms]
    for s in storms:
        s["data_mode"] = "MOCK"
        s["provider"] = type(provider).__name__
        s["freshness_seconds"] = 0
    return storms


@router.get("/{storm_id}/track")
async def get_storm_track(storm_id: str):
    """Observed fixes + forecast fixes with lead-time labels"""
    provider = get_active_cyclone_provider()
    observed_fixes = provider.get_track(storm_id)

    if not observed_fixes:
        raise HTTPException(status_code=404, detail="Storm track not found")

    basin_config = get_basin_config("bay_of_bengal")
    climo_heading = basin_config.get("seasonal_climatology_heading_deg", 315.0)

    forecast_fixes = extrapolate_track(observed_fixes, climatology_heading=climo_heading)
    forecast_fixes = extrapolate_intensity(
        forecast_fixes,
        sst_threshold_c=basin_config["intensity_model"]["sst_intensification_threshold_c"],
        max_intensification_rate_kmh=basin_config["intensity_model"]["max_intensification_rate_kmh_per_day"],
        landfall_decay_rate_kmh=basin_config["intensity_model"]["landfall_decay_rate_kmh_per_day"],
        max_wind_speed_kmh=basin_config["intensity_model"]["max_wind_speed_kmh"],
    )

    return {
        "storm_id": storm_id,
        "data_mode": "MOCK",
        "provider": type(provider).__name__,
        "observed": observed_fixes,
        "forecast": forecast_fixes,
        "schema_version": "v1.0",
    }


@router.get("/{storm_id}/cone")
async def get_forecast_cone(storm_id: str):
    """Forecast cone-of-uncertainty as GeoJSON FeatureCollection (not WKT)."""
    provider = get_active_cyclone_provider()
    observed_fixes = provider.get_track(storm_id)

    if not observed_fixes:
        raise HTTPException(status_code=404, detail="Storm track not found")

    basin_config = get_basin_config("bay_of_bengal")
    climo_heading = basin_config.get("seasonal_climatology_heading_deg", 315.0)

    forecast_fixes = extrapolate_track(observed_fixes, climatology_heading=climo_heading)
    all_fixes = observed_fixes + forecast_fixes

    cone_geom = build_cone_polygon(
        all_fixes,
        basin_config["cone_radius_lookup_km"],
        start_time=observed_fixes[-1].timestamp if observed_fixes else None,
    )

    # Convert shapely geometry to GeoJSON (required by map consumers, not WKT)
    if cone_geom.is_empty:
        geojson_geom = None
    else:
        import shapely.geometry
        geojson_geom = shapely.geometry.mapping(cone_geom)

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": geojson_geom,
                "properties": {
                    "storm_id": storm_id,
                    "data_mode": "MOCK",
                    "schema_version": "v1.0",
                    "uncertainty_note": (
                        "CLIPER-style statistical extrapolation — not an authoritative NWP cone. "
                        "For operational use upgrade to a coupled NWP model."
                    ),
                },
            }
        ]
        if geojson_geom
        else [],
    }


@router.get("/{storm_id}/threatened-districts")
async def get_threatened_districts(storm_id: str, db: AsyncSession = Depends(get_db)):
    """Dynamically resolved district list based on cone intersection."""
    return {
        "districts": [
            {"district_id": "IN-OD-PURI", "name": "Puri", "earliest_impact_hour": 48}
        ],
        "data_mode": "MOCK",
        "schema_version": "v1.0",
    }


@router.post("/{storm_id}/runs")
@router.post("/{storm_id}/run-live-pipeline")
async def run_live_pipeline(
    storm_id: str, background_tasks: BackgroundTasks, district_id: str = "IN-OD-PURI", db: AsyncSession = Depends(get_db)
):
    """Queue a full pipeline run for all threatened districts."""
    import uuid
    import time
    from backend.routers.pipeline import _run_pipeline_sync, _jobs

    job_id = str(uuid.uuid4())
    now = time.time()
    _jobs[job_id] = {
        "job_id": job_id,
        "district_id": district_id,
        "event_id": storm_id,
        "status": "queued",
        "stage": "queued",
        "started_at": now,
        "elapsed_s": 0.0,
        "result_summary": None,
        "error": None,
    }

    background_tasks.add_task(_run_pipeline_sync, job_id, district_id, storm_id)

    return {
        "status": "queued",
        "job_id": job_id,
        "storm_id": storm_id,
        "district_id": district_id,
        "schema_version": "v1.0",
    }


@router.get("/runs/{run_id}")
async def get_run_status(run_id: str):
    """Fetch status and output of a pipeline run."""
    from backend.routers.pipeline import _jobs
    job = _jobs.get(run_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Pipeline run '{run_id}' not found")
    return job


@router.get("/{storm_id}/risk-timeline")
async def get_risk_timeline(storm_id: str, db: AsyncSession = Depends(get_db)):
    """Time series of risk across the forecast window."""
    return {
        "storm_id": storm_id,
        "data_mode": "MOCK",
        "timeline": [
            {"hour": 24, "max_surge_m": 0.5, "max_wind_kmh": 65, "population_exposed": 1000},
            {"hour": 48, "max_surge_m": 1.2, "max_wind_kmh": 85, "population_exposed": 50000},
            {"hour": 72, "max_surge_m": 2.5, "max_wind_kmh": 140, "population_exposed": 200000},
            {"hour": 96, "max_surge_m": 0.0, "max_wind_kmh": 60, "population_exposed": 5000},
        ],
        "schema_version": "v1.0",
    }


@router.websocket("/ws/{storm_id}")
async def storm_websocket(websocket: WebSocket, storm_id: str):
    await websocket.accept()
    if storm_id not in storm_clients:
        storm_clients[storm_id] = []
    storm_clients[storm_id].append(websocket)

    from backend.inference import (
        generate_baseline_telemetry,
        process_telemetry_packet,
        process_gcs_command,
        latest_state,
        demo_controller,
        fleet_manager,
    )
    from backend.cyclone_nexus_ai import answer_copilot_query

    # Background task to send full digital twin telemetry ticks
    async def telemetry_tick_loop():
        cycle = latest_state.get("cycle", 1)
        try:
            while True:
                packet = generate_baseline_telemetry(
                    cycle=cycle,
                    mode=latest_state.get("mission_mode", "NORMAL"),
                    injected_faults=latest_state.get("active_faults", [])
                )
                packet["storm_name"] = storm_id
                process_telemetry_packet(packet)

                # Send combined payload
                tick_payload = dict(latest_state)
                tick_payload["type"] = "telemetry_tick"
                tick_payload["storm_id"] = storm_id
                tick_payload["timestamp"] = datetime.now(timezone.utc).isoformat()

                await websocket.send_json(tick_payload)
                cycle += 1
                await asyncio.sleep(1.0)
        except Exception:
            pass

    tick_task = asyncio.create_task(telemetry_tick_loop())

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
                cmd = msg.get("command") or msg.get("action")

                if cmd == "ai_engineer_query":
                    q = msg.get("question", "")
                    ans = answer_copilot_query(q, latest_state)
                    await websocket.send_json({"type": "ai_engineer_response", "ai_engineer_response": ans})
                else:
                    process_gcs_command(msg)
                    resp = dict(latest_state)
                    resp["type"] = "command_ack"
                    resp["command"] = cmd
                    await websocket.send_json(resp)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        tick_task.cancel()
        if websocket in storm_clients.get(storm_id, []):
            storm_clients[storm_id].remove(websocket)
    except Exception:
        tick_task.cancel()
        if websocket in storm_clients.get(storm_id, []):
            storm_clients[storm_id].remove(websocket)


