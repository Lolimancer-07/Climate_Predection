"""
tests/integration/test_end_to_end_pipeline.py
Full pipeline integration test: ingestion → modeling → trigger evaluation.
Does not call external APIs — uses all hardcoded demo data.
"""
import pytest
from data_ingestion.weather.cyclone_track import load_historical_track
from data_ingestion.weather.rainfall_forecast import load_historical_rainfall
from data_ingestion.exposure.osm_extract import PURI_DEMO_ASSETS
from modeling.surge.parametric_surge import fani_demo_surge
from modeling.rainfall_runoff.flash_flood_model import fani_ward7_runoff
from modeling.exposure_scoring.asset_overlay import score_all_assets
from modeling.insurance_trigger.trigger_engine import (
    evaluate_all_policies, build_payout_payload, DEMO_POLICIES
)


@pytest.mark.asyncio
async def test_full_fani_pipeline():
    """
    End-to-end pipeline test for Cyclone Fani 2019 → Puri district.
    Checks that all stages produce sane, non-empty output with no exceptions.
    """
    EVENT_ID    = "CYCLONE-FANI-2019"
    DISTRICT_ID = "IN-OD-PURI"

    # ── Stage 1: Cyclone track ─────────────────────────────────
    track = load_historical_track("FANI-2019")
    assert track.name == "Fani"
    assert len(track.track_points) >= 2

    # ── Stage 2: Rainfall forecast ─────────────────────────────
    rainfall = load_historical_rainfall("FANI-2019", DISTRICT_ID)
    assert rainfall.max_rainfall_mm_48h > 0
    assert rainfall.max_wind_speed_kmh > 0

    # ── Stage 3: Surge model ───────────────────────────────────
    surge = fani_demo_surge()
    assert surge.surge_height_m > 0
    assert surge.inundation_geojson["geometry"]["type"] == "Polygon"

    # ── Stage 4: Runoff model ──────────────────────────────────
    runoff = fani_ward7_runoff()
    assert 0 <= runoff.runoff_risk_score <= 1
    assert runoff.severity_class in ("Low", "Medium", "High", "Severe")

    # ── Stage 5: Exposure scoring ──────────────────────────────
    hazard_features = [surge.inundation_geojson]
    scores = score_all_assets(PURI_DEMO_ASSETS, hazard_features, EVENT_ID)
    assert len(scores) == len(PURI_DEMO_ASSETS)
    # Priority sorted descending
    priorities = [s.priority_score for s in scores]
    assert priorities == sorted(priorities, reverse=True)

    # ── Stage 6: Insurance triggers ────────────────────────────
    hazard_values = {
        "surge_height":   surge.surge_height_m,
        "rainfall_total": rainfall.max_rainfall_mm_48h,
        "wind_speed":     rainfall.max_wind_speed_kmh,
    }
    records = evaluate_all_policies(DEMO_POLICIES, EVENT_ID, hazard_values)
    assert len(records) == 3

    fired = [r for r in records if r.triggered]
    assert len(fired) >= 1, "At least one trigger should fire for Fani-level hazard"

    # ── Stage 7: Payout payloads ───────────────────────────────
    for record in fired:
        payload = build_payout_payload(record)
        assert payload["triggered"] is True
        assert "audit_hash" in payload
        assert len(payload["audit_hash"]) == 64

    print(f"\n✅ Full pipeline PASSED")
    print(f"   Surge: {surge.surge_height_m:.2f}m | Runoff: {runoff.severity_class}")
    print(f"   Scored {len(scores)} assets, {sum(1 for s in scores if s.flagged)} flagged")
    print(f"   {len(fired)}/{len(records)} insurance triggers fired")
