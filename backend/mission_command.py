"""
backend/mission_command.py

Disaster Emergency Mission Command Center Planning & Evacuation Recovery Layer.

Consumes digital-twin telemetry and physical model outputs to provide an operator-facing
evacuation recovery and resource dispatch view model:
  - Evacuation Corridors & Waypoints (Coastal ground zero -> High ground shelter hubs)
  - Designated Cyclone Shelter Sites with capacity, terrain, and safe radius
  - Multimodal Trust State: AI Anomaly vs Hydrodynamic Physics vs Sensor Trust
  - District Taskforce Relief Reassignment (Staging standby units from neighboring inland districts)
  - Conservative Simulation-Only Evacuation Plan with audit logging
"""

from __future__ import annotations

from collections import deque
from math import asin, cos, isfinite, radians, sin, sqrt
from typing import Any, Dict, Iterable, List, Optional

# Coastal transit corridor waypoints (Puri District Sector)
SIMULATED_ROUTE = [
    {"id": "COAST_ZERO",  "name": "Puri Coastal Embankment", "latitude": 19.813, "longitude": 85.831},
    {"id": "ALPHA_HUB",   "name": "Brahmagiri Transit Hub",  "latitude": 19.798, "longitude": 85.684},
    {"id": "BRAVO_HUB",   "name": "Satyabadi High-Ground",   "latitude": 19.954, "longitude": 85.823},
    {"id": "CHARLIE_HUB", "name": "Pipili Regional Center",  "latitude": 20.116, "longitude": 85.832},
    {"id": "SAFE_INLAND", "name": "Bhubaneswar Command EOC", "latitude": 20.296, "longitude": 85.824},
]

# Designated multi-purpose cyclone shelters
SIMULATED_RECOVERY_SITES = [
    {"id": "SHELTER-01", "name": "Satyabadi Cyclone Shelter",  "latitude": 19.954, "longitude": 85.823, "terrain": "reinforced concrete plinth (+6.5m MSL)"},
    {"id": "SHELTER-02", "name": "Pipili Disaster Relief Hub", "latitude": 20.116, "longitude": 85.832, "terrain": "elevated school complex (+8.0m MSL)"},
    {"id": "SHELTER-03", "name": "Delanga Multi-Purpose Hall", "latitude": 19.987, "longitude": 85.765, "terrain": "high-ground masonry plinth (+7.2m MSL)"},
]


def _number(value: Any, default: float) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if isfinite(result) else default


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _risk_color(risk_level: str) -> str:
    return {
        "LOW": "ok",
        "MODERATE": "warn",
        "HIGH": "warn",
        "CRITICAL": "crit",
    }.get(risk_level, "warn")


def _haversine_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    earth_radius_km = 6371.0
    lat_delta = radians(lat_b - lat_a)
    lon_delta = radians(lon_b - lon_a)
    a = (
        sin(lat_delta / 2) ** 2
        + cos(radians(lat_a)) * cos(radians(lat_b)) * sin(lon_delta / 2) ** 2
    )
    return earth_radius_km * 2 * asin(sqrt(a))


def _current_position(data: Dict[str, Any]) -> Dict[str, float]:
    return {
        "latitude": round(_number(data.get("latitude"), 19.813), 5),
        "longitude": round(_number(data.get("longitude"), 85.831), 5),
        "mission_progress_pct": round(_clamp(_number(data.get("mission_progress_pct"), 45.0), 0.0, 100.0), 1),
        "heading_deg": round(_number(data.get("heading_deg"), 340.0), 0),
        "ground_speed_kts": round(max(0.0, _number(data.get("ground_speed_kts"), 32.0)), 1),
    }


def build_recovery_plan(
    data: Dict[str, Any],
    mission_risk: Optional[Dict[str, Any]],
    health: Optional[Dict[str, Any]],
    fault_events: Optional[Iterable[Dict[str, Any]]],
    optimize_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    mission_risk = mission_risk or {}
    health = health or {}
    optimize_result = optimize_result or {}
    fault_events = list(fault_events or [])

    surge = _number(data.get("surge_height_m"), 1.2)
    wind = _number(data.get("max_wind_kmh"), 85.0)
    risk_level = str(mission_risk.get("risk_level", "MODERATE")).upper()
    completion_probability = _number(mission_risk.get("mission_completion_probability"), 65.0)
    health_index = _number(health.get("health_index"), 75.0)
    fault_names = [str(fault.get("name", "fault")).replace("_", " ") for fault in fault_events]

    requires_recovery = risk_level in {"HIGH", "CRITICAL"} or surge >= 2.5 or wind >= 130.0

    if requires_recovery:
        action = "MANDATORY EVACUATION & SHELTER LOCKDOWN" if risk_level == "CRITICAL" else "ACCELERATE EVACUATION CONVOYS"
        decision = "IMMEDIATE EVACUATION ACTION REQUIRED"
        rationale = "Extreme storm surge wave setup or barometric intensification requires immediate population relocation to high ground."
    elif risk_level == "MODERATE" or health_index < 75.0:
        action = "STAGE LOGISTICS & MOBILIZE FLEET"
        decision = "ADVISORY STAGING REVIEW"
        rationale = "Conditions permit orderly pre-positioning before high winds halt transit."
    else:
        action = "MAINTAIN ANTICIPATORY MONITORING"
        decision = "CONTINUE STANDARD WATCH"
        rationale = "Current meteorological and infrastructure evidence supports the active baseline posture."

    evidence = []
    if fault_names:
        evidence.append(f"Active disaster hazards: {', '.join(fault_names[:2])}.")
    if surge >= 2.5:
        evidence.append(f"Surge height projected at +{surge:.1f}m MSL, exceeding coastal road freeboard.")
    if completion_probability < 65.0:
        evidence.append(f"Evacuation feasibility probability is {completion_probability:.1f}%.")
    if not evidence:
        evidence.append("No active hazard condition threatens the primary coastal transit corridor.")

    return {
        "decision": decision,
        "action": action,
        "requires_operator_approval": bool(requires_recovery),
        "execution_mode": "SIMULATION_ONLY",
        "rationale": rationale,
        "evidence": evidence,
        "parameters": {
            "target_dispatch_rate_bph": optimize_result.get("optimal_dispatch_rate_bph", 40),
            "safe_window_h": mission_risk.get("safe_operating_time_h", 12.0),
        },
    }


def _recovery_sites(position: Dict[str, float], safe_operating_time_h: float) -> List[Dict[str, Any]]:
    safe_radius_km = max(15.0, safe_operating_time_h * 35.0)
    sites = []
    for site in SIMULATED_RECOVERY_SITES:
        dist_km = _haversine_km(position["latitude"], position["longitude"], site["latitude"], site["longitude"])
        suitability = max(20.0, 100.0 - (dist_km / max(1.0, safe_radius_km)) * 50.0)
        sites.append({
            **site,
            "distance_nm": round(dist_km * 0.539957, 1),
            "distance_km": round(dist_km, 1),
            "suitability_score": round(suitability, 0),
            "within_safe_radius": bool(dist_km <= safe_radius_km),
        })
    return sorted(sites, key=lambda item: -item["suitability_score"])


def _trust_state(
    twin_consistency: Dict[str, Any],
    sensor_integrity: Dict[str, Any],
    telemetry_integrity: Dict[str, Any],
    is_anomaly: bool,
    fault_events: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    twin_score = _clamp(_number(twin_consistency.get("consistency_score"), 75.0), 0.0, 100.0)
    sensor_score = _clamp(_number(sensor_integrity.get("integrity_score"), 85.0), 0.0, 100.0)
    telemetry_score = _clamp(_number(telemetry_integrity.get("integrity_score"), 95.0), 0.0, 100.0)
    confidence = 0.50 * twin_score + 0.30 * sensor_score + 0.20 * telemetry_score

    label = "HIGH CONFIDENCE" if confidence >= 85.0 else ("REVIEW EVIDENCE" if confidence >= 65.0 else "LIMITED CONFIDENCE")
    case_label = str(twin_consistency.get("case_label", "AWAITING VALIDATION")).replace("_", " ")

    evidence = [
        {"source": "Multimodal Hazard AI", "state": "ANOMALY TRIP" if is_anomaly else "NOMINAL"},
        {"source": "Hydrodynamic Surge Physics", "state": case_label},
        {"source": "AWS & Gauge Sensor Integrity", "state": f"{sensor_score:.0f}% trusted"},
        {"source": "Telemetry Stream Jitter", "state": f"{telemetry_score:.0f}% trusted"},
    ]

    return {
        "confidence": round(confidence, 1),
        "label": label,
        "twin_score": round(twin_score, 1),
        "sensor_score": round(sensor_score, 1),
        "telemetry_score": round(telemetry_score, 1),
        "evidence": evidence,
    }


def _fleet_reassignment(fleet_status: Iterable[Dict[str, Any]], active_district_id: str, mission_at_risk: bool) -> Dict[str, Any]:
    ranked = []
    for district in fleet_status or []:
        if district.get("district_id") == active_district_id:
            continue
        health = _clamp(_number(district.get("health"), 0.0), 0.0, 100.0)
        evac_prob = _clamp(_number(district.get("evacuation_probability"), 0.0), 0.0, 100.0)
        readiness = round(health * 0.60 + evac_prob * 0.40, 0)
        ranked.append({**district, "readiness_score": readiness})

    ranked.sort(key=lambda d: d["readiness_score"], reverse=True)
    candidate = ranked[0] if ranked else None
    required = bool(mission_at_risk and candidate and candidate["readiness_score"] >= 65.0)

    return {
        "required": required,
        "candidate": candidate,
        "alternates": ranked[1:3],
        "recommendation": f"Stage disaster response taskforce from {candidate.get('name', 'Inland Base')} to support {active_district_id}." if candidate else "No standby units available.",
    }


def build_simulation_summary(
    plan: Dict[str, Any],
    whatif_result: Optional[Dict[str, Any]],
    baseline_mission_risk: Optional[Dict[str, Any]],
    projected_mission_risk: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not whatif_result:
        return None

    baseline_prob = _number(baseline_mission_risk.get("mission_completion_probability"), 54.0)
    projected_prob = _number(projected_mission_risk.get("mission_completion_probability"), baseline_prob)

    return {
        "plan_action": plan.get("action", "EVACUATION REVIEW"),
        "baseline_completion_probability": round(baseline_prob, 1),
        "projected_completion_probability": round(projected_prob, 1),
        "probability_delta": round(projected_prob - baseline_prob, 1),
        "status": "SIMULATED",
    }


class MissionCommandController:
    def __init__(self, max_events: int = 24):
        self._events: deque[Dict[str, Any]] = deque(maxlen=max_events)
        self._last_signatures: Dict[str, str] = {}
        self._next_id = 1

    def reset(self) -> None:
        self._events.clear()
        self._last_signatures.clear()
        self._next_id = 1

    def _record(self, event_type: str, severity: str, message: str, cycle: Any, signature: str) -> None:
        if self._last_signatures.get(event_type) == signature:
            return
        self._last_signatures[event_type] = signature
        self._events.appendleft({
            "id": f"MC-{self._next_id:03d}",
            "cycle": int(_number(cycle, 0.0)),
            "type": event_type,
            "severity": severity,
            "message": message,
        })
        self._next_id += 1

    def observe(
        self,
        cycle: Any,
        alert: Any,
        mission_risk: Optional[Dict[str, Any]],
        twin_consistency: Optional[Dict[str, Any]],
        fault_events: Optional[Iterable[Dict[str, Any]]],
    ) -> None:
        mission_risk = mission_risk or {}
        twin_consistency = twin_consistency or {}
        fault_events = list(fault_events or [])
        risk_level = str(mission_risk.get("risk_level", "MODERATE")).upper()
        probability = _number(mission_risk.get("mission_completion_probability"), 0.0)

        self._record(
            "MISSION_STATUS",
            "CRITICAL" if risk_level == "CRITICAL" else ("WARNING" if risk_level in {"HIGH", "MODERATE"} else "INFO"),
            f"Evacuation feasibility is {risk_level} ({probability:.1f}% completion probability).",
            cycle,
            f"{risk_level}:{round(probability)}",
        )

        fault_names = ", ".join(sorted(str(fault.get("name", "fault")) for fault in fault_events))
        if fault_names:
            self._record(
                "FAULT_DETECTED",
                "CRITICAL" if alert == "CRITICAL" else "WARNING",
                f"Cyclone twin detected: {fault_names.replace('_', ' ')}.",
                cycle,
                f"{alert}:{fault_names}",
            )

    def record_action(self, cycle: Any, event_type: str, message: str) -> None:
        severity = "INFO" if event_type == "PLAN_APPROVED" else "WARNING"
        self._record(event_type, severity, message, cycle, f"{event_type}:{message}:{cycle}")

    def events(self) -> List[Dict[str, Any]]:
        return list(self._events)


def build_mission_command_state(
    data: Dict[str, Any],
    mission_risk: Optional[Dict[str, Any]],
    health: Optional[Dict[str, Any]],
    twin_consistency: Optional[Dict[str, Any]],
    sensor_integrity: Optional[Dict[str, Any]],
    telemetry_integrity: Optional[Dict[str, Any]],
    fault_events: Optional[Iterable[Dict[str, Any]]],
    fleet_status: Optional[Iterable[Dict[str, Any]]],
    is_anomaly: bool = False,
    optimize_result: Optional[Dict[str, Any]] = None,
    action_state: Optional[Dict[str, Any]] = None,
    timeline: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    position = _current_position(data)
    plan = build_recovery_plan(data, mission_risk, health, fault_events, optimize_result)
    safe_operating_time_h = max(0.0, _number(mission_risk.get("safe_operating_time_h"), 12.0))
    sites = _recovery_sites(position, safe_operating_time_h)

    action_state = action_state or {}
    active_plan = action_state.get("plan") or plan

    action = {
        "action_id": action_state.get("action_id", "RECOVERY-PLAN"),
        "status": action_state.get("status", "READY"),
        "execution_mode": "SIMULATION_ONLY",
        "plan": active_plan,
        "simulation": action_state.get("simulation"),
        "approved_cycle": action_state.get("approved_cycle"),
    }

    return {
        "schema_version": "1.0",
        "mode": "DISASTER_EVACUATION_CORRIDOR",
        "mission": {
            "completion_probability": round(_number(mission_risk.get("mission_completion_probability"), 85.0), 1),
            "risk_level": str(mission_risk.get("risk_level", "UNKNOWN")),
            "risk_color": _risk_color(str(mission_risk.get("risk_level", "UNKNOWN")).upper()),
            "safe_operating_time_h": round(safe_operating_time_h, 2),
            "narrative": mission_risk.get("risk_narrative", "Awaiting evacuation risk analysis."),
        },
        "route": {
            "label": "COASTAL EVACUATION CORRIDOR",
            "is_simulated": True,
            "position": position,
            "waypoints": SIMULATED_ROUTE,
            "safe_radius_nm": round(safe_operating_time_h * 20.0, 1),
            "recovery_sites": sites,
        },
        "trust": _trust_state(twin_consistency, sensor_integrity, telemetry_integrity, is_anomaly, fault_events),
        "fleet_reassignment": _fleet_reassignment(fleet_status or [], str(data.get("district_id", "IN-OD-PURI")), bool(mission_risk.get("mission_at_risk"))),
        "action": action,
        "timeline": list(timeline or []),
        "disclaimer": "Decision support only. Evacuation directives remain simulation-only until confirmed by Human-In-The-Loop disaster controller.",
    }
