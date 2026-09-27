from typing import List, Dict, Any
from data_ingestion.providers.base import TrackFix
from shapely.geometry import Point, MultiPolygon, Polygon
import pyproj
from shapely.ops import transform
from functools import partial

# Helper to create circles in km on a lat/lon map
def create_circle_km(lat: float, lon: float, radius_km: float) -> Polygon:
    local_azimuthal_projection = f"+proj=aeqd +R=6371000 +units=m +lat_0={lat} +lon_0={lon}"
    wgs84_to_aeqd = pyproj.Transformer.from_proj(
        pyproj.Proj('+proj=longlat +datum=WGS84 +no_defs'),
        pyproj.Proj(local_azimuthal_projection),
        always_xy=True
    ).transform
    aeqd_to_wgs84 = pyproj.Transformer.from_proj(
        pyproj.Proj(local_azimuthal_projection),
        pyproj.Proj('+proj=longlat +datum=WGS84 +no_defs'),
        always_xy=True
    ).transform
    
    # Point at center, buffer in meters, transform back
    point_geom = Point(0, 0) # Center is 0,0 in local projection
    buffer_geom = point_geom.buffer(radius_km * 1000)
    polygon_lonlat = transform(aeqd_to_wgs84, buffer_geom)
    return polygon_lonlat

def cone_radius_km(lead_hours: int, cone_radius_lookup: dict) -> float:
    """
    Standard-error-style growth based on lookup table.
    """
    # Simple interpolation or exact match
    if str(lead_hours) in cone_radius_lookup:
        return cone_radius_lookup[str(lead_hours)]
    elif lead_hours in cone_radius_lookup:
        return cone_radius_lookup[lead_hours]
    
    # Fallback linear interpolation
    hours = sorted([int(k) for k in cone_radius_lookup.keys()])
    for i in range(len(hours) - 1):
        if hours[i] <= lead_hours <= hours[i+1]:
            h1, h2 = hours[i], hours[i+1]
            r1, r2 = cone_radius_lookup[str(h1)] if str(h1) in cone_radius_lookup else cone_radius_lookup[h1], \
                     cone_radius_lookup[str(h2)] if str(h2) in cone_radius_lookup else cone_radius_lookup[h2]
            return r1 + (r2 - r1) * ((lead_hours - h1) / (h2 - h1))
            
    # Beyond max, extrapolate linearly from last two
    h1, h2 = hours[-2], hours[-1]
    r1, r2 = cone_radius_lookup[str(h1)] if str(h1) in cone_radius_lookup else cone_radius_lookup[h1], \
             cone_radius_lookup[str(h2)] if str(h2) in cone_radius_lookup else cone_radius_lookup[h2]
    return r2 + (r2 - r1) * ((lead_hours - h2) / (h2 - h1))
    

def build_cone_polygon(
    track_points: List[TrackFix], 
    cone_radius_lookup: dict,
    start_time
) -> MultiPolygon:
    """Returns a GeoJSON-compatible polygon: the union of per-point radius circles."""
    polygons = []
    
    for fix in track_points:
        lead_hours = int((fix.timestamp - start_time).total_seconds() / 3600)
        if lead_hours <= 0:
            radius = 10.0 # Small base radius for observed points
        else:
            radius = cone_radius_km(lead_hours, cone_radius_lookup)
            
        polygons.append(create_circle_km(fix.lat, fix.lon, radius))
        
    # Create convex hull over all circles to form the "cone" shape
    # This is a simple approximation. A true cone would take the convex hull of consecutive circles and union them.
    segments = []
    for i in range(len(polygons) - 1):
        segments.append(polygons[i].union(polygons[i+1]).convex_hull)
        
    if not segments:
        return MultiPolygon()
        
    union_cone = segments[0]
    for seg in segments[1:]:
        union_cone = union_cone.union(seg)
        
    if isinstance(union_cone, Polygon):
        return MultiPolygon([union_cone])
    return union_cone
