"""
backend/routers/scenarios.py
Phase 3 — scenario immutability and comparison API.

Design rules:
  - Scenarios are always flagged is_simulation=True
  - Scenarios cannot be used as a baseline (no chaining)
  - Scenario-derived drafts cannot enter the advisory review queue
  - All scenario results carry data_mode="SIMULATED" in the response
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from backend.auth.rbac import require_permission, get_current_role, Role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/scenarios", tags=["Scenario Lab"])


class ScenarioCreateRequest(BaseModel):
    baseline_run_id: str = Field(..., description="Must reference a real pipeline run, not another scenario")
    event_id: str
    district_id: str
    track_offset_deg: float = Field(0.0, ge=-5.0, le=5.0, description="Track heading offset in degrees")
    intensity_delta_hpa: float = Field(0.0, ge=-30.0, le=30.0, description="Pressure drop delta in hPa")
    rainfall_multiplier: float = Field(1.0, ge=0.5, le=3.0, description="Rainfall scaling factor")
    lead_time_offset_h: int = Field(0, ge=-24, le=24, description="Landfall time offset in hours")
    label: Optional[str] = None


@router.post("", status_code=202)
async def create_scenario(
    body: ScenarioCreateRequest,
    background_tasks: BackgroundTasks,
    role: Role = Depends(require_permission("read:risk")),
    current_role: Role = Depends(get_current_role),
):
    """
    Create an immutable simulation scenario from a baseline run.

    Safety guarantees (server-enforced, not just frontend):
    1. baseline_run_id must reference a real pipeline run (not another scenario)
    2. Scenario outputs are never admitted to the advisory review queue
    3. All results carry data_mode='SIMULATED'
    """
    from backend.services.pipeline_orchestrator import (
        create_scenario,
        execute_scenario,
        get_run,
    )

    # Server-side validation: baseline must be a real run
    baseline = get_run(body.baseline_run_id)
    if not baseline:
        raise HTTPException(
            status_code=400,
            detail=f"baseline_run_id '{body.baseline_run_id}' not found. "
                   "Run a real pipeline first.",
        )
    if baseline.get("is_scenario"):
        raise HTTPException(
            status_code=400,
            detail=(
                "baseline_run_id references a scenario run — scenarios cannot chain. "
                "Use a real pipeline run (is_scenario=false) as the baseline."
            ),
        )
    if baseline.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Baseline run is in state '{baseline.get('status')}'. "
                   "Wait for it to complete before creating a scenario.",
        )

    params = {
        "track_offset_deg": body.track_offset_deg,
        "intensity_delta_hpa": body.intensity_delta_hpa,
        "rainfall_multiplier": body.rainfall_multiplier,
        "lead_time_offset_h": body.lead_time_offset_h,
    }

    scenario = create_scenario(
        baseline_run_id=body.baseline_run_id,
        event_id=body.event_id,
        district_id=body.district_id,
        params=params,
        created_by=str(current_role.value),
        label=body.label,
    )

    # Run scenario in background
    background_tasks.add_task(execute_scenario, scenario["scenario_id"])

    return {
        "scenario_id": scenario["scenario_id"],
        "baseline_run_id": body.baseline_run_id,
        "status": "queued",
        "data_mode": "SIMULATED",
        "label": scenario["label"],
        "params": params,
        "schema_version": "1.0",
        "note": (
            "Scenario results are simulation-only. They cannot trigger advisories, "
            "dispatch actions, or insurance events."
        ),
    }


@router.get("/{scenario_id}")
async def get_scenario(
    scenario_id: str,
    role: Role = Depends(require_permission("read:risk")),
):
    """
    Fetch scenario comparison: baseline vs scenario side-by-side.
    All scenario values carry data_mode='SIMULATED'.
    """
    from backend.services.pipeline_orchestrator import get_scenario as _get_scenario

    scenario = _get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    response = {
        "scenario_id": scenario_id,
        "label": scenario.get("label"),
        "status": scenario.get("status"),
        "params": scenario.get("params", {}),
        "data_mode": "SIMULATED",
        "is_simulation": True,
        "scenario": scenario,
        "schema_version": "1.0",
    }

    if scenario.get("comparison"):
        response["comparison"] = {
            **scenario["comparison"],
            # Stamp every value with SIMULATED so the frontend cannot mistake it
            "data_mode": "SIMULATED",
        }

    return response


@router.get("")
async def list_scenarios(
    event_id: str | None = None,
    role: Role = Depends(require_permission("read:risk")),
):
    """List all scenarios, optionally filtered by event."""
    from backend.services.pipeline_orchestrator import _scenario_store
    scenarios = list(_scenario_store.values())
    if event_id:
        scenarios = [s for s in scenarios if s.get("event_id") == event_id]
    return {
        "scenarios": [
            {
                "scenario_id": s["scenario_id"],
                "label": s.get("label"),
                "status": s.get("status"),
                "event_id": s.get("event_id"),
                "baseline_run_id": s.get("baseline_run_id"),
                "params": s.get("params", {}),
                "data_mode": "SIMULATED",
                "created_at": s.get("created_at"),
            }
            for s in scenarios
        ],
        "count": len(scenarios),
        "schema_version": "1.0",
    }
