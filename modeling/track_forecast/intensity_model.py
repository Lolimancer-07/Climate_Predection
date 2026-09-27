from typing import List
from data_ingestion.providers.base import TrackFix

def get_category_from_wind(wind_kmh: float) -> str:
    """Categorize according to IMD classification"""
    if wind_kmh < 31: return "Low Pressure Area"
    if wind_kmh < 50: return "Depression"
    if wind_kmh < 62: return "Deep Depression"
    if wind_kmh < 89: return "Cyclonic Storm"
    if wind_kmh < 118: return "Severe Cyclonic Storm"
    if wind_kmh < 166: return "Very Severe Cyclonic Storm"
    if wind_kmh < 221: return "Extremely Severe Cyclonic Storm"
    return "Super Cyclonic Storm"

def extrapolate_intensity(
    forecasts: List[TrackFix], 
    sst_threshold_c: float = 28.0,
    max_intensification_rate_kmh: float = 75.0,
    landfall_decay_rate_kmh: float = 80.0,
    max_wind_speed_kmh: float = 320.0
) -> List[TrackFix]:
    """
    Simple intensification/decay model based on SST and time-to-landfall.
    Updates the central_pressure and max_wind_kmh of the provided forecasts.
    """
    # For mock purposes, assume it intensifies until it hits a "landfall" point, then decays.
    # We'll just define a simple rule: intensifies for first 72h, then decays.
    
    current_wind = forecasts[0].max_wind_kmh if forecasts else 0
    updated_forecasts = []
    
    for i, forecast in enumerate(forecasts):
        # Mock logic: intensify up to lead_hour 72, then decay
        lead_hour = (forecast.timestamp - forecasts[0].timestamp).total_seconds() / 3600
        
        if lead_hour <= 72:
            # Intensify
            delta_wind = (max_intensification_rate_kmh / 24.0) * (lead_hour / max(i, 1)) 
            current_wind = min(current_wind + delta_wind, max_wind_speed_kmh)
        else:
            # Decay (simulating post-landfall)
            delta_wind = (landfall_decay_rate_kmh / 24.0) * ((lead_hour - 72) / max(i, 1))
            current_wind = max(current_wind - delta_wind, 30.0) # don't drop below 30
            
        updated_forecast = forecast.model_copy(update={
            "max_wind_kmh": round(current_wind, 1),
            "central_pressure_hpa": round(1010 - (current_wind * 0.1), 1), # Very rough pressure-wind relationship
            "category": get_category_from_wind(current_wind)
        })
        updated_forecasts.append(updated_forecast)
        
    return updated_forecasts
