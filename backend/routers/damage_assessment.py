"""
backend/routers/damage_assessment.py
Post-event damage assessment API endpoints — Phase 2.

Endpoints:
    POST /damage-assessment/{event_id}/run    → trigger Gemini vision comparison
    GET  /damage-assessment/{event_id}        → retrieve validation records
    GET  /damage-assessment/{event_id}/summary → accuracy metrics for a batch
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/damage-assessment", tags=["damage-assessment"])

# In-memory store for demo; replace with DB writes in production
_validation_store: dict[str, list[dict]] = {}
_run_status: dict[str, str] = {}


class DamageRunRequest(BaseModel):
    district_id: str = Field(..., example="IN-OD-PURI")
    landfall_date: date = Field(..., example="2019-05-03")


class ValidationRecordOut(BaseModel):
    record_id: str
    event_id: str
    asset_id: str
    asset_class: str
    predicted_damage_state: str
    observed_damage_state: str
    match: bool
    model_under_predicted: bool
    observation_confidence: str
    observation_caveat: str
    predicted_safety_factor: float
    human_confirmed: bool
    notes: list[str]


class DamageAssessmentSummary(BaseModel):
    event_id: str
    total: int
    match_rate_pct: float
    strict_match_rate_pct: float
    under_predicted_count: int
    over_predicted_count: int
    unconfirmed_count: int
    recalibration_recommended: bool
    note: str


def _run_damage_assessment_sync(
    event_id: str,
    district_id: str,
    landfall_date: date,
) -> None:
    """
    Background task: fetch image pairs, run Gemini change detection,
    compare against structural predictions, store validation records.
    """
    try:
        from modeling.structural_engineering.hardening_priority import (  # type: ignore[import]
            run_district_hardening_assessment,
        )
        from ai_reasoning.rapid_damage_assessment.image_pair_fetch import fetch_image_pair  # type: ignore[import]
        from ai_reasoning.rapid_damage_assessment.change_detection_prompt import (  # type: ignore[import]
            run_change_detection,
        )
        from ai_reasoning.rapid_damage_assessment.validation_record import (  # type: ignore[import]
            create_validation_records,
        )

        # Generate structural predictions
        hardening_list = run_district_hardening_assessment(
            asset_list=[
                {"asset_id": f"{district_id}-POLE-001",  "asset_class": "wood_power_pole",   "criticality": 0.7},
                {"asset_id": f"{district_id}-HOSP-001",  "asset_class": "hospital",           "criticality": 0.95},
                {"asset_id": f"{district_id}-MAS-001",   "asset_class": "masonry_building",   "criticality": 0.5},
                {"asset_id": f"{district_id}-THATCH-001","asset_class": "thatched_roof_house","criticality": 0.4},
            ],
            wind_speed_kmh=220.0,
            surge_grid={
                f"{district_id}-POLE-001":   1.2,
                f"{district_id}-HOSP-001":   2.0,
                f"{district_id}-MAS-001":    2.5,
                f"{district_id}-THATCH-001": 3.0,
            },
        )

        structural_preds = [
            {
                "asset_id": h.asset_id,
                "asset_class": h.asset_class,
                "combined_expected_damage_state": h.combined_expected_damage_state,
                "safety_factor": h.safety_factor,
            }
            for h in hardening_list
        ]

        # Asset lat/lon mapping for image fetch (demo centroids near Puri)
        asset_locations = {
            f"{district_id}-POLE-001":   (19.81, 85.83),
            f"{district_id}-HOSP-001":   (19.80, 85.85),
            f"{district_id}-MAS-001":    (19.79, 85.82),
            f"{district_id}-THATCH-001": (19.78, 85.81),
        }

        # Try to get Gemini client
        try:
            import google.generativeai as genai  # type: ignore
            import os
            genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))
            model = genai.GenerativeModel("gemini-1.5-flash")
            use_gemini = True
        except Exception:
            use_gemini = False

        change_results: list[dict] = []
        for pred in structural_preds:
            asset_id = pred["asset_id"]
            lat, lon = asset_locations.get(asset_id, (19.80, 85.83))

            img_pair = fetch_image_pair(
                asset_id=asset_id,
                district_id=district_id,
                lat=lat,
                lon=lon,
                landfall_date=landfall_date,
            )

            if use_gemini:
                result = run_change_detection(img_pair, model)  # type: ignore[arg-type]
                change_results.append({
                    "asset_id": asset_id,
                    "overall_damage_signal": result.overall_damage_signal,
                    "confidence_overall": result.confidence_overall,
                    "caveat": result.caveat,
                })
            else:
                # Demo fallback: simulate an observed damage signal
                ds_map = {"none": "none", "minor": "minor", "moderate": "minor",
                          "severe": "moderate", "collapse": "severe"}
                predicted = pred["combined_expected_damage_state"]
                change_results.append({
                    "asset_id": asset_id,
                    "overall_damage_signal": ds_map.get(predicted, "none"),
                    "confidence_overall": "low",
                    "caveat": "Demo mode: synthetic damage signal (Gemini API unavailable).",
                })

        records = create_validation_records(event_id, structural_preds, change_results)
        _validation_store[event_id] = [r.to_dict() for r in records]
        _run_status[event_id] = "completed"
        logger.info("Damage assessment completed for event %s (%d records).", event_id, len(records))

    except Exception as exc:  # noqa: BLE001
        _run_status[event_id] = f"failed: {exc}"
        logger.exception("Damage assessment failed for event %s.", event_id)


@router.post("/{event_id}/run", status_code=202)
async def trigger_damage_assessment(
    event_id: str,
    req: DamageRunRequest,
    bg: BackgroundTasks,
) -> dict:
    """Trigger pre/post imagery comparison and validation record generation."""
    _run_status[event_id] = "running"
    bg.add_task(_run_damage_assessment_sync, event_id, req.district_id, req.landfall_date)
    return {
        "job_status": "queued",
        "event_id": event_id,
        "district_id": req.district_id,
        "message": "Damage assessment running in background. Poll GET /damage-assessment/{event_id}.",
    }


@router.get("/{event_id}", response_model=list[ValidationRecordOut])
async def get_damage_assessment(event_id: str) -> list[ValidationRecordOut]:
    """Retrieve post-event validation records for an event."""
    status = _run_status.get(event_id)
    if status == "running":
        raise HTTPException(status_code=202, detail="Assessment still running. Try again shortly.")
    records = _validation_store.get(event_id, [])
    if not records and status is None:
        raise HTTPException(
            status_code=404,
            detail=f"No damage assessment found for event {event_id!r}. "
                   "Trigger one via POST /damage-assessment/{event_id}/run.",
        )
    return [ValidationRecordOut(**r) for r in records]


@router.get("/{event_id}/summary", response_model=DamageAssessmentSummary)
async def get_damage_summary(event_id: str) -> DamageAssessmentSummary:
    """Return accuracy metrics for a batch of validation records."""
    from ai_reasoning.rapid_damage_assessment.validation_record import (  # type: ignore[import]
        ValidationRecord,
        summarise_validation_batch,
    )

    records = _validation_store.get(event_id, [])
    if not records:
        raise HTTPException(status_code=404, detail=f"No records for event {event_id!r}.")

    from dataclasses import fields
    vr_list = []
    for r in records:
        from datetime import datetime, timezone
        vr = ValidationRecord(
            record_id=r["record_id"], event_id=r["event_id"],
            asset_id=r["asset_id"], asset_class=r["asset_class"],
            predicted_damage_state=r["predicted_damage_state"],
            observed_damage_state=r["observed_damage_state"],
            match=r["match"], match_strict=r["match_strict"],
            model_over_predicted=r["model_over_predicted"],
            model_under_predicted=r["model_under_predicted"],
            observation_confidence=r["observation_confidence"],
            observation_caveat=r["observation_caveat"],
            predicted_safety_factor=r["predicted_safety_factor"],
            human_confirmed=r["human_confirmed"],
        )
        vr_list.append(vr)

    summary = summarise_validation_batch(vr_list)
    return DamageAssessmentSummary(event_id=event_id, **{k: v for k, v in summary.items() if k != "note"}, note=summary.get("note", ""))
