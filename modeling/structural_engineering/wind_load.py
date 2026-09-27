"""
modeling/structural_engineering/wind_load.py
Wind drag force calculation per asset class.

Standard aerodynamic drag:
    F_wind = 0.5 * Cd * rho_air * A * V^2

All values SI. Wind speed passed in km/h, converted internally to m/s.

Reference:
    IS 875 Part 3 (Indian Wind Code), ASCE 7-22 Section 27, FEMA HAZUS-HU.
"""
from __future__ import annotations

# Air density at sea level, ISA conditions [kg/m³]
RHO_AIR = 1.225

# Drag coefficients by asset class
# Source: IS 875-3, ASCE 7-22, literature values for cylindrical/lattice structures
ASSET_DRAG_COEFFICIENTS: dict[str, float] = {
    "wood_power_pole":       1.0,   # cylindrical, single
    "concrete_power_pole":   0.8,   # smooth cylindrical
    "steel_lattice_tower":   2.0,   # open lattice, typical (ASCE 7 Table 29.4-1)
    "rcc_building":          1.3,   # flat-sided, typical block
    "masonry_building":      1.3,
    "thatched_roof_house":   1.5,   # higher — irregular surface, overhangs
    "steel_roof_building":   1.1,
    "bridge_pier":           0.7,   # rounded pier profile
    "hospital":              1.2,
    "shelter":               1.2,
    "default":               1.2,
}

# Typical frontal area [m²] per asset class for point assets
# where actual geometry is unknown. Conservative (upper-bound) estimates.
DEFAULT_FRONTAL_AREA_M2: dict[str, float] = {
    "wood_power_pole":       1.6,   # 10m pole, 0.16m diameter → 10 * 0.16
    "concrete_power_pole":   2.2,
    "steel_lattice_tower":  40.0,   # 30m tower, effective area ~40m²
    "rcc_building":         60.0,
    "masonry_building":     48.0,
    "thatched_roof_house":  20.0,
    "steel_roof_building":  50.0,
    "bridge_pier":          12.0,
    "hospital":            120.0,
    "shelter":              80.0,
    "default":              40.0,
}

# Pole/tower height [m] for moment-arm calculation
DEFAULT_HEIGHT_M: dict[str, float] = {
    "wood_power_pole":   10.0,
    "concrete_power_pole": 11.0,
    "steel_lattice_tower": 30.0,
    "rcc_building":       8.0,
    "masonry_building":   5.0,
    "thatched_roof_house": 4.0,
    "steel_roof_building": 7.0,
    "bridge_pier":        6.0,
    "hospital":          12.0,
    "shelter":            8.0,
    "default":            8.0,
}


def kmh_to_ms(speed_kmh: float) -> float:
    """Convert wind speed from km/h to m/s."""
    return speed_kmh / 3.6


def calculate_wind_force(
    wind_speed_kmh: float,
    asset_class: str,
    frontal_area_m2: float | None = None,
) -> dict:
    """
    Calculate aerodynamic drag force on an asset.

    Args:
        wind_speed_kmh: Forecast sustained 1-minute wind speed at asset location [km/h].
        asset_class: Asset type key from ASSET_DRAG_COEFFICIENTS.
        frontal_area_m2: Projected frontal area [m²]. Uses default for class if None.

    Returns:
        dict with wind_force_kn, dynamic_pressure_pa, Cd, area_m2, wind_speed_ms.
    """
    Cd = ASSET_DRAG_COEFFICIENTS.get(asset_class, ASSET_DRAG_COEFFICIENTS["default"])
    A = frontal_area_m2 or DEFAULT_FRONTAL_AREA_M2.get(
        asset_class, DEFAULT_FRONTAL_AREA_M2["default"]
    )
    V_ms = kmh_to_ms(wind_speed_kmh)

    # Dynamic pressure: q = 0.5 * rho * V^2 [Pa]
    q = 0.5 * RHO_AIR * V_ms ** 2

    # Drag force: F = Cd * q * A [N]
    F_N = Cd * q * A
    F_kN = F_N / 1_000.0

    return {
        "wind_speed_ms": round(V_ms, 2),
        "dynamic_pressure_pa": round(q, 1),
        "Cd": Cd,
        "frontal_area_m2": A,
        "wind_force_kn": round(F_kN, 3),
    }


def calculate_wind_bending_moment(
    wind_speed_kmh: float,
    asset_class: str,
    height_m: float | None = None,
    frontal_area_m2: float | None = None,
) -> dict:
    """
    Calculate bending moment at base of line asset (pole/tower).

    Assumes wind force acts at midpoint of structure height (conservative
    approximation for uniform distributed load).

    Args:
        wind_speed_kmh: Sustained wind speed [km/h].
        asset_class: Asset type key.
        height_m: Structure height [m]. Uses default if None.
        frontal_area_m2: Frontal area [m²]. Uses default if None.

    Returns:
        dict including bending_moment_knm and moment_arm_m.
    """
    h = height_m or DEFAULT_HEIGHT_M.get(asset_class, DEFAULT_HEIGHT_M["default"])
    wind = calculate_wind_force(wind_speed_kmh, asset_class, frontal_area_m2)

    # Conservative: moment arm = full height (force at top)
    moment_arm = h
    bending_moment_kNm = wind["wind_force_kn"] * moment_arm

    return {
        **wind,
        "height_m": h,
        "moment_arm_m": moment_arm,
        "bending_moment_knm": round(bending_moment_kNm, 3),
    }
