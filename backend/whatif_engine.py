"""
backend/whatif_engine.py

Counterfactual Disaster Scenario Simulation Engine.

Allows emergency managers and GCS operators to simulate "What-If" meteorological
and hydrodynamic perturbations in real time:
  - What if central pressure drops another 15 hPa (rapid intensification)?
  - What if landfall coincides with high astronomical spring tide (+0.8m)?
  - What if the cyclone track shifts 35 km northward closer to the district capital?
  - What if rainfall intensifies by 25 mm/h over saturated catchments?

Computes the counterfactual surge height, district integrity index, evacuation
feasibility probability, and precise deltas against the active baseline state.
"""

from typing import Dict, Any, Callable
import copy


def simulate_whatif(
    current_state: Dict[str, Any],
    overrides: Dict[str, Any],
    current_lead_time: float,
    current_health: float,
    physics_model: Any,
    health_fn: Callable,
    anomaly_score: float = 0.0,
    fault_names: list = None,
) -> Dict[str, Any]:
    """
    Executes a counterfactual physical simulation.
    """
    fault_names = fault_names or []
    counterfactual = copy.deepcopy(current_state)

    # Apply operator overrides
    for k, v in overrides.items():
        if v is not None:
            counterfactual[k] = float(v)

    # 1. Re-evaluate physical surge with overridden parameters
    physics_results = physics_model.evaluate_performance(counterfactual)
    cf_surge = physics_results.get("model_surge_m", counterfactual.get("surge_height_m", 0.5))
    counterfactual["surge_height_m"] = cf_surge

    # 2. Re-evaluate health / vulnerability index
    cf_health_result = health_fn(
        data=counterfactual,
        lead_time_h=current_lead_time,
        anomaly_score=anomaly_score,
        fault_names=fault_names,
    )
    cf_health = cf_health_result["health_index"]
    cf_condition = cf_health_result["condition"]

    # 3. Calculate deltas
    base_surge = float(current_state.get("surge_height_m", 0.5))
    base_pressure = float(current_state.get("central_pressure_hpa", 1008.0))
    base_wind = float(current_state.get("max_wind_kmh", 45.0))
    base_health = float(current_health)

    cf_pressure = float(counterfactual.get("central_pressure_hpa", base_pressure))
    cf_wind = float(counterfactual.get("max_wind_kmh", base_wind))

    delta_surge = round(cf_surge - base_surge, 2)
    delta_health = round(cf_health - base_health, 1)
    delta_pressure = round(cf_pressure - base_pressure, 1)
    delta_wind = round(cf_wind - base_wind, 1)

    narrative = []
    if delta_surge > 0:
        narrative.append(f"Surge height increases by +{delta_surge:.2f}m (crest: {cf_surge:.2f}m MSL).")
    elif delta_surge < 0:
        narrative.append(f"Surge height decreases by {delta_surge:.2f}m (crest: {cf_surge:.2f}m MSL).")

    if delta_health < -5.0:
        narrative.append(f"District infrastructure integrity drops by {delta_health:.1f} points to {cf_health:.1f}/100 ({cf_condition}).")

    return {
        "status": "COMPLETED",
        "overrides": overrides,
        "current": {
            "central_pressure_hpa": base_pressure,
            "max_wind_kmh": base_wind,
            "surge_height_m": base_surge,
            "health": base_health,
        },
        "counterfactual": {
            "central_pressure_hpa": cf_pressure,
            "max_wind_kmh": cf_wind,
            "surge_height_m": cf_surge,
            "health": cf_health,
            "condition": cf_condition,
        },
        "delta": {
            "surge_height_m": delta_surge,
            "health": delta_health,
            "central_pressure_hpa": delta_pressure,
            "max_wind_kmh": delta_wind,
        },
        "narrative": " ".join(narrative) if narrative else "Counterfactual parameters result in nominal change.",
    }
