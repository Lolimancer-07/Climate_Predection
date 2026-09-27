from modeling.surge.parametric_surge import run_parametric_surge_model
from modeling.structural_engineering.fragility_curves import get_damage_state_probabilities

# To allow testing new implementations side-by-side with old ones
MODEL_REGISTRY = {
    "surge": {
        "parametric-v0.3": run_parametric_surge_model,
        # "geoclaw-v1": run_geoclaw_surge_model, # stub for future integration
    },
    "structural_fragility": {
        "hazus-generic-v1": get_damage_state_probabilities,
        # "bob-calibrated-v1": run_regional_fragility_model, # stub for future integration
    },
}

def get_surge_model(version: str = "parametric-v0.3"):
    if version not in MODEL_REGISTRY["surge"]:
        raise ValueError(f"Unknown surge model version: {version}")
    return MODEL_REGISTRY["surge"][version]

def get_fragility_model(version: str = "hazus-generic-v1"):
    if version not in MODEL_REGISTRY["structural_fragility"]:
        raise ValueError(f"Unknown fragility model version: {version}")
    return MODEL_REGISTRY["structural_fragility"][version]
