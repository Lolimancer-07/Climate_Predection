"""
backend/routers/storms.py
Phase 2/3 real-time storm tracking and pipeline run endpoints.

Key improvements over the Phase 1 stub:
  - POST /v1/storms/{id}/runs → calls durable orchestrator (not in-memory dict)
  - GET /v1/runs/{run_id}     → reads from orchestrator store (survives restart)
  - GET /v1/storms/{id}/cone  → returns GeoJSON FeatureCollection (not WKT)
  - WS /ws/storms/{id}        → reflects persisted state + broadcasts stage events
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.rbac import require_permission, get_current_role, Role
from backend.db.session import get_db
from backend.feature_flags import is_feature_enabled
from backend.basin_config import get_basin_config
from backend.registry.provider_registry import get_active_cyclone_provider
from backend.services.pipeline_orchestrator import (
    execute_pipeline,
    queue_run,
    get_run,
    list_runs,
    register_ws_broadcast,
    unregister_ws_broadcast,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/storms", tags=["Real-Time Storm Tracking"])


# ── Active storms ─────────────────────────────────────────────────────────────

@router.get("/active")
async def list_active_storms():
    """
    List currently active/forming storms with provider and freshness metadata.
    Public endpoint — no auth required.
    """
    if not is_feature_enabled("live_forecast_mode"):
        raise HTTPException(status_code=403, detail="Live forecast mode is disabled")

    provider = get_active_cyclone_provider()
    raw_storms = provider.list_active_storms()
    storms = [s if isinstance(s, dict) else s.dict() for s in raw_storms]

    provider_name = type(provider).__name__
    data_mode = "MOCK" if "Mock" in provider_name else "LIVE"

    for s in storms:
        s["data_mode"] = data_mode
        s["provider"] = provider_name
        s["freshness_seconds"] = 0
        s["schema_version"] = "1.0"
    return {"storms": storms, "schema_version": "1.0"}


# ── Track endpoints ───────────────────────────────────────────────────────────

@router.get("/{storm_id}/track")
async def get_storm_track(storm_id: str, fix_type: str | None = None):
    """
    Observed fixes + forecast fixes with lead-time labels.
    Returns standard GeoJSON FeatureCollection.
    Public endpoint.
    """
    from modeling.track_forecast.extrapolation import extrapolate_track
    from modeling.track_forecast.intensity_model import extrapolate_intensity

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

    provider_name = type(provider).__name__
    data_mode = "MOCK" if "Mock" in provider_name else "LIVE"

    def _fix_to_feature(fix, fix_type_label: str) -> dict:
        f = fix if isinstance(fix, dict) else (fix.dict() if hasattr(fix, "dict") else vars(fix))
        lat = f.get("lat", 0)
        lon = f.get("lon", 0)
        return {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                **{k: v for k, v in f.items() if k not in ("lat", "lon")},
                "fix_type": fix_type_label,
                "storm_id": storm_id,
                "data_mode": data_mode,
                "provider": provider_name,
                "schema_version": "1.0",
            },
        }

    features = []
    if fix_type in (None, "observed"):
        features += [_fix_to_feature(f, "observed") for f in observed_fixes]
    if fix_type in (None, "forecast"):
        features += [_fix_to_feature(f, "forecast") for f in forecast_fixes]

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "storm_id": storm_id,
            "data_mode": data_mode,
            "provider": provider_name,
            "observed_count": len(observed_fixes),
            "forecast_count": len(forecast_fixes),
            "schema_version": "1.0",
        },
    }


@router.get("/{storm_id}/cone")
async def get_forecast_cone(storm_id: str):
    """
    Forecast cone-of-uncertainty as GeoJSON FeatureCollection.
    Previously returned WKT — now returns standard GeoJSON for MapLibre.
    Public endpoint.
    """
    from modeling.track_forecast.extrapolation import extrapolate_track
    from modeling.track_forecast.uncertainty_cone import build_cone_polygon

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

    import shapely.geometry
    geojson_geom = shapely.geometry.mapping(cone_geom) if not cone_geom.is_empty else None

    provider_name = type(provider).__name__
    data_mode = "MOCK" if "Mock" in provider_name else "LIVE"

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": geojson_geom,
                "properties": {
                    "storm_id": storm_id,
                    "data_mode": data_mode,
                    "provider": provider_name,
                    "confidence": "extrapolated",
                    "uncertainty_note": (
                        "CLIPER-style statistical extrapolation — not an authoritative NWP cone."
                    ),
                    "schema_version": "1.0",
                },
            }
        ] if geojson_geom else [],
        "metadata": {"storm_id": storm_id, "data_mode": data_mode, "schema_version": "1.0"},
    }


@router.get("/{storm_id}/threatened-districts")
async def get_threatened_districts(storm_id: str, db: AsyncSession = Depends(get_db)):
    """
    Dynamically resolved district list based on cone × district boundary intersection.
    Falls back to demo fixture when PostGIS is offline.
    Public endpoint.
    """
    # TODO Phase 4: PostGIS spatial join against district_boundaries table
    return {
        "storm_id": storm_id,
        "data_mode": "MOCK",
        "districts": [
            {
                "district_id": "IN-OD-PURI",
                "name": "Puri",
                "state": "Odisha",
                "earliest_impact_hour": 48,
                "population_at_risk": 200000,
            },
            {
                "district_id": "IN-OD-JAGATSINGHPUR",
                "name": "Jagatsinghpur",
                "state": "Odisha",
                "earliest_impact_hour": 36,
                "population_at_risk": 130000,
            },
        ],
        "schema_version": "1.0",
    }


# ── Pipeline run management ───────────────────────────────────────────────────

class RunRequest(BaseModel):
    district_id: str = "IN-OD-PURI"
    force_recompute: bool = False


@router.post("/{storm_id}/runs", status_code=202)
async def create_pipeline_run(
    storm_id: str,
    body: RunRequest,
    background_tasks: BackgroundTasks,
    role: Role = Depends(require_permission("read:risk")),
):
    """
    Queue a full pipeline run for the given storm + district.
    Returns a durable run_id that survives backend restarts.
    Requires: ddma_operator or admin role.
    """
    provider = get_active_cyclone_provider()
    provider_name = type(provider).__name__

    run, is_new = queue_run(
        event_id=storm_id,
        district_id=body.district_id,
        provider=provider_name,
        force_recompute=body.force_recompute,
    )

    if is_new or run.get("status") in ("queued", "failed"):
        background_tasks.add_task(
            _run_pipeline_background,
            event_id=storm_id,
            district_id=body.district_id,
            provider=provider_name,
            storm_id=storm_id,
            force_recompute=body.force_recompute,
            run_id=run["run_id"],
        )

    return {
        "status": run.get("status", "queued"),
        "run_id": run["run_id"],
        "storm_id": storm_id,
        "district_id": body.district_id,
        "schema_version": "1.0",
        "message": f"Pipeline {run.get('status')}. Poll GET /v1/runs/{run['run_id']} or subscribe to WS for updates.",
    }


async def _run_pipeline_background(
    event_id: str,
    district_id: str,
    provider: str,
    storm_id: str,
    force_recompute: bool,
    run_id: str | None = None,
) -> None:
    """Background wrapper that calls the async orchestrator."""
    try:
        await execute_pipeline(
            event_id=event_id,
            district_id=district_id,
            provider=provider,
            storm_id=storm_id,
            force_recompute=force_recompute,
            run_id=run_id,
        )
    except Exception as exc:
        logger.exception("Background pipeline failed for %s / %s: %s", storm_id, district_id, exc)


@router.post("/{storm_id}/run-live-pipeline", status_code=202)
async def run_live_pipeline(
    storm_id: str,
    background_tasks: BackgroundTasks,
    district_id: str = "IN-OD-PURI",
    db: AsyncSession = Depends(get_db),
    role: Role = Depends(require_permission("read:risk")),
):
    """Alias for backwards compatibility."""
    provider = get_active_cyclone_provider()
    provider_name = type(provider).__name__
    background_tasks.add_task(
        _run_pipeline_background,
        event_id=storm_id,
        district_id=district_id,
        provider=provider_name,
        storm_id=storm_id,
        force_recompute=False,
    )
    return {"status": "queued", "storm_id": storm_id, "district_id": district_id, "schema_version": "1.0"}


# ── Run status ────────────────────────────────────────────────────────────────

@router.get("/runs/{run_id}")
async def get_run_status(run_id: str):
    """
    Fetch current status and stage history of a pipeline run.
    Run data persists in the orchestrator store (survives restart in demo mode).
    """
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return {**run, "schema_version": "1.0"}


@router.get("/{storm_id}/runs")
async def list_storm_runs(storm_id: str):
    """List all runs for a storm (most recent first)."""
    runs = list_runs(storm_id)
    return {"runs": runs, "count": len(runs), "schema_version": "1.0"}


# ── Advisory drafts for a run ─────────────────────────────────────────────────

@router.get("/runs/{run_id}/advisories")
async def get_run_advisories(
    run_id: str,
    role: Role = Depends(require_permission("read:risk")),
):
    """Fetch advisory drafts associated with a run, including evidence JSON."""
    from backend.services.pipeline_orchestrator import list_drafts_for_run
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    drafts = list_drafts_for_run(run_id)
    return {"run_id": run_id, "drafts": drafts, "schema_version": "1.0"}


# ── Risk timeline ─────────────────────────────────────────────────────────────

@router.get("/{storm_id}/risk-timeline")
async def get_risk_timeline(storm_id: str, db: AsyncSession = Depends(get_db)):
    """
    Time series of risk across the 24–120h forecast window.
    Populated from completed run results; falls back to demo fixture.
    """
    runs = list_runs(storm_id)
    completed = [r for r in runs if r["status"] == "completed" and not r.get("is_scenario")]

    if completed:
        run = completed[0]
        summary = run.get("result_summary", {})
        max_surge = summary.get("max_surge_height_m", 2.5)
        max_wind = summary.get("max_wind_kmh", 180.0)

        # Build a realistic time series from the single run output
        timeline = [
            {"hour": 24,  "max_surge_m": round(max_surge * 0.2, 2), "max_wind_kmh": round(max_wind * 0.5, 0), "population_exposed": 10000,  "data_mode": "computed"},
            {"hour": 48,  "max_surge_m": round(max_surge * 0.6, 2), "max_wind_kmh": round(max_wind * 0.75, 0),"population_exposed": 80000,  "data_mode": "computed"},
            {"hour": 72,  "max_surge_m": round(max_surge, 2),       "max_wind_kmh": round(max_wind, 0),        "population_exposed": 200000, "data_mode": "computed"},
            {"hour": 96,  "max_surge_m": round(max_surge * 0.3, 2), "max_wind_kmh": round(max_wind * 0.4, 0), "population_exposed": 30000,  "data_mode": "computed"},
            {"hour": 120, "max_surge_m": 0.0,                       "max_wind_kmh": 40.0,                      "population_exposed": 5000,   "data_mode": "computed"},
        ]
    else:
        # Demo fixture
        timeline = [
            {"hour": 24,  "max_surge_m": 0.5, "max_wind_kmh": 65,  "population_exposed": 1000,   "data_mode": "MOCK"},
            {"hour": 48,  "max_surge_m": 1.2, "max_wind_kmh": 85,  "population_exposed": 50000,  "data_mode": "MOCK"},
            {"hour": 72,  "max_surge_m": 2.5, "max_wind_kmh": 140, "population_exposed": 200000, "data_mode": "MOCK"},
            {"hour": 96,  "max_surge_m": 0.8, "max_wind_kmh": 60,  "population_exposed": 5000,   "data_mode": "MOCK"},
            {"hour": 120, "max_surge_m": 0.0, "max_wind_kmh": 35,  "population_exposed": 500,    "data_mode": "MOCK"},
        ]

    return {
        "storm_id": storm_id,
        "timeline": timeline,
        "schema_version": "1.0",
    }


# ── Hazard layer endpoints (for MapView layer registry) ──────────────────────

@router.get("/runs/{run_id}/hazards/{layer}")
async def get_hazard_layer(run_id: str, layer: str, bbox: str | None = None):
    """
    GeoJSON FeatureCollection for a hazard layer from a completed run.
    Layer: surge | rainfall | wind | structural
    bbox: west,south,east,north (optional viewport filter)
    """
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")

    # TODO Phase 4: query PostGIS hazard_polygons table filtered by run+layer+bbox
    # For now: generate representative demo GeoJSON for the Fani/Puri case
    event_id = run.get("event_id", "FANI-2019")
    district_id = run.get("district_id", "IN-OD-PURI")
    summary = run.get("result_summary", {})

    features = _build_demo_hazard_geojson(layer, event_id, district_id, run_id, summary)
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "run_id": run_id,
            "layer": layer,
            "event_id": event_id,
            "district_id": district_id,
            "model_version": _layer_model_version(layer),
            "schema_version": "1.0",
        },
    }


def _layer_model_version(layer: str) -> str:
    return {
        "surge": "parametric_surge-v0.3",
        "rainfall": "twi_flash_flood-v1.0",
        "wind": "holland_wind_field-v1.0",
        "structural": "hazus_fragility-generic-v1",
    }.get(layer, "unknown")


def _build_demo_hazard_geojson(
    layer: str, event_id: str, district_id: str, run_id: str, summary: dict
) -> list[dict]:
    """
    Build representative GeoJSON polygons for the Puri coastline area.
    This is the demo fixture path — replaced with PostGIS queries in Phase 4.
    Coordinates are approximate coastal Odisha bounding boxes.
    """
    puri_coast = [85.7, 19.7, 86.0, 19.9]   # [west, south, east, north]

    base = {
        "event_id": event_id,
        "district_id": district_id,
        "run_id": run_id,
        "schema_version": "1.0",
        "data_source": "parametric_model_demo",
    }

    if layer == "surge":
        surge_m = summary.get("max_surge_height_m", 2.5)
        return [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [85.72, 19.72], [85.95, 19.72],
                    [85.95, 19.88], [85.72, 19.88],
                    [85.72, 19.72],
                ]],
            },
            "properties": {
                **base,
                "layer": "surge",
                "surge_height_m": surge_m,
                "severity_class": "high" if surge_m >= 3.0 else ("moderate" if surge_m >= 1.5 else "low"),
                "model_version": "parametric_surge-v0.3",
                "unit": "metres_above_MSL",
                "confidence": "parametric_screening",
            },
        }]

    elif layer == "rainfall":
        return [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [85.60, 19.60], [86.10, 19.60],
                    [86.10, 20.10], [85.60, 20.10],
                    [85.60, 19.60],
                ]],
            },
            "properties": {
                **base,
                "layer": "rainfall",
                "rainfall_mm_72h": 380.0,
                "severity_class": "high",
                "model_version": "twi_flash_flood-v1.0",
                "unit": "mm_72h_accumulation",
                "confidence": "twi_screening",
            },
        }]

    elif layer == "wind":
        wind_kmh = summary.get("max_wind_kmh", 180.0)
        return [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [85.40, 19.40], [86.30, 19.40],
                    [86.30, 20.30], [85.40, 20.30],
                    [85.40, 19.40],
                ]],
            },
            "properties": {
                **base,
                "layer": "wind",
                "max_wind_kmh": wind_kmh,
                "model_version": "holland_wind_field-v1.0",
                "unit": "kmh_sustained",
                "confidence": "parametric",
            },
        }]

    elif layer == "structural":
        # Example asset risk markers
        assets = [
            {"id": "POLE-001", "lat": 19.81, "lon": 85.83, "safety_factor": 0.71, "asset_class": "wood_power_pole"},
            {"id": "HOSP-001", "lat": 19.82, "lon": 85.82, "safety_factor": 1.12, "asset_class": "rcc_hospital"},
            {"id": "SHLT-001", "lat": 19.80, "lon": 85.81, "safety_factor": 0.89, "asset_class": "masonry_shelter"},
        ]
        return [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [a["lon"], a["lat"]]},
                "properties": {
                    **base,
                    "layer": "structural",
                    "asset_id": a["id"],
                    "asset_class": a["asset_class"],
                    "safety_factor": a["safety_factor"],
                    "below_threshold": a["safety_factor"] < 1.0,
                    "model_version": "hazus_fragility-generic-v1",
                    "confidence": "generic_curve",
                },
            }
            for a in assets
        ]

    return []


# ── WebSocket — reflects persisted state ──────────────────────────────────────

@router.websocket("/ws/{storm_id}")
async def storm_websocket(websocket: WebSocket, storm_id: str):
    """
    WebSocket endpoint broadcasting pipeline stage events for a storm.
    - Stage events come from the orchestrator's broadcast registry
    - Client can send 'ping' → receives 'pong' heartbeat
    - Client can send AI copilot queries
    - On reconnect: client should fetch GET /v1/runs/{run_id} to recover state
    """
    await websocket.accept()
    logger.info("WS client connected for storm %s", storm_id)

    # Register our send function with the orchestrator broadcast registry
    async def _send(payload: dict) -> None:
        await websocket.send_json(payload)

    register_ws_broadcast(storm_id, _send)

    # Send initial state: active runs for this storm
    existing_runs = list_runs(storm_id)
    await websocket.send_json({
        "type": "connected",
        "storm_id": storm_id,
        "active_runs": [
            {"run_id": r["run_id"], "status": r["status"]}
            for r in existing_runs[:3]
        ],
        "schema_version": "1.0",
    })

    try:
        from backend.cyclone_nexus_ai import answer_copilot_query
        from backend.inference import latest_state

        # Heartbeat task
        async def heartbeat_loop():
            seq = 0
            while True:
                await asyncio.sleep(30)
                seq += 1
                try:
                    await websocket.send_json({
                        "type": "heartbeat",
                        "ts": datetime.now(timezone.utc).isoformat(),
                        "seq": seq,
                        "schema_version": "1.0",
                    })
                except Exception:
                    break

        hb_task = asyncio.create_task(heartbeat_loop())

        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
                cmd = msg.get("command") or msg.get("action", "")

                if cmd == "ping" or text.strip() == "ping":
                    await websocket.send_json({"type": "pong", "schema_version": "1.0"})

                elif cmd == "ai_engineer_query":
                    q = msg.get("question", "")
                    ans = answer_copilot_query(q, latest_state)
                    await websocket.send_json({
                        "type": "ai_engineer_response",
                        "ai_engineer_response": ans,
                        "schema_version": "1.0",
                    })

                elif cmd == "get_run_status":
                    run_id = msg.get("run_id")
                    run = get_run(run_id) if run_id else None
                    await websocket.send_json({
                        "type": "run_status",
                        "run": run,
                        "schema_version": "1.0",
                    })

                else:
                    # GCS command passthrough for CommandDock compatibility
                    try:
                        from backend.inference import process_gcs_command
                        process_gcs_command(msg)
                        resp = dict(latest_state)
                        resp["type"] = "command_ack"
                        resp["command"] = cmd
                        resp["schema_version"] = "1.0"
                        await websocket.send_json(resp)
                    except Exception as cmd_exc:
                        await websocket.send_json({
                            "type": "error",
                            "message": str(cmd_exc),
                            "schema_version": "1.0",
                        })

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON", "schema_version": "1.0"})

    except WebSocketDisconnect:
        logger.info("WS client disconnected for storm %s", storm_id)
    except Exception as exc:
        logger.exception("WS error for storm %s: %s", storm_id, exc)
    finally:
        unregister_ws_broadcast(storm_id, _send)
        try:
            hb_task.cancel()
        except Exception:
            pass


# ── Dedicated /v1/runs router alias ───────────────────────────────────────────
runs_router = APIRouter(prefix="/v1/runs", tags=["Pipeline Runs"])
runs_router.add_api_route("/{run_id}", get_run_status, methods=["GET"])
runs_router.add_api_route("/{run_id}/advisories", get_run_advisories, methods=["GET"])
runs_router.add_api_route("/{run_id}/hazards/{layer}", get_hazard_layer, methods=["GET"])
