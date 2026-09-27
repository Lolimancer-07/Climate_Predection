import os

FEATURE_FLAGS = {
    "live_forecast_mode": os.getenv("FF_LIVE_FORECAST", "true").lower() == "true",
    "structural_engineering_module": os.getenv("FF_STRUCTURAL_ENG", "true").lower() == "true",
    "rapid_damage_assessment": os.getenv("FF_RAPID_DAMAGE", "false").lower() == "true",
}

def is_feature_enabled(feature_name: str) -> bool:
    return FEATURE_FLAGS.get(feature_name, False)
