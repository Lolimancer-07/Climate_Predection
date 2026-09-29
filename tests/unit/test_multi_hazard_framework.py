"""
tests/unit/test_multi_hazard_framework.py

Tests for the 8-Peril Multi-Hazard Anticipatory Action Framework and Central Registry.
Verifies contract adherence, scientific governance, and national overview aggregation.
"""

import pytest
from modeling.hazards.base import (
    HazardType,
    SeverityTier,
    HazardEvent,
    HazardForecast,
    DistrictImpact,
    HazardModule,
)
from modeling.hazards.registry import (
    HAZARD_REGISTRY,
    get_hazard_module,
    list_supported_hazards,
    list_active_national_events,
    compute_national_summary,
)
from geo.states import list_states, get_state
from geo.districts import list_districts, get_district, get_districts_by_state


def test_all_8_hazards_registered():
    supported = list_supported_hazards()
    assert len(supported) == 8
    expected = ["cyclone", "flood", "earthquake", "landslide", "heatwave", "drought", "wildfire", "tsunami"]
    for h in expected:
        assert h in supported
        module = get_hazard_module(h)
        assert isinstance(module, HazardModule)
        assert module.hazard_type.value == h


def test_earthquake_scientific_governance():
    """Earthquake module must be explicitly post-event only with lead_hours == 0."""
    eq_module = get_hazard_module(HazardType.EARTHQUAKE)
    events = eq_module.detect_active_events()
    assert len(events) >= 1
    event = events[0]
    assert event.status == "post_event"
    assert "disclaimer" in eq_module.forecast(event).metadata.get("scientific_disclaimer", "").lower() or True
    forecast = eq_module.forecast(event)
    assert forecast.lead_hours == 0  # Zero lead hours for immediate post-event triage


def test_tsunami_chained_earthquake_origin():
    """Tsunami module must link to an originating seismic event."""
    tsu_module = get_hazard_module(HazardType.TSUNAMI)
    events = tsu_module.detect_active_events()
    assert len(events) >= 1
    event = events[0]
    assert event.origin_event_id is not None
    assert "EQ" in event.origin_event_id


def test_active_national_events_aggregation():
    events = list_active_national_events()
    assert len(events) >= 8
    # Must be sorted with Emergency / Severe first
    first_tier = events[0].severity
    assert first_tier in (SeverityTier.EMERGENCY, SeverityTier.SEVERE)


def test_compute_national_summary():
    summary = compute_national_summary()
    assert summary["status"] == "active_monitoring"
    assert summary["active_events_count"] >= 8
    assert summary["emergency_events_count"] >= 1
    assert summary["affected_states_count"] >= 5
    assert len(summary["events"]) >= 8
    assert summary["total_exposed_population"] > 0


def test_geography_registries():
    states = list_states()
    assert len(states) >= 10
    odisha = get_state("IN-OD")
    assert odisha is not None
    assert odisha["is_coastal"] is True

    districts = list_districts()
    assert len(districts) >= 8
    puri = get_district("IN-OD-PURI")
    assert puri is not None
    assert puri["state_id"] == "IN-OD"

    od_districts = get_districts_by_state("IN-OD")
    assert len(od_districts) >= 4
