"""
backend/mission_risk.py

Estimates the probability that the civil protection apparatus and coastal population
can complete safe evacuation and pre-landfall positioning given what we currently know
about the cyclone trajectory and infrastructure health.

The evacuation feasibility probability is a product of four independent physical components:
  P_evac_safe = P_routes × P_surge_window × P_shelter × P_environment

Each component is a probability between 0 and 1:
  P_routes   — evacuation corridor clearance (arterial roads unflooded)
  P_surge    — whether the time window before peak surge covers required evacuation duration
  P_shelter  — available cyclone shelter capacity vs exposed population
  P_env      — gale wind threshold and night-time operation stress factors

Active faults apply a multiplicative penalty on top.

Risk thresholds:
  LOW      ≥ 85%  — normal pre-landfall staging and phased voluntary evacuation
  MODERATE ≥ 65%  — advisory review: accelerate institutional evacuation
  HIGH     ≥ 40%  — high risk of corridor cutoff: issue mandatory evacuation order
  CRITICAL  < 40% — critical: imminent coastal inundation, shelter-in-place immediately
"""

import math
from typing import Dict, Any

DEFAULT_EVACUATION_HOURS = 18.0     # nominal required evacuation lead time for district
CYCLE_HOURS = 0.5                   # simulated hours per telemetry cycle


def compute_failure_probability(
    lead_time_h: float,
    is_anomaly: bool,
    anomaly_score: float,
    fault_count: int,
    health_index: float
) -> float:
    """
    Probability of coastal defense breach or corridor cutoff within next 12 hours.
    """
    if lead_time_h <= 0:
        p_lead = 0.70
    elif lead_time_h < 12.0:
        p_lead = 0.85
    elif lead_time_h < 24.0:
        p_lead = 0.45
    elif lead_time_h < 48.0:
        p_lead = 0.20
    else:
        p_lead = 0.05

    if is_anomaly:
        anomaly_contrib = max(0.0, min(0.30, -(anomaly_score) * 0.4))
    else:
        anomaly_contrib = 0.0

    fault_contrib = min(0.25, fault_count * 0.06)
    health_contrib = max(0.0, (100.0 - health_index) / 100.0) * 0.15

    p_failure = min(0.98, p_lead + anomaly_contrib + fault_contrib + health_contrib)
    return round(p_failure, 3)


def compute_mission_risk(
    data: dict,
    health_index: float,
    lead_time_h: float = 48.0,
    failure_probability: float = 0.1,
    fault_events: list = None,
    required_evacuation_h: float = DEFAULT_EVACUATION_HOURS
) -> dict:
    """
    Full district evacuation feasibility & civil protection risk assessment.

    Returns
    -------
    Dict with completion probability, risk level, safe operating time window, component breakdown.
    """
    fault_events = fault_events or []
    surge = float(data.get("surge_height_m", 0.5))
    tide = float(data.get("tide_height_m", 0.8))
    wind = float(data.get("max_wind_kmh", 45.0))
    route_depth = float(data.get("route_flood_depth_m", 0.0))
    shelter_occ = float(data.get("shelter_occupancy_pct", 25.0))
    forward_speed = float(data.get("forward_speed_kmh", 18.0))

    # P_routes — corridor passability (flooding > 0.4m halts conventional buses)
    route_stress = max(0.0, min(1.0, route_depth / 0.50))
    p_routes = max(0.05, 1.0 - (route_stress ** 1.8) * 0.90)

    # P_surge — will surge arrive before evacuation is finished?
    # Estimate arrival time of 1.5m cut-off surge:
    distance_to_landfall_km = max(10.0, lead_time_h * forward_speed)
    safe_time_h = max(0.0, (distance_to_landfall_km / max(5.0, forward_speed)) - 4.0)
    time_ratio = safe_time_h / max(1.0, required_evacuation_h)
    p_surge = min(0.999, max(0.01, 1.0 - math.exp(-time_ratio * 1.6)))

    # P_shelter — capacity margin for high-ground cyclone shelters
    shelter_stress = max(0.0, min(1.0, (shelter_occ - 50.0) / 50.0))
    p_shelter = max(0.10, 1.0 - (shelter_stress ** 2) * 0.65)

    # P_environment — gale force winds (>70 km/h) halt high-profile vehicle evacuation
    wind_stress = max(0.0, min(1.0, (wind - 60.0) / 80.0))
    p_environment = max(0.10, 1.0 - (wind_stress ** 2) * 0.85)

    # Fault penalties
    critical_faults = [f for f in fault_events if f.get("severity") == "CRITICAL"]
    warning_faults  = [f for f in fault_events if f.get("severity") == "WARNING"]
    fault_penalty = 1.0 - (len(critical_faults) * 0.14 + len(warning_faults) * 0.05)
    fault_penalty = max(0.1, fault_penalty)

    # Combined safe evacuation probability
    p_complete = p_routes * p_surge * p_shelter * p_environment * fault_penalty
    p_complete = max(0.01, min(0.999, p_complete))

    p_abort = 1.0 - p_complete
    p_critical_failure = failure_probability * (1.0 - p_routes) * 0.6

    if p_complete >= 0.85:
        risk_level = "LOW"
        risk_color = "ok"
        risk_narrative = "Evacuation feasibility is high. Coastal transit corridors clear; lead time fully covers safe shelter transit."
    elif p_complete >= 0.65:
        risk_level = "MODERATE"
        risk_color = "warn"
        risk_narrative = "Evacuation window narrowing. High-wind threshold approaching; accelerate vulnerable population movement."
    elif p_complete >= 0.40:
        risk_level = "HIGH"
        risk_color = "warn"
        risk_narrative = "Corridor cutoff risk high. Lowland routes threatening waterlogging; deploy high-clearance rescue vehicles."
    else:
        risk_level = "CRITICAL"
        risk_color = "crit"
        risk_narrative = "Evacuation feasibility critically compromised. Mandatory shelter-in-place on upper reinforced floors."

    return {
        "mission_completion_probability": round(p_complete * 100.0, 1),
        "abort_probability": round(p_abort * 100.0, 1),
        "critical_failure_probability": round(p_critical_failure * 100.0, 1),
        "safe_operating_time_h": round(safe_time_h, 2),
        "required_mission_duration_h": required_evacuation_h,
        "mission_at_risk": bool(p_complete < 0.65),
        "risk_level": risk_level,
        "risk_color": risk_color,
        "risk_narrative": risk_narrative,
        "components": {
            "route_clearance":     round(p_routes * 100.0, 1),
            "surge_arrival_window": round(p_surge * 100.0, 1),
            "shelter_capacity":    round(p_shelter * 100.0, 1),
            "environmental_load":  round(p_environment * 100.0, 1),
            "fault_penalty":       round(fault_penalty * 100.0, 1),
        }
    }
