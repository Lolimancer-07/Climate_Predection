#!/usr/bin/env python3
"""
scripts/demo_run.py
End-to-end demo pipeline runner.

Usage:
    python -m scripts.demo_run --cyclone FANI-2019 --district IN-OD-PURI
    python -m scripts.demo_run --cyclone MOCHA-2023 --district BD-COX

Runs the full pipeline from cyclone bulletin to dispatch-ready advisory
and parametric insurance trigger evaluation, printing a structured summary.
"""
import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# ── Imports ───────────────────────────────────────────────────────────────────
from data_ingestion.weather.cyclone_track   import load_historical_track
from data_ingestion.weather.rainfall_forecast import load_historical_rainfall
from data_ingestion.exposure.osm_extract    import PURI_DEMO_ASSETS
from data_ingestion.exposure.shelters       import load_shelters, shelter_to_asset_dict

from modeling.surge.parametric_surge        import run_surge_model, SurgeInput
from modeling.rainfall_runoff.flash_flood_model import run_runoff_model, RunoffInput
from modeling.exposure_scoring.asset_overlay import score_all_assets
from modeling.exposure_scoring.route_impact  import compute_route_impact
from modeling.insurance_trigger.trigger_engine import (
    evaluate_all_policies, build_payout_payload, DEMO_POLICIES,
)


def run_demo(cyclone_name: str, district_id: str, hours_before_landfall: int = 72):
    t0 = time.monotonic()

    print(f"\n{'='*60}")
    print(f"  CYCLONE ANTICIPATORY ACTION PLATFORM — DEMO RUN")
    print(f"  Cyclone: {cyclone_name}  |  District: {district_id}")
    print(f"  Simulating T-{hours_before_landfall}h forecast window")
    print(f"{'='*60}\n")

    # ── Step 1: Load cyclone track ─────────────────────────────
    print("▶ Step 1: Loading cyclone track…")
    track = load_historical_track(cyclone_name)
    landfall = track.landfall_point or track.track_points[-1]
    print(f"  ✓ {track.name} | Source: {track.source} | {len(track.track_points)} track points")
    print(f"    Landfall: {landfall.lat:.2f}°N {landfall.lon:.2f}°E | "
          f"Cat: {landfall.category} | Wind: {landfall.wind_speed_kt}kt | "
          f"Pressure: {landfall.central_pressure_hpa}hPa\n")

    # ── Step 2: Rainfall forecast ──────────────────────────────
    print("▶ Step 2: Fetching rainfall forecast…")
    rainfall = load_historical_rainfall(cyclone_name, district_id)
    print(f"  ✓ Max rainfall 48h: {rainfall.max_rainfall_mm_48h:.0f}mm | "
          f"Wind: {rainfall.max_wind_speed_kmh:.0f}km/h\n")

    # ── Step 3: Storm surge model ──────────────────────────────
    print("▶ Step 3: Running parametric surge model…")
    surge_inp = SurgeInput(
        central_pressure_hpa=landfall.central_pressure_hpa,
        radius_max_wind_nm=landfall.radius_max_wind_nm,
        forward_speed_kt=landfall.forward_speed_kt,
        shelf_slope_deg=0.40,
        landfall_lat=landfall.lat,
        landfall_lon=landfall.lon,
        district_id=district_id,
        event_id=track.event_id,
    )
    surge = run_surge_model(surge_inp)
    print(f"  ✓ Surge height: {surge.surge_height_m:.2f}m | "
          f"Inundation radius: {surge.inundation_radius_km:.1f}km | "
          f"Severity: {surge.inundation_geojson['properties']['severity_class']}")
    print(f"  ⚠  {surge.notes}\n")

    # ── Step 4: Rainfall-runoff model ──────────────────────────
    print("▶ Step 4: Running rainfall-runoff model (Ward 7)…")
    runoff_inp = RunoffInput(
        ward_id="WARD-07",
        event_id=track.event_id,
        rainfall_mm_24h=rainfall.max_rainfall_mm_24h,
        rainfall_mm_48h=rainfall.max_rainfall_mm_48h,
        avg_twi=12.5,
        land_cover_permeability=0.55,
        district_id=district_id,
    )
    runoff = run_runoff_model(runoff_inp)
    print(f"  ✓ Runoff risk: {runoff.runoff_risk_score:.2f} ({runoff.severity_class})\n")

    # ── Step 5: Exposure scoring ───────────────────────────────
    print("▶ Step 5: Computing infrastructure exposure…")
    shelters = [shelter_to_asset_dict(s) for s in load_shelters(district_id)]
    all_assets = PURI_DEMO_ASSETS + [s for s in shelters if s not in PURI_DEMO_ASSETS]
    hazard_features = [surge.inundation_geojson]
    scores = score_all_assets(all_assets, hazard_features, track.event_id)
    flagged = [s for s in scores if s.flagged]

    print(f"  ✓ {len(scores)} assets scored | {len(flagged)} flagged")
    for s in flagged[:5]:
        print(f"    🚨 [{s.asset_type:12s}] {s.asset_name[:45]}")
        print(f"       Priority: {s.priority_score:.2f} | {s.flag_reason}")
    print()

    # ── Step 6: Route impact ───────────────────────────────────
    print("▶ Step 6: Checking evacuation route impact…")
    blocked_roads = [s.asset_id for s in flagged if s.asset_type == "road"]
    route = compute_route_impact(
        origin_lon=85.835, origin_lat=19.775,
        destination_lon=85.820, destination_lat=19.780,
        hazard_geojson_features=hazard_features,
        blocked_road_ids=blocked_roads,
        district_id=district_id,
    )
    print(f"  ✓ Primary route blocked: {route.primary_route_blocked}")
    print(f"    Alternate available: {route.alternate_route_available} "
          f"({route.alternate_distance_km}km)")
    print(f"    → {route.recommendation}\n")

    # ── Step 7: Insurance triggers ─────────────────────────────
    print("▶ Step 7: Evaluating parametric insurance triggers…")
    hazard_values = {
        "surge_height":   surge.surge_height_m,
        "rainfall_total": rainfall.max_rainfall_mm_48h,
        "wind_speed":     rainfall.max_wind_speed_kmh,
    }
    records = evaluate_all_policies(DEMO_POLICIES, track.event_id, hazard_values)
    fired = [r for r in records if r.triggered]

    print(f"  ✓ {len(records)} policies evaluated | {len(fired)} triggers FIRED")
    for r in records:
        icon  = "🔴" if r.triggered else "⚪"
        label = "FIRED" if r.triggered else "not triggered"
        print(f"    {icon} {r.trigger_type:25s}: "
              f"{r.observed_value:.1f} vs threshold {r.threshold_value:.1f} — {label}")
    print()

    # ── Step 8: Build risk payload for Gemini ─────────────────
    risk_payload = {
        "ward_id":            "WARD-07",
        "ward_name":          "Ward 7, Puri District",
        "event_id":           track.event_id,
        "cyclone_name":       track.name,
        "cyclone_category":   landfall.category,
        "surge_height_m":     surge.surge_height_m,
        "rainfall_mm_48h":    rainfall.max_rainfall_mm_48h,
        "wind_speed_kmh":     rainfall.max_wind_speed_kmh,
        "runoff_risk_score":  runoff.runoff_risk_score,
        "severity_class":     runoff.severity_class,
        "population":         12000,
        "flagged_assets":     [
            {"asset_id": s.asset_id, "name": s.asset_name,
             "type": s.asset_type, "flag_reason": s.flag_reason,
             "priority_score": s.priority_score}
            for s in flagged
        ],
        "trigger_fired":      len(fired) > 0,
        "triggers_fired":     [r.trigger_type for r in fired],
    }

    # Determine severity tier
    h = surge.surge_height_m
    tier = "Watch" if h < 1.0 else "Warning" if h < 2.5 else "Evacuation Order"

    elapsed = time.monotonic() - t0

    print(f"{'='*60}")
    print(f"  PIPELINE COMPLETE in {elapsed:.2f}s")
    print(f"  Severity tier: {tier}")
    print(f"  {len(flagged)} infrastructure assets at risk")
    print(f"  {len(fired)} insurance triggers fired")
    print(f"\n  Next steps (requires API keys):")
    print(f"    • POST /advisory/generate with the risk payload → Gemini draft")
    print(f"    • POST /advisory/{{id}}/review  → human review gate")
    print(f"    • POST /advisory/{{id}}/dispatch → SMS / WhatsApp / CAP XML / PDF")
    print(f"    • POST /insurance/triggers/{{id}}/notify → insurer webhook")
    print(f"{'='*60}\n")

    return {
        "risk_payload": risk_payload,
        "severity_tier": tier,
        "triggers": [build_payout_payload(r) for r in fired],
        "elapsed_seconds": round(elapsed, 2),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cyclone Anticipatory Action Platform — Demo Runner")
    parser.add_argument("--cyclone",               default="FANI-2019",  help="FANI-2019 | MOCHA-2023")
    parser.add_argument("--district",              default="IN-OD-PURI", help="District ID")
    parser.add_argument("--hours-before-landfall", default=72, type=int, help="Forecast window in hours")
    args = parser.parse_args()

    result = run_demo(args.cyclone, args.district, args.hours_before_landfall)
    print("\nRisk payload (JSON):")
    print(json.dumps(result["risk_payload"], indent=2))
