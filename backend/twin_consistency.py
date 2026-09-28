"""
backend/twin_consistency.py

Cross-validates AI Multimodal Hazard Models against First-Principles Hydrodynamic Surge Physics.
Produces four deterministic consistency cases (Case A, B, C, D) used to evaluate
system trust and detect sensor drift versus genuine disaster intensification.

Cases:
  Case A: AI Anomaly [YES] + Physics Residual [HIGH]
          --> Confirmed Severe Hydrodynamic Hazard (Both ML and physical models agree on extreme threat)
  Case B: AI Anomaly [YES] + Physics Residual [LOW]
          --> Atmospheric / Environmental Drift (AI flags risk pattern before surge setup reaches peak)
  Case C: AI Anomaly [NO]  + Physics Residual [HIGH]
          --> Physical Surge Inundation Precursor (Tide gauge / pressure delta indicates rapid sea rise)
  Case D: AI Anomaly [NO]  + Physics Residual [LOW]
          --> Nominal Anticipatory State (All subsystems aligned within calibrated baseline)
"""

from typing import Dict, Any


def compute_twin_consistency(
    is_anomaly: bool,
    anomaly_score: float,
    physics_residuals: Dict[str, float],
    sensor_integrity_score: float = 100.0,
) -> Dict[str, Any]:
    """
    Evaluates cross-validation consistency between AI models and hydrodynamic physics.
    """
    delta_surge = abs(physics_residuals.get("delta_surge_m", 0.0))
    delta_wind = abs(physics_residuals.get("delta_wind_kmh", 0.0))

    # Threshold for physical model residual trip
    physics_diverged = delta_surge > 0.40 or delta_wind > 20.0

    if is_anomaly and physics_diverged:
        case = "A"
        case_label = "CONFIRMED_SEVERE_HAZARD"
        description = "Both AI anomaly detection and first-principles hydrodynamic surge physics detect severe hazard escalation."
        consistency_score = 95.0
        recommendation = "Full emergency mobilization. Issue mandatory coastal evacuation order."

    elif is_anomaly and not physics_diverged:
        case = "B"
        case_label = "ENVIRONMENTAL_DRIFT_PRECURSOR"
        description = "AI multivariate model detects rapid track intensification pattern; hydrodynamic surge setup is currently developing."
        consistency_score = 82.0
        recommendation = "Maintain elevated readiness. Accelerate institutional pre-positioning before physical surge crest."

    elif not is_anomaly and physics_diverged:
        case = "C"
        case_label = "HYDRODYNAMIC_SURGE_PRECURSOR"
        description = "Physical tide gauge and barometric deficit residuals exceed normal tolerance; possible unmodeled tidal resonance."
        consistency_score = 68.0
        recommendation = "Inspect coastal gauge calibration. Alert sluice gate operators to verify gravity back-flow prevention."

    else:
        case = "D"
        case_label = "NOMINAL_ANTICIPATORY_STATE"
        description = "AI hazard models and first-principles hydrodynamic physics are in full agreement within calibrated tolerances."
        consistency_score = 98.0
        recommendation = "Standard anticipatory watch. Continue automated 10 Hz ingestion."

    # If sensor integrity is poor, reduce consistency confidence
    if sensor_integrity_score < 70.0:
        consistency_score = min(consistency_score, sensor_integrity_score)

    return {
        "case": case,
        "case_label": case_label,
        "consistency_score": round(consistency_score, 1),
        "description": description,
        "recommendation": recommendation,
        "physics_diverged": bool(physics_diverged),
        "ai_anomaly": bool(is_anomaly),
        "residuals_evaluated": physics_residuals,
    }
