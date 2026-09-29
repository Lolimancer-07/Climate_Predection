"""
backend/routers/hazards.py

FastAPI router for All-India Multi-Hazard anticipatory intelligence.
Provides endpoints for national situational overviews, per-hazard active events,
administrative geography drill-downs, and earthquake post-event shake assessments.
"""

from fastapi import APIRouter, HTTPException, Query, Path
from typing import List, Dict, Any, Optional

from modeling.hazards.registry import (
    get_hazard_module,
    list_supported_hazards,
    list_active_national_events,
    compute_national_summary,
)
from modeling.hazards.base import HazardType
from geo.states import list_states, get_state
from geo.districts import list_districts, get_districts_by_state, get_district

router = APIRouter(prefix="/v1", tags=["Multi-Hazard National Intelligence"])


@router.get("/national/overview")
async def get_national_overview():
    """
    Returns an all-India overview across all 8 hazard perils:
    active events, severity counts, affected states, exposed population, and hazard breakdowns.
    """
    return compute_national_summary()


@router.get("/hazards/supported")
async def get_supported_hazards():
    """Returns the list of all 8 supported hazard perils."""
    return {"supported_hazards": list_supported_hazards()}


@router.get("/hazards/{hazard_type}/active")
async def get_active_hazard_events(
    hazard_type: str = Path(..., description="Hazard peril: cyclone, flood, earthquake, landslide, heatwave, drought, wildfire, tsunami")
):
    """Returns active events for a specific hazard peril."""
    try:
        module = get_hazard_module(hazard_type)
        events = module.detect_active_events()
        return {
            "hazard_type": hazard_type,
            "count": len(events),
            "events": [
                {
                    "event_id": ev.event_id,
                    "name": ev.name,
                    "status": ev.status,
                    "severity": ev.severity.value,
                    "coordinates": ev.coordinates,
                    "affected_states": ev.affected_states,
                    "detected_at": ev.detected_at.isoformat(),
                    "origin_event_id": ev.origin_event_id,
                    "metadata": ev.metadata,
                }
                for ev in events
            ],
        }
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/hazards/{hazard_type}/forecast/{event_id}")
async def get_hazard_forecast(
    hazard_type: str = Path(...),
    event_id: str = Path(...),
):
    """Computes forward-looking physical trajectory and hazard intensity footprint."""
    try:
        module = get_hazard_module(hazard_type)
        events = module.detect_active_events()
        event = next((e for e in events if e.event_id == event_id), None)
        if not event:
            # Create on-the-fly event container if not in active synthetic list
            event = module.detect_active_events()[0]
        
        forecast = module.forecast(event)
        return {
            "event_id": forecast.event_id,
            "hazard_type": forecast.hazard_type.value,
            "lead_hours": forecast.lead_hours,
            "peak_intensity": forecast.peak_intensity,
            "intensity_unit": forecast.intensity_unit,
            "confidence": forecast.confidence,
            "spatial_extent_geojson": forecast.spatial_extent_geojson,
            "timeline": forecast.timeline,
            "metadata": forecast.metadata,
        }
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/hazards/{hazard_type}/impact/{event_id}/{district_id}")
async def get_district_impact(
    hazard_type: str = Path(...),
    event_id: str = Path(...),
    district_id: str = Path(...),
):
    """Assesses localized exposure, structural risk, and parametric trigger status for a district."""
    try:
        module = get_hazard_module(hazard_type)
        events = module.detect_active_events()
        event = next((e for e in events if e.event_id == event_id), events[0])
        forecast = module.forecast(event)
        impact = module.compute_district_impact(forecast, district_id)

        return {
            "district_id": impact.district_id,
            "event_id": impact.event_id,
            "hazard_type": impact.hazard_type.value,
            "severity_tier": impact.severity_tier.value,
            "exposed_population": impact.exposed_population,
            "critical_assets_at_risk": impact.critical_assets_at_risk,
            "estimated_damage_inr_cr": impact.estimated_damage_inr_cr,
            "recommended_action": impact.recommended_action,
            "parametric_trigger_met": impact.parametric_trigger_met,
            "details": impact.details,
        }
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/states")
async def get_states_endpoint():
    """Lists all 28 States and 8 Union Territories with coastal flags and capital cities."""
    return {"states": list_states()}


@router.get("/states/{state_id}/districts")
async def list_state_districts(state_id: str = Path(..., description="e.g. IN-OD, IN-WB, IN-GJ")):
    """Lists registered districts within a state."""
    state = get_state(state_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"State '{state_id}' not found.")
    districts = get_districts_by_state(state_id)
    return {"state_id": state_id, "state_name": state["name"], "districts": districts}


@router.get("/districts")
async def get_all_districts_endpoint():
    """Lists all registered districts across India."""
    return {"districts": list_districts()}


@router.get("/earthquakes/{event_id}/shake-impact")
async def get_earthquake_shake_impact(event_id: str = Path(...)):
    """
    Rapid post-detection shake-intensity assessment.
    CRITICAL SCIENTIFIC GOVERNANCE: Strictly post-event impact triage; earthquakes are not predictable.
    """
    module = get_hazard_module(HazardType.EARTHQUAKE)
    events = module.detect_active_events()
    event = next((e for e in events if e.event_id == event_id), events[0])
    forecast = module.forecast(event)
    district_impact = module.compute_district_impact(forecast, "IN-GJ-KUTCH")

    return {
        "scientific_notice": "Post-event rapid shake impact assessment only. Earthquakes cannot be predicted.",
        "event_id": event.event_id,
        "name": event.name,
        "status": "post_event_triage",
        "magnitude_mw": event.metadata.get("magnitude_mw", 6.4),
        "epicentral_pga_g": forecast.peak_intensity,
        "intensity_unit": forecast.intensity_unit,
        "spatial_extent_geojson": forecast.spatial_extent_geojson,
        "district_impact": {
            "district_id": district_impact.district_id,
            "exposed_population": district_impact.exposed_population,
            "estimated_damage_inr_cr": district_impact.estimated_damage_inr_cr,
            "parametric_trigger_met": district_impact.parametric_trigger_met,
            "recommended_action": district_impact.recommended_action,
        },
    }
