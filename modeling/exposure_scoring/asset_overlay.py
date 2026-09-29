"""
modeling/exposure_scoring/asset_overlay.py
Spatial overlay: check which infrastructure assets fall inside hazard polygons.
"""
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from typing import Any


@dataclass
class ExposureScore:
    score_id: str
    event_id: str
    asset_id: str
    asset_type: str
    asset_name: str
    exposure_score: float       # 0–1: fraction of asset inside hazard polygon
    priority_score: float       # exposure × criticality
    severity_class: str         # from hazard polygon
    hazard_type: str            # surge | rainfall_flood | composite
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    flagged: bool = False
    flag_reason: str = ""


def compute_exposure(
    asset: dict[str, Any],
    hazard_geojson_features: list[dict[str, Any]],
) -> ExposureScore:
    """
    Compute exposure score for a single asset against the merged hazard polygon.

    asset: dict with keys asset_id, asset_type, name, criticality, geometry (GeoJSON)
    hazard_geojson_features: list of GeoJSON Feature dicts from surge + runoff models
    """
    asset_geom = shape(asset["geometry"])
    hazard_polys = [shape(f["geometry"]) for f in hazard_geojson_features if f.get("geometry")]
    merged_hazard = unary_union(hazard_polys) if hazard_polys else None

    if merged_hazard is None or merged_hazard.is_empty:
        exposure = 0.0
        sev_class = "None"
    else:
        try:
            if asset_geom.geom_type == "Point":
                exposure = 1.0 if merged_hazard.contains(asset_geom) else 0.0
            elif asset_geom.geom_type in ("LineString", "MultiLineString"):
                intersection = asset_geom.intersection(merged_hazard)
                exposure = intersection.length / asset_geom.length if asset_geom.length > 0 else 0.0
            else:
                intersection = asset_geom.intersection(merged_hazard)
                exposure = intersection.area / asset_geom.area if asset_geom.area > 0 else 0.0
        except Exception:
            exposure = 0.0

        # Pick worst severity from overlapping features
        sev_order = {"Severe": 4, "High": 3, "Medium": 2, "Low": 1, "None": 0}
        sev_class = "None"
        for feat in hazard_geojson_features:
            props = feat.get("properties", {})
            s = props.get("severity_class", "None")
            if sev_order.get(s, 0) > sev_order.get(sev_class, 0):
                sev_class = s

    exposure = round(exposure, 3)
    criticality = asset.get("criticality", 0.5)
    priority = round(exposure * criticality, 3)
    flagged = priority > 0.3

    flag_reason = ""
    if flagged:
        atype = asset.get("asset_type", "")
        if atype in ("hospital", "shelter"):
            flag_reason = f"CRITICAL — {atype} inside hazard zone. Relocate or resupply."
        elif atype == "road":
            flag_reason = "Evacuation route may be cut. Check alternate paths."
        elif atype in ("power_line", "substation"):
            flag_reason = "Preemptive shutdown candidate — electrocution/fire risk."

    return ExposureScore(
        score_id=str(uuid.uuid4()),
        event_id=asset.get("event_id", "UNKNOWN"),
        asset_id=asset["asset_id"],
        asset_type=asset.get("asset_type", "unknown"),
        asset_name=asset.get("name", asset["asset_id"]),
        exposure_score=exposure,
        priority_score=priority,
        severity_class=sev_class,
        hazard_type="composite",
        flagged=flagged,
        flag_reason=flag_reason,
    )


def score_all_assets(
    assets: list[dict[str, Any]],
    hazard_features: list[dict[str, Any]],
    event_id: str,
) -> list[ExposureScore]:
    """Score all assets and return sorted by priority (highest first)."""
    for a in assets:
        a.setdefault("event_id", event_id)
    scores = [compute_exposure(a, hazard_features) for a in assets]
    scores.sort(key=lambda s: s.priority_score, reverse=True)
    return scores


def score_asset_exposure(surge_result: dict, flood_result: dict, district_id: str) -> dict:
    """Convenience adapter for pipeline execution."""
    from scripts.demo_run import PURI_DEMO_ASSETS
    from data_ingestion.exposure.shelters import load_shelters, shelter_to_asset_dict

    try:
        shelters = [shelter_to_asset_dict(s) for s in load_shelters(district_id)]
    except Exception:
        shelters = []

    all_assets = list(PURI_DEMO_ASSETS) + [s for s in shelters if s not in PURI_DEMO_ASSETS]
    hazard_features = []
    if "inundation_geojson" in surge_result and surge_result["inundation_geojson"]:
        hazard_features.append(surge_result["inundation_geojson"])

    event_id = surge_result.get("event_id", "BOB07-2026")
    scores = score_all_assets(all_assets, hazard_features, event_id)

    asset_list = []
    for s in scores:
        d = {
            "asset_id": s.asset_id,
            "asset_type": s.asset_type,
            "asset_name": s.asset_name,
            "exposure_score": s.exposure_score,
            "priority_score": s.priority_score,
            "severity_class": s.severity_class,
            "flagged": s.flagged,
            "flag_reason": s.flag_reason,
            "surge_height_m": surge_result.get("max_surge_height_m", 0.0) if s.exposure_score > 0 else 0.0,
        }
        asset_list.append(d)

    return {
        "district_id": district_id,
        "event_id": event_id,
        "assets": asset_list,
        "flagged_count": len([a for a in asset_list if a["flagged"]]),
    }
