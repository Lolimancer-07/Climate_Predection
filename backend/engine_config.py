"""
backend/engine_config.py

Centralized configuration repository for ocean basins, tropical cyclone categories,
bathymetry slope coefficients, Holland wind radius parameters, and emergency thresholds.

Allows dynamic retargeting of the Cyclone Digital Twin between different ocean basins
(e.g., Bay of Bengal, Arabian Sea, South China Sea) without modifying core code.
"""

from typing import Dict, Any, List

BASIN_REGISTRY: Dict[str, Dict[str, Any]] = {
    "BAY_OF_BENGAL": {
        "name": "Bay of Bengal Basin (North Indian Ocean)",
        "category": "Shallow Shelf / High Astronomical Tide Basin",
        "coastal_zones": ["Odisha (Puri, Jagatsinghpur)", "West Bengal (Sundarbans)", "Andhra Pradesh (Visakhapatnam)"],
        "specs": {
            "shelf_slope": 0.0012,              # 1.2m depth per 1km offshore
            "shelf_width_km": 120.0,            # Wide shallow continental shelf
            "ambient_pressure_hpa": 1013.25,
            "coriolis_f_per_s": 4.97e-5,        # 20°N latitude
            "water_density_kg_m3": 1025.0,
            "air_density_kg_m3": 1.15,
            "gravitational_accel_m_s2": 9.806,
            "holland_b_parameter": 1.35,        # Pressure profile peakedness
            "radius_max_wind_km": 42.0,
            "mean_tidal_range_m": 3.8,          # Semi-diurnal macro-tidal
            "mangrove_attenuation_per_km": 0.15 # Surge reduction per km mangrove
        },
        "physics_constants": {
            "k_surge_pressure": 0.010,          # Inverted barometer: ~1cm per 1hPa deficit
            "k_shelf_amplification": 0.045,     # Bathymetric wind setup coefficient
            "k_twi_runoff": 0.082,              # TWI to flash flood depth scaling
            "k_wave_setup": 0.18,               # Breaking wave setup fraction
        },
        "residual_thresholds": {
            "delta_pressure_hpa": 6.0,          # AWS vs Model residual tolerance
            "delta_surge_m": 0.40,              # Tide gauge vs Bathymetric surge residual
            "delta_wind_kmh": 15.0,             # Anemometer vs Holland profile residual
            "delta_rain_mmh": 12.0,             # Gauge vs GFS grid residual
        },
        "fault_thresholds": {
            "pressure_critical_hpa": 940.0,     # Very Severe Cyclonic Storm redline
            "pressure_warning_hpa": 970.0,
            "wind_critical_kmh": 175.0,         # Extremely Severe Cyclonic Storm (175 km/h)
            "wind_warning_kmh": 120.0,          # Severe Cyclonic Storm (120 km/h)
            "surge_critical_m": 3.5,            # Major seawall overtopping
            "surge_warning_m": 2.0,
            "rain_critical_mmh": 45.0,          # Cloudburst / flash flood trigger
            "rain_warning_mmh": 25.0,
            "grid_voltage_min_kv": 28.0,        # 33kV substation bus sag
            "grid_voltage_low_warn_kv": 30.5,
        }
    },
    "ARABIAN_SEA": {
        "name": "Arabian Sea Basin (Western Indian Ocean)",
        "category": "Deep Shelf / Moderate Tide Basin",
        "coastal_zones": ["Gujarat (Saurashtra, Kutch)", "Maharashtra (Konkan)", "Goa"],
        "specs": {
            "shelf_slope": 0.0055,              # Steeper shelf
            "shelf_width_km": 60.0,
            "ambient_pressure_hpa": 1012.0,
            "coriolis_f_per_s": 5.2e-5,
            "water_density_kg_m3": 1026.0,
            "air_density_kg_m3": 1.15,
            "gravitational_accel_m_s2": 9.806,
            "holland_b_parameter": 1.25,
            "radius_max_wind_km": 38.0,
            "mean_tidal_range_m": 2.1,
            "mangrove_attenuation_per_km": 0.08
        },
        "physics_constants": {
            "k_surge_pressure": 0.010,
            "k_shelf_amplification": 0.025,
            "k_twi_runoff": 0.075,
            "k_wave_setup": 0.22,
        },
        "residual_thresholds": {
            "delta_pressure_hpa": 7.0,
            "delta_surge_m": 0.35,
            "delta_wind_kmh": 18.0,
            "delta_rain_mmh": 15.0,
        },
        "fault_thresholds": {
            "pressure_critical_hpa": 945.0,
            "pressure_warning_hpa": 975.0,
            "wind_critical_kmh": 165.0,
            "wind_warning_kmh": 115.0,
            "surge_critical_m": 2.8,
            "surge_warning_m": 1.6,
            "rain_critical_mmh": 40.0,
            "rain_warning_mmh": 22.0,
            "grid_voltage_min_kv": 28.0,
            "grid_voltage_low_warn_kv": 30.5,
        }
    }
}

# Current active basin configuration
_ACTIVE_BASIN = "BAY_OF_BENGAL"


def get_active_engine_class() -> str:
    """Returns active basin class name (engine_config interface compatibility)."""
    return _ACTIVE_BASIN


def set_active_engine_class(basin_class: str) -> bool:
    """Sets active basin class."""
    global _ACTIVE_BASIN
    key = basin_class.upper().replace("-", "_")
    if key in BASIN_REGISTRY:
        _ACTIVE_BASIN = key
        return True
    return False


set_engine_class = set_active_engine_class


def list_engine_classes() -> List[str]:
    """Lists available basins."""
    return list(BASIN_REGISTRY.keys())


def get_engine_config(basin_class: str = None) -> Dict[str, Any]:
    """Returns configuration dictionary for specified or active basin."""
    target = (basin_class or _ACTIVE_BASIN).upper().replace("-", "_")
    return BASIN_REGISTRY.get(target, BASIN_REGISTRY["BAY_OF_BENGAL"])
