"""
backend/health_index.py

Computes the overall District Infrastructure & Vulnerability Health Index (0–100)
and breaks it down into subsystem scores so the disaster operator can see
precisely *where* the vulnerability bottleneck is.

Subsystems tracked:
  - Coastal Defense  (seawall crest freeboard, dike integrity, mangrove attenuation)
  - Drainage Network (stormwater culvert capacity, TWI soil saturation, runoff discharge)
  - Power Grid       (substation bus voltage, 33kV line hardening, ADG fuel availability)
  - Shelter Network  (multipurpose cyclone shelter capacity, generator backup, water filtration)
  - Communications   (VHF/satellite repeater reliability, mobile tower wind resistance)
  - Evacuation Route (primary arterial corridor clearance, bridge approach stability)

The score uses EWMA smoothing (alpha = 0.20) because coastal infrastructure and hydrological
systems possess physical inertia — you don't want the integrity index oscillating on momentary sensor jitter.
"""

from typing import Dict, List, Any


MAX_LEAD_TIME_H = 72.0

CONDITION_BANDS = [
    (80.0, "EXCELLENT"),
    (60.0, "NOMINAL"),
    (40.0, "DEGRADED"),
    (20.0, "POOR"),
    ( 0.0, "CRITICAL"),
]

# EMA state — persists between calls so smoothing works correctly across telemetry packets
_last_health_state = {
    "composite": 92.0,
    "coastal_defense": 90.0,
    "drainage": 88.0,
    "power_grid": 94.0,
    "shelter_network": 96.0,
    "communications": 95.0,
    "evacuation_routes": 91.0,
}


def reset_health_state(initial_health: float = 95.0):
    global _last_health_state
    _last_health_state = {
        "composite": initial_health,
        "coastal_defense": initial_health,
        "drainage": initial_health,
        "power_grid": initial_health,
        "shelter_network": initial_health,
        "communications": initial_health,
        "evacuation_routes": initial_health,
    }


def compute_health_index(
    data: dict,
    lead_time_h: float = 48.0,
    anomaly_score: float = 0.0,
    fault_names: List[str] = None,
) -> dict:
    """
    Weighted multi-subsystem district integrity index with EWMA smoothing.
    Alpha = 0.20 — reflecting physical hydraulic and structural damping.
    """
    global _last_health_state
    fault_names = fault_names or []

    # 1. Coastal defense score: surge vs seawall crest (nominal freeboard > 2.0m)
    surge = float(data.get('surge_height_m', 0.5))
    tide = float(data.get('tide_height_m', 0.8))
    total_water_level = surge + tide
    if total_water_level <= 1.5:
        defense_score = 100.0
    elif total_water_level >= 4.5:
        defense_score = 0.0
    else:
        defense_score = max(0.0, 100.0 - (total_water_level - 1.5) * 33.3)

    # 2. Drainage score: rainfall rate & TWI saturation
    rain = float(data.get('rainfall_rate_mmh', 2.0))
    twi_sat = float(data.get('twi_saturation', 0.40))
    rain_score = 100.0 if rain <= 10.0 else max(0.0, 100.0 - (rain - 10.0) * 2.2)
    sat_score = 100.0 if twi_sat <= 0.60 else max(0.0, 100.0 - (twi_sat - 0.60) * 200.0)
    raw_drainage = rain_score * 0.55 + sat_score * 0.45

    # 3. Power grid: wind speed vs tower design threshold (design: 180 km/h) & voltage
    wind = float(data.get('max_wind_kmh', 45.0))
    volt = float(data.get('grid_voltage_kv', 33.0))
    wind_stress = 100.0 if wind <= 80.0 else max(0.0, 100.0 - (wind - 80.0) * 0.85)
    volt_stress = 100.0 if volt >= 31.0 else max(0.0, (volt - 25.0) / 6.0 * 100.0)
    raw_power = wind_stress * 0.70 + volt_stress * 0.30

    # 4. Evacuation routes: flood depth on primary arterial corridors
    route_flood = float(data.get('route_flood_depth_m', 0.0))
    raw_routes = 100.0 if route_flood <= 0.10 else max(0.0, 100.0 - (route_flood - 0.10) * 180.0)

    # 5. Shelter network: occupancy & structural readiness
    occupancy = float(data.get('shelter_occupancy_pct', 25.0))
    raw_shelter = 100.0 if occupancy <= 75.0 else max(20.0, 100.0 - (occupancy - 75.0) * 3.0)

    # 6. Communications: cell tower & VHF repeater status
    comm_avail = float(data.get('comm_availability_pct', 98.0))
    raw_comm = min(100.0, max(0.0, comm_avail))

    # Anomaly penalty
    anomaly_norm = min(100.0, max(0.0, (anomaly_score + 0.20) / 0.35 * 100.0))

    # Weighted composite index
    raw_composite = (
        defense_score * 0.30 +
        raw_drainage  * 0.20 +
        raw_power     * 0.15 +
        raw_routes    * 0.15 +
        raw_shelter   * 0.10 +
        raw_comm      * 0.05 +
        anomaly_norm  * 0.05
    )

    # Active critical faults get a hard penalty
    critical_faults = {"BAROMETRIC_ANOMALY", "EXTREME_SURGE_RISK", "RAPID_INTENSIFICATION", "COASTAL_DIKE_OVERTOPPING"}
    for f in fault_names:
        if f in critical_faults:
            raw_composite -= 16.0
        else:
            raw_composite -= 5.0

    raw_composite = max(0.0, min(100.0, raw_composite))

    # EWMA smoothing — alpha=0.20 means each new reading has 20% influence
    alpha = 0.20
    smooth_composite = (alpha * raw_composite) + ((1.0 - alpha) * _last_health_state["composite"])
    smooth_defense   = (alpha * defense_score) + ((1.0 - alpha) * _last_health_state["coastal_defense"])
    smooth_drainage  = (alpha * raw_drainage)  + ((1.0 - alpha) * _last_health_state["drainage"])
    smooth_power     = (alpha * raw_power)     + ((1.0 - alpha) * _last_health_state["power_grid"])
    smooth_routes    = (alpha * raw_routes)    + ((1.0 - alpha) * _last_health_state["evacuation_routes"])
    smooth_shelter   = (alpha * raw_shelter)   + ((1.0 - alpha) * _last_health_state["shelter_network"])
    smooth_comm      = (alpha * raw_comm)      + ((1.0 - alpha) * _last_health_state["communications"])

    _last_health_state = {
        "composite": smooth_composite,
        "coastal_defense": smooth_defense,
        "drainage": smooth_drainage,
        "power_grid": smooth_power,
        "evacuation_routes": smooth_routes,
        "shelter_network": smooth_shelter,
        "communications": smooth_comm,
    }

    condition = "CRITICAL"
    for threshold, label in CONDITION_BANDS:
        if smooth_composite >= threshold:
            condition = label
            break

    # Physical breach / infrastructure failure probability
    p_fail_raw = max(0.0, (100.0 - smooth_composite) / 100.0) ** 1.35
    p_fail_raw = min(0.98, p_fail_raw)

    return {
        "health_index": round(smooth_composite, 1),
        "condition": condition,
        "failure_probability": round(p_fail_raw, 3),
        "sub_scores": {
            "coastal_defense":   round(smooth_defense, 1),
            "drainage":          round(smooth_drainage, 1),
            "power_grid":        round(smooth_power, 1),
            "evacuation_routes": round(smooth_routes, 1),
            "shelter_network":   round(smooth_shelter, 1),
            "communications":    round(smooth_comm, 1),
            "anomaly":           round(anomaly_norm, 1),
        }
    }
