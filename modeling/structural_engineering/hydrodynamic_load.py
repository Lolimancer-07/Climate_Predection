"""
modeling/structural_engineering/hydrodynamic_load.py
Surge hydrodynamic force and hydrostatic pressure on structures.

Hydrodynamic force (debris-laden flow):
    F_surge = 0.5 * Cd_water * rho_water * A_submerged * V_flow^2

Hydrostatic pressure on submerged wall:
    P_hydrostatic = rho_water * g * h_water

References:
    FEMA P-646 (2019) Guidelines for Design of Structures for Vertical Evacuation
    ASCE 7-22 Chapter 6 (Tsunami Loads — analogous methodology for surge)
    IS 1893 Part 2 (Hydrodynamic loading considerations)
"""
from __future__ import annotations
import math

# Water density (saline storm surge, slightly higher than freshwater) [kg/m³]
RHO_WATER = 1_025.0

# Standard gravity [m/s²]
G = 9.81

# Hydrodynamic drag coefficient for surge (typically 2.0 for buildings, 1.2 for piers)
CD_WATER: dict[str, float] = {
    "wood_power_pole":       1.2,
    "concrete_power_pole":   1.0,
    "steel_lattice_tower":   1.5,
    "rcc_building":          2.0,
    "masonry_building":      2.0,
    "thatched_roof_house":   2.5,   # poorly anchored → higher effective Cd
    "steel_roof_building":   1.8,
    "bridge_pier":           0.8,
    "hospital":              2.0,
    "shelter":               1.8,
    "default":               2.0,
}

# Default submerged frontal width [m] (cross-section perpendicular to flow)
DEFAULT_SUBMERGED_WIDTH_M: dict[str, float] = {
    "wood_power_pole":       0.2,
    "concrete_power_pole":   0.25,
    "steel_lattice_tower":   1.0,
    "rcc_building":          8.0,
    "masonry_building":      6.0,
    "thatched_roof_house":   5.0,
    "steel_roof_building":   8.0,
    "bridge_pier":           2.0,
    "hospital":             15.0,
    "shelter":              10.0,
    "default":               6.0,
}


def surge_flow_velocity(surge_height_m: float, terrain_slope: float = 0.005) -> float:
    """
    Estimate surge bore velocity from surge height and terrain slope.

    Uses Manning-equation-derived approximation for shallow overland flow:
        V ≈ sqrt(2 * g * h * slope_factor)

    Args:
        surge_height_m: Peak inundation depth at asset location [m].
        terrain_slope: Dimensionless terrain slope (rise/run). Typically 0.001-0.01.

    Returns:
        Estimated flow velocity [m/s].
    """
    # Simplified bore velocity: conservative upper bound
    V = math.sqrt(2.0 * G * surge_height_m)
    # Apply slope damping (steeper slope → flow dissipates faster)
    slope_factor = max(0.3, 1.0 - terrain_slope * 50)
    return round(V * slope_factor, 2)


def calculate_surge_force(
    surge_height_m: float,
    asset_class: str,
    submerged_width_m: float | None = None,
    terrain_slope: float = 0.005,
) -> dict:
    """
    Calculate hydrodynamic surge force on a structure.

    Args:
        surge_height_m: Inundation depth at asset location [m].
        asset_class: Asset type key from CD_WATER.
        submerged_width_m: Width of structure face perpendicular to flow [m].
        terrain_slope: Local terrain slope (dimensionless).

    Returns:
        dict with surge_force_kn, V_flow_ms, submerged_area_m2, Cd_water.
    """
    if surge_height_m <= 0.0:
        return {
            "surge_height_m": 0.0,
            "V_flow_ms": 0.0,
            "Cd_water": CD_WATER.get(asset_class, CD_WATER["default"]),
            "submerged_area_m2": 0.0,
            "surge_force_kn": 0.0,
            "hydrostatic_force_kn": 0.0,
            "total_surge_load_kn": 0.0,
        }

    Cd = CD_WATER.get(asset_class, CD_WATER["default"])
    W = submerged_width_m or DEFAULT_SUBMERGED_WIDTH_M.get(
        asset_class, DEFAULT_SUBMERGED_WIDTH_M["default"]
    )

    V_flow = surge_flow_velocity(surge_height_m, terrain_slope)
    A_sub = surge_height_m * W  # submerged frontal area [m²]

    # Hydrodynamic drag force [N]
    F_hydro_N = 0.5 * Cd * RHO_WATER * A_sub * V_flow ** 2
    F_hydro_kN = F_hydro_N / 1_000.0

    # Hydrostatic (buoyancy/lateral pressure) force at base [N] — triangular distribution
    # F_hydrostatic = 0.5 * rho * g * h^2 * W
    F_hydrostatic_N = 0.5 * RHO_WATER * G * surge_height_m ** 2 * W
    F_hydrostatic_kN = F_hydrostatic_N / 1_000.0

    return {
        "surge_height_m": surge_height_m,
        "V_flow_ms": V_flow,
        "Cd_water": Cd,
        "submerged_area_m2": round(A_sub, 2),
        "surge_force_kn": round(F_hydro_kN, 3),
        "hydrostatic_force_kn": round(F_hydrostatic_kN, 3),
        "total_surge_load_kn": round(F_hydro_kN + F_hydrostatic_kN, 3),
    }


def calculate_hydrostatic_pressure(surge_height_m: float) -> dict:
    """
    Calculate hydrostatic pressure at base of a wall.

    Args:
        surge_height_m: Water depth [m].

    Returns:
        dict with pressure at base [kPa] and average pressure [kPa].
    """
    P_base_pa = RHO_WATER * G * surge_height_m
    P_average_pa = P_base_pa / 2.0   # triangular distribution

    return {
        "water_depth_m": surge_height_m,
        "pressure_at_base_kpa": round(P_base_pa / 1_000.0, 3),
        "average_pressure_kpa": round(P_average_pa / 1_000.0, 3),
    }
