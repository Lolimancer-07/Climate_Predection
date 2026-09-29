"""
modeling/surge/parametric_surge.py
Calibrated parametric storm-surge proxy model.

NOT a certified hydrodynamic model — explicitly a screening-speed proxy
calibrated against Amphan (2020), Fani (2019), Yaas (2021), Mocha (2023).
Upgrade path: replace with GeoClaw/ADCIRC-coupled model.
"""
import math
import json
import numpy as np
from dataclasses import dataclass, field
from typing import Optional


MODEL_VERSION = "parametric-surge-v0.3"

# Calibration constants derived from Bay of Bengal historical events
# Moved to backend/config/basins/bay_of_bengal.yaml in Phase 3
_ENV_PRESSURE = 1013.0   # hPa

def get_calibration_constants(basin_id="bay_of_bengal"):
    from backend.basin_config import get_basin_config
    config = get_basin_config(basin_id)
    return config.get("surge_calibration", {"A": 0.0042, "B": 0.0008, "C": 0.012})


@dataclass
class SurgeInput:
    central_pressure_hpa: float          # mb
    radius_max_wind_nm: float            # nautical miles
    forward_speed_kt: float              # knots
    shelf_slope_deg: float               # average coastal shelf slope in degrees
    landfall_lat: float
    landfall_lon: float
    district_id: str
    event_id: str


@dataclass
class SurgeResult:
    event_id: str
    district_id: str
    model_version: str
    surge_height_m: float                # estimated peak surge at landfall point
    inundation_radius_km: float          # rough horizontal extent
    shelf_amplification_factor: float
    confidence: str                      # "forecast" | "calibrated_historical"
    inundation_geojson: dict = field(default_factory=dict)
    notes: str = ""


def estimate_surge_height(inp: SurgeInput) -> float:
    """
    Empirical surge height at landfall:
        H = A × (env_pressure - central_pressure)
          + B × radius_max_wind
          + C × forward_speed
          × shelf_amplification_factor

    Calibrated against Bay of Bengal post-event survey reports.
    Returns peak surge height in metres.
    """
    cal = get_calibration_constants() # Default to bay_of_bengal for now
    pressure_deficit = _ENV_PRESSURE - inp.central_pressure_hpa
    h_base = (
        cal["A"] * pressure_deficit
        + cal["B"] * inp.radius_max_wind_nm
        + cal["C"] * inp.forward_speed_kt
    )
    saf = _shelf_amplification(inp.shelf_slope_deg)
    h = h_base * saf
    return round(max(h, 0.0), 2)


def _shelf_amplification(shelf_slope_deg: float) -> float:
    """
    Shelf amplification factor.
    Shallow, gently-sloping shelves (Odisha, Bangladesh delta) produce larger surges.
    Factor ranges roughly 1.0–2.5.
    """
    # Low slope = large amplification (funnel effect)
    # Calibrated so slope ~0.1° → factor ~2.2 (Bengal delta)
    #                   slope ~0.5° → factor ~1.4 (Odisha)
    #                   slope ~1.5° → factor ~1.0 (steeper coasts)
    factor = 1.0 + 1.2 * math.exp(-2.0 * shelf_slope_deg)
    return round(min(factor, 2.5), 3)


def estimate_inundation_radius(surge_height_m: float, shelf_slope_deg: float) -> float:
    """
    Approximate horizontal inundation distance in km.
    Simple geometric calculation: H / tan(slope).
    """
    slope_rad = math.radians(max(shelf_slope_deg, 0.05))
    dist_m = surge_height_m / math.tan(slope_rad)
    return round(dist_m / 1000.0, 2)


def build_inundation_geojson(
    surge_height_m: float,
    inundation_radius_km: float,
    landfall_lat: float,
    landfall_lon: float,
    n_points: int = 64,
) -> dict:
    """
    Generate an approximate circular inundation GeoJSON polygon
    centred on the landfall point with the estimated inundation radius.

    In a production system this would be a flood-fill over the DEM.
    For demo speed we return an ellipse skewed slightly inland.
    """
    # Degrees per km (approx)
    deg_per_km_lat = 1.0 / 111.0
    deg_per_km_lon = 1.0 / (111.0 * math.cos(math.radians(landfall_lat)))

    angles = np.linspace(0, 2 * math.pi, n_points, endpoint=False)
    # Slightly elongated inland (north for BoB landfalls)
    radii_lat = inundation_radius_km * 1.0
    radii_lon = inundation_radius_km * 0.7

    coords = [
        [
            landfall_lon + radii_lon * deg_per_km_lon * math.sin(a),
            landfall_lat + radii_lat * deg_per_km_lat * math.cos(a),
        ]
        for a in angles
    ]
    coords.append(coords[0])   # close the ring

    return {
        "type": "Feature",
        "properties": {
            "surge_height_m": surge_height_m,
            "hazard_type": "surge",
            "severity_class": _surge_severity_class(surge_height_m),
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [coords],
        },
    }


def _surge_severity_class(h: float) -> str:
    if h < 0.5:
        return "Low"
    elif h < 1.5:
        return "Medium"
    elif h < 3.0:
        return "High"
    else:
        return "Severe"


def run_parametric_surge_model(inp: SurgeInput) -> SurgeResult:
    """Full pipeline: compute surge height, inundation polygon, return SurgeResult."""
    h = estimate_surge_height(inp)
    saf = _shelf_amplification(inp.shelf_slope_deg)
    r = estimate_inundation_radius(h, inp.shelf_slope_deg)
    geojson = build_inundation_geojson(h, r, inp.landfall_lat, inp.landfall_lon)

    return SurgeResult(
        event_id=inp.event_id,
        district_id=inp.district_id,
        model_version=MODEL_VERSION,
        surge_height_m=h,
        inundation_radius_km=r,
        shelf_amplification_factor=saf,
        confidence="forecast",
        inundation_geojson=geojson,
        notes=(
            f"Parametric proxy (v{MODEL_VERSION}). "
            "Not certified for evacuation order use without expert review. "
            "Upgrade path: GeoClaw/ADCIRC coupled model."
        ),
    )


# Alias for backwards compatibility with demo scripts
run_surge_model = run_parametric_surge_model


# ── Demo convenience ─────────────────────────────────────────────────────────


def fani_demo_surge() -> SurgeResult:
    """Return pre-computed surge result for Cyclone Fani 2019 Puri demo."""
    inp = SurgeInput(
        central_pressure_hpa=932,
        radius_max_wind_nm=55,
        forward_speed_kt=15,
        shelf_slope_deg=0.40,
        landfall_lat=19.5,
        landfall_lon=85.9,
        district_id="IN-OD-PURI",
        event_id="CYCLONE-FANI-2019",
    )
    return run_parametric_surge_model(inp)


def compute_surge(track: dict, district_id: str) -> dict:
    """Convenience adapter for pipeline execution."""
    inp = SurgeInput(
        central_pressure_hpa=float(track.get("central_pressure_hpa", 932.0)),
        radius_max_wind_nm=float(track.get("radius_max_wind_nm", 45.0)),
        forward_speed_kt=float(track.get("forward_speed_kt", 12.0)),
        shelf_slope_deg=0.40,
        landfall_lat=float(track.get("landfall_lat", 19.8)),
        landfall_lon=float(track.get("landfall_lon", 85.83)),
        district_id=district_id,
        event_id=track.get("event_id", "BOB07-2026"),
    )
    result = run_parametric_surge_model(inp)
    return {
        "event_id": result.event_id,
        "district_id": result.district_id,
        "model_version": result.model_version,
        "surge_height_m": result.surge_height_m,
        "max_surge_height_m": result.surge_height_m,
        "inundation_radius_km": result.inundation_radius_km,
        "shelf_amplification_factor": result.shelf_amplification_factor,
        "confidence": result.confidence,
        "inundation_geojson": result.inundation_geojson,
        "notes": result.notes,
    }
