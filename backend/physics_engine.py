"""
backend/physics_engine.py

Thermodynamic & Hydrodynamic Cyclone Physics Engine.

Computes theoretical physical baselines from first principles:
  1. Inverted Barometer Effect: static sea surface elevation from central pressure deficit
  2. Bathymetric Wind Setup: steady-state shelf setup across shallow continental slope
  3. Breaking Wave Setup: wave radiation stress contribution
  4. Holland Radial Wind Field Profile: theoretical radial wind distribution
  5. Physical Residuals: deviations between observed sensor telemetry and first-principles hydrodynamic physics
"""

import math
from typing import Dict, Any

try:
    from backend.engine_config import get_engine_config
except ImportError:
    try:
        from engine_config import get_engine_config
    except ImportError:
        get_engine_config = lambda: {"physics_constants": {
            "k_surge_pressure": 0.010,
            "k_shelf_amplification": 0.045,
            "k_twi_runoff": 0.082,
            "k_wave_setup": 0.18,
        }}


class CyclonePhysicsEngine:
    def __init__(self):
        pass

    def evaluate_performance(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        cfg = get_engine_config()
        consts = cfg.get("physics_constants", {})

        p_obs = float(telemetry.get("central_pressure_hpa", 1008.0))
        w_obs = float(telemetry.get("max_wind_kmh", 45.0))
        s_obs = float(telemetry.get("surge_height_m", 0.5))
        r_obs = float(telemetry.get("rainfall_rate_mmh", 2.0))
        tide_obs = float(telemetry.get("tide_height_m", 0.8))

        # 1. Inverted Barometer Sea Surface Rise (approx 1 cm per 1 hPa deficit)
        p_ambient = 1013.25
        delta_p = max(0.0, p_ambient - p_obs)
        k_ib = consts.get("k_surge_pressure", 0.010)
        surge_ib_m = delta_p * k_ib

        # 2. Bathymetric Wind Setup on Continental Shelf
        # Scales with V^2 and shallow shelf factor
        k_shelf = consts.get("k_shelf_amplification", 0.045)
        wind_mps = w_obs / 3.6
        wind_setup_m = (wind_mps ** 2) * (k_shelf / 100.0)

        # 3. Wave Setup
        hs_est_m = 0.025 * (wind_mps ** 1.3)
        wave_setup_m = hs_est_m * consts.get("k_wave_setup", 0.18)

        # Theoretical Combined Hydrodynamic Surge
        model_surge_m = round(surge_ib_m + wind_setup_m + wave_setup_m, 2)
        total_water_level_m = round(model_surge_m + tide_obs, 2)

        # 4. Holland Maximum Wind from Central Pressure Deficit (Empirical cyclostrophic balance)
        # V_max_theor ~ 3.5 * sqrt(delta_p) * 3.6 (in km/h)
        theor_wind_kmh = round(min(320.0, 3.45 * math.sqrt(max(1.0, delta_p)) * 3.6), 1)

        # 5. Physics Residuals (Observed minus Model Theoretical)
        residuals = {
            "delta_pressure_hpa": round(delta_p, 1),
            "delta_surge_m": round(s_obs - model_surge_m, 3),
            "delta_wind_kmh": round(w_obs - theor_wind_kmh, 1),
            "delta_rain_mmh": round(r_obs - (delta_p * 0.25), 1),
        }

        # Energy dissipation & mechanical power
        kinetic_energy_density_j_m3 = round(0.5 * 1.15 * (wind_mps ** 2), 1)

        return {
            "model_surge_m": model_surge_m,
            "surge_ib_m": round(surge_ib_m, 2),
            "wind_setup_m": round(wind_setup_m, 2),
            "wave_setup_m": round(wave_setup_m, 2),
            "total_water_level_m": total_water_level_m,
            "theoretical_max_wind_kmh": theor_wind_kmh,
            "kinetic_energy_density_j_m3": kinetic_energy_density_j_m3,
            "residuals": residuals,
            "basin": cfg.get("name", "Bay of Bengal"),
        }


physics_model = CyclonePhysicsEngine()
