"""
modeling/structural_engineering/structural_check.py
Structural capacity checks for line assets (power poles, transmission towers)
and building assets under combined wind and surge loading.

Line asset check — bending moment vs section modulus:
    safety_factor = M_capacity / M_applied

Building check — total lateral force vs shear wall capacity.

Material capacity values sourced from:
    IS 883 (timber), IS 1786 (steel), IS 456 (concrete), IS 800 (steel structures)
    FEMA HAZUS-HU MH 5.0 Technical Manual Table 4.7
"""
from __future__ import annotations

from .wind_load import calculate_wind_bending_moment
from .hydrodynamic_load import calculate_surge_force


# ── Material capacity lookup ─────────────────────────────────────────────────

# Moment capacity [kN·m] — at-base section for typical pole/tower per class
# Source: IS 883, IS 1786, manufacturer specs (conservative estimates)
MOMENT_CAPACITY_KNM: dict[str, float] = {
    "wood_power_pole":        15.0,   # 11m class pole, IS 883
    "concrete_power_pole":    45.0,   # PCC pole, IS 1678
    "steel_lattice_tower":  2_500.0,  # 33kV double-circuit lattice tower
    "default":               20.0,
}

# Lateral shear capacity [kN] for building types (whole-structure)
# Source: HAZUS-HU Table 4.7, IS 4326
SHEAR_CAPACITY_KN: dict[str, float] = {
    "rcc_building":          500.0,   # properly reinforced RCC frame
    "masonry_building":       80.0,   # unreinforced masonry, very vulnerable
    "thatched_roof_house":    12.0,   # non-engineered, lowest capacity
    "steel_roof_building":   250.0,
    "hospital":              600.0,   # higher — presumed engineered to hospital design code
    "shelter":               350.0,  # multi-purpose cyclone shelter, IS 4326
    "default":               100.0,
}


def check_pole_safety_factor(
    wind_speed_kmh: float,
    surge_height_m: float,
    asset_class: str,
    height_m: float | None = None,
    frontal_area_m2: float | None = None,
    moment_capacity_knm: float | None = None,
) -> dict:
    """
    Compute safety factor for a line asset (pole or tower) under combined loading.

    Safety factor < 1.0 indicates likely structural failure.
    Safety factor < 1.5 indicates reinforcement is advisable pre-landfall.

    Args:
        wind_speed_kmh: Forecast 1-min sustained wind speed at asset [km/h].
        surge_height_m: Modeled inundation depth at asset location [m].
        asset_class: Asset type from MOMENT_CAPACITY_KNM.
        height_m: Pole/tower height [m] (uses default for class if None).
        frontal_area_m2: Frontal area [m²] (uses default if None).
        moment_capacity_knm: Structural moment capacity [kN·m] (uses lookup if None).

    Returns:
        dict with safety_factor, wind_moment_knm, surge_moment_knm, applied_moment_knm,
        capacity_knm, and failure_mode flags.
    """
    # Wind bending moment at base
    wind = calculate_wind_bending_moment(wind_speed_kmh, asset_class, height_m, frontal_area_m2)
    M_wind = wind["bending_moment_knm"]

    # Surge bending moment at base (surge force acts at surge_height/2 from base)
    surge = calculate_surge_force(surge_height_m, asset_class)
    h_surge_arm = surge_height_m / 2.0 if surge_height_m > 0 else 0.0
    M_surge = surge["total_surge_load_kn"] * h_surge_arm

    M_applied = M_wind + M_surge
    M_capacity = moment_capacity_knm or MOMENT_CAPACITY_KNM.get(
        asset_class, MOMENT_CAPACITY_KNM["default"]
    )

    safety_factor = M_capacity / M_applied if M_applied > 0 else 999.0

    return {
        "asset_class": asset_class,
        "wind_speed_kmh": wind_speed_kmh,
        "surge_height_m": surge_height_m,
        "wind_moment_knm": round(M_wind, 3),
        "surge_moment_knm": round(M_surge, 3),
        "applied_moment_knm": round(M_applied, 3),
        "capacity_knm": round(M_capacity, 1),
        "safety_factor": round(safety_factor, 3),
        "likely_failure": safety_factor < 1.0,
        "reinforcement_advisable": safety_factor < 1.5,
    }


def check_building_safety_factor(
    wind_speed_kmh: float,
    surge_height_m: float,
    asset_class: str,
    frontal_area_m2: float | None = None,
    shear_capacity_kn: float | None = None,
) -> dict:
    """
    Compute safety factor for a building under combined wind and surge lateral loads.

    Args:
        wind_speed_kmh: Forecast wind speed [km/h].
        surge_height_m: Inundation depth [m].
        asset_class: Building type.
        frontal_area_m2: Frontal area [m²].
        shear_capacity_kn: Lateral capacity [kN] (uses lookup if None).

    Returns:
        dict with safety_factor and applied_force_kn.
    """
    wind = calculate_wind_bending_moment(wind_speed_kmh, asset_class, None, frontal_area_m2)
    F_wind = wind["wind_force_kn"]

    surge = calculate_surge_force(surge_height_m, asset_class)
    F_surge = surge["total_surge_load_kn"]

    F_applied = F_wind + F_surge
    F_capacity = shear_capacity_kn or SHEAR_CAPACITY_KN.get(
        asset_class, SHEAR_CAPACITY_KN["default"]
    )

    safety_factor = F_capacity / F_applied if F_applied > 0 else 999.0

    return {
        "asset_class": asset_class,
        "wind_speed_kmh": wind_speed_kmh,
        "surge_height_m": surge_height_m,
        "wind_force_kn": round(F_wind, 3),
        "surge_force_kn": round(F_surge, 3),
        "applied_force_kn": round(F_applied, 3),
        "capacity_kn": round(F_capacity, 1),
        "safety_factor": round(safety_factor, 3),
        "likely_failure": safety_factor < 1.0,
        "reinforcement_advisable": safety_factor < 1.5,
    }
