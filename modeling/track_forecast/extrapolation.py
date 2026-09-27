from typing import List
from datetime import timedelta
from data_ingestion.providers.base import TrackFix
import math

def calculate_heading_and_speed(f1: TrackFix, f2: TrackFix) -> tuple[float, float]:
    """Calculate heading and speed between two fixes (mock implementation for simplicity)"""
    # Simple Euclidean for mock, normally use Haversine
    lat_diff = f2.lat - f1.lat
    lon_diff = f2.lon - f1.lon
    
    heading = math.degrees(math.atan2(lon_diff, lat_diff))
    if heading < 0:
        heading += 360
        
    # Distance in degrees approx to km (1 deg ~ 111km)
    dist_km = math.sqrt(lat_diff**2 + lon_diff**2) * 111.0
    hours = (f2.timestamp - f1.timestamp).total_seconds() / 3600.0
    
    speed_kt = (dist_km / hours) / 1.852 if hours > 0 else 0
    return heading, speed_kt

def extrapolate_track(
    recent_fixes: List[TrackFix],
    lead_hours: List[int] = [24, 48, 72, 96, 120],
    climatology_heading: float = 315.0
) -> List[TrackFix]:
    """
    CLIPER-style extrapolation: persists recent heading/speed, decays
    toward basin-seasonal climatological heading as lead time grows.
    """
    if not recent_fixes:
        return []
        
    last_fix = recent_fixes[-1]
    
    # Estimate current heading and speed if at least two fixes exist
    if len(recent_fixes) > 1:
        current_heading, current_speed = calculate_heading_and_speed(recent_fixes[-2], last_fix)
    else:
        current_heading = last_fix.heading_deg
        current_speed = last_fix.forward_speed_kt
        
    forecasts = []
    current_lat = last_fix.lat
    current_lon = last_fix.lon
    current_time = last_fix.timestamp
    
    for lead in lead_hours:
        # Blend current heading towards climatology based on lead time
        # E.g., at 120h, it's heavily weighted towards climatology
        blend_factor = min(lead / 120.0, 1.0)
        
        # Simple linear interpolation for angle (doesn't handle 359->0 wrap well, but okay for mock)
        forecast_heading = (current_heading * (1 - blend_factor)) + (climatology_heading * blend_factor)
        forecast_speed = current_speed # Keep speed constant for simplicity
        
        # Extrapolate position (1kt ~ 1.852 km/h, 1 deg ~ 111km)
        dist_km = forecast_speed * 1.852 * lead
        dist_deg = dist_km / 111.0
        
        forecast_lat = current_lat + dist_deg * math.cos(math.radians(forecast_heading))
        forecast_lon = current_lon + dist_deg * math.sin(math.radians(forecast_heading))
        
        # Create forecast fix (intensity models would update pressure/wind)
        forecasts.append(TrackFix(
            timestamp=current_time + timedelta(hours=lead),
            lat=round(forecast_lat, 2),
            lon=round(forecast_lon, 2),
            central_pressure_hpa=last_fix.central_pressure_hpa, # Placeholder
            max_wind_kmh=last_fix.max_wind_kmh, # Placeholder
            forward_speed_kt=round(forecast_speed, 1),
            heading_deg=round(forecast_heading, 1),
            category="Forecast" # Placeholder
        ))
        
    return forecasts
