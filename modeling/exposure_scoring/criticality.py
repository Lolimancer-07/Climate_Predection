"""
modeling/exposure_scoring/criticality.py
Criticality weighting logic per asset type and context.
"""
from dataclasses import dataclass
from typing import Literal

AssetType = Literal["hospital", "shelter", "road", "power_line", "substation", "school", "bridge"]

# Base criticality weights by asset type (0–1)
BASE_WEIGHTS: dict[str, float] = {
    "hospital":    1.00,   # life-critical, no substitute
    "shelter":     0.95,   # direct evacuation function
    "substation":  0.90,   # grid loss cascades to hospitals/shelters
    "bridge":      0.85,   # cut evacuation routes
    "road":        0.70,   # depends on road class (overridden below)
    "power_line":  0.55,
    "school":      0.50,   # often used as shelter
}

ROAD_CLASS_WEIGHTS: dict[str, float] = {
    "trunk":    0.90,
    "primary":  0.80,
    "secondary":0.65,
    "tertiary": 0.45,
    "other":    0.30,
}


@dataclass
class CriticalityFactors:
    asset_type: str
    population_served: int      # approximate # people depending on this asset
    redundancy: int             # number of equivalent assets within 5 km
    road_class: str = "other"  # for road assets


def compute_criticality(factors: Any) -> Any:
    """
    criticality = base_weight × population_factor × redundancy_penalty
    Supports CriticalityFactors or pipeline exposure dict.
    """
    if isinstance(factors, dict):
        return {
            "district_id": factors.get("district_id"),
            "event_id": factors.get("event_id"),
            "assets": factors.get("assets", []),
        }

    import math

    base = BASE_WEIGHTS.get(factors.asset_type, 0.5)
    if factors.asset_type == "road":
        base = ROAD_CLASS_WEIGHTS.get(factors.road_class, 0.30)

    # Population factor: 0.5 at pop=0, 1.0 at pop≥10000
    pop = max(factors.population_served, 0)
    pop_factor = 0.5 + 0.5 * min(math.log1p(pop) / math.log1p(10_000), 1.0)

    # Redundancy penalty: each extra asset reduces criticality by 15%, floored at 0.3
    redundancy_factor = max(0.3, 1.0 - 0.15 * max(factors.redundancy - 1, 0))

    score = base * pop_factor * redundancy_factor
    return round(min(score, 1.0), 3)


def enrich_asset_criticality(asset: dict, population_served: int = 5000, redundancy: int = 1) -> dict:
    """
    Compute and attach a criticality score to an asset dict.
    Returns the same dict with 'criticality' updated.
    """
    factors = CriticalityFactors(
        asset_type=asset.get("asset_type", "road"),
        population_served=population_served,
        redundancy=redundancy,
        road_class=asset.get("osm_tags", {}).get("highway", "other"),
    )
    asset = dict(asset)
    asset["criticality"] = compute_criticality(factors)
    return asset
