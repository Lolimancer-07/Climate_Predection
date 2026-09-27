"""
backend/routers/risk.py
GET /risk/{district_id} — Merged hazard + exposure for a district.
GET /risk/{district_id}/wards/{ward_id} — Ward-level detail.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

# Demo data import (replace with DB queries in production)
from data_ingestion.weather.cyclone_track import load_historical_track
from data_ingestion.weather.rainfall_forecast import load_historical_rainfall
from data_ingestion.exposure.osm_extract import PURI_DEMO_ASSETS
from modeling.surge.parametric_surge import fani_demo_surge
from modeling.rainfall_runoff.flash_flood_model import fani_ward7_runoff
from modeling.exposure_scoring.asset_overlay import score_all_assets

router = APIRouter()


class FlaggedAsset(BaseModel):
    asset_id: str
    type: str
    name: str
    priority_score: float
    flag_reason: str


class WardRisk(BaseModel):
    ward_id: str
    ward_name: str
    population: int
    surge_height_m: float
    rainfall_mm_48h: float
    wind_speed_kmh: float
    runoff_risk_score: float
    severity_tier: str
    flagged_assets: list[FlaggedAsset]


class DistrictRisk(BaseModel):
    district_id: str
    event_id: str
    cyclone_name: str
    cyclone_category: str
    wards: list[WardRisk]


# ── Demo endpoints using hardcoded Fani data ─────────────────────────────────

@router.get("/{district_id}", response_model=DistrictRisk)
async def get_district_risk(district_id: str, event_id: str = "CYCLONE-FANI-2019"):
    """
    Return merged hazard polygons + exposure scores for a district.
    Demo mode: returns pre-computed Fani 2019 data for IN-OD-PURI.
    """
    if district_id != "IN-OD-PURI":
        raise HTTPException(status_code=404, detail=f"District {district_id} not in demo dataset.")

    surge = fani_demo_surge()
    runoff = fani_ward7_runoff()
    rainfall = load_historical_rainfall("FANI-2019", district_id)
    track = load_historical_track("FANI-2019")

    hazard_features = [surge.inundation_geojson]
    scores = score_all_assets(PURI_DEMO_ASSETS, hazard_features, event_id)

    flagged = [
        FlaggedAsset(
            asset_id=s.asset_id,
            type=s.asset_type,
            name=s.asset_name,
            priority_score=s.priority_score,
            flag_reason=s.flag_reason,
        )
        for s in scores if s.flagged
    ]

    # Determine severity tier from surge height
    h = surge.surge_height_m
    tier = "Watch" if h < 1.0 else "Warning" if h < 2.5 else "Evacuation Order"

    ward = WardRisk(
        ward_id="WARD-07",
        ward_name="Ward 7, Puri",
        population=12000,
        surge_height_m=surge.surge_height_m,
        rainfall_mm_48h=rainfall.max_rainfall_mm_48h,
        wind_speed_kmh=rainfall.max_wind_speed_kmh,
        runoff_risk_score=runoff.runoff_risk_score,
        severity_tier=tier,
        flagged_assets=flagged,
    )

    return DistrictRisk(
        district_id=district_id,
        event_id=event_id,
        cyclone_name=track.name,
        cyclone_category=track.track_points[-1].category,
        wards=[ward],
    )


@router.get("/{district_id}/wards/{ward_id}", response_model=WardRisk)
async def get_ward_risk(district_id: str, ward_id: str, event_id: str = "CYCLONE-FANI-2019"):
    """Ward-level risk detail."""
    district_data = await get_district_risk(district_id, event_id)
    for w in district_data.wards:
        if w.ward_id == ward_id:
            return w
    raise HTTPException(status_code=404, detail=f"Ward {ward_id} not found in district {district_id}.")
