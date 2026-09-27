"""
modeling/structural_engineering/damage_state.py
Aggregates wind load + surge load + fragility curves into a
per-asset structural assessment with combined expected damage state.

Combines:
    1. Structural safety factor (section modulus check)
    2. Wind fragility probabilities
    3. Surge fragility probabilities
    4. Combined expected damage state using maximum hazard principle
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .structural_check import check_pole_safety_factor, check_building_safety_factor
from .fragility_curves import get_damage_state_probabilities

# Asset classes treated as line assets (pole/tower)
LINE_ASSET_CLASSES = {
    "wood_power_pole",
    "concrete_power_pole",
    "steel_lattice_tower",
}


@dataclass
class StructuralAssessment:
    """
    Full structural vulnerability assessment output for one infrastructure asset.

    Attributes:
        asset_id: Unique identifier of the asset.
        asset_class: Type classification string.
        wind_speed_kmh: Input wind speed [km/h].
        surge_height_m: Input surge height [m].
        safety_factor: Structural safety factor from capacity/demand ratio.
        likely_failure: True if safety_factor < 1.0.
        reinforcement_advisable: True if safety_factor < 1.5.
        wind_damage_probs: P(damage_state | wind) for each state.
        surge_damage_probs: P(damage_state | surge) for each state.
        expected_wind_damage_state: Most probable wind damage state.
        expected_surge_damage_state: Most probable surge damage state.
        combined_expected_damage_state: Dominant damage state across both hazards.
        confidence: Fragility curve confidence flag.
        hardening_priority_score: Composite score for pre-landfall hardening ranking.
        notes: Free-text notes (confidence warnings, etc.)
    """
    asset_id: str
    asset_class: str
    wind_speed_kmh: float
    surge_height_m: float
    safety_factor: float
    likely_failure: bool
    reinforcement_advisable: bool
    wind_damage_probs: dict[str, float]
    surge_damage_probs: dict[str, float]
    expected_wind_damage_state: str
    expected_surge_damage_state: str
    combined_expected_damage_state: str
    confidence: str
    hardening_priority_score: float
    notes: list[str] = field(default_factory=list)


_DS_ORDER = ["none", "minor", "moderate", "severe", "collapse"]
_DS_RANK = {ds: i for i, ds in enumerate(_DS_ORDER)}


def _dominant_state(ds_a: str, ds_b: str) -> str:
    """Return the more severe of two damage states."""
    return ds_a if _DS_RANK.get(ds_a, 0) >= _DS_RANK.get(ds_b, 0) else ds_b


def _hardening_score(safety_factor: float, combined_ds: str, criticality: float = 0.5) -> float:
    """
    Composite hardening priority score.
    Higher = more urgently requires pre-landfall reinforcement.

    Score = (1 - clamped_safety_factor) * ds_weight * criticality_multiplier

    Args:
        safety_factor: Structural safety factor.
        combined_ds: Dominant expected damage state.
        criticality: Asset criticality (0–1). Default 0.5 if not known.
    """
    sf_component = max(0.0, 1.0 - min(safety_factor, 2.0)) / 2.0  # [0, 0.5] when SF ∈ [0, 2]
    ds_weight = {
        "none": 0.0,
        "minor": 0.2,
        "moderate": 0.5,
        "severe": 0.8,
        "collapse": 1.0,
    }.get(combined_ds, 0.3)
    score = (sf_component + ds_weight) / 2.0 * (0.5 + 0.5 * criticality)
    return round(score, 4)


def assess_asset_damage_state(
    asset_id: str,
    asset_class: str,
    wind_speed_kmh: float,
    surge_height_m: float,
    frontal_area_m2: float | None = None,
    height_m: float | None = None,
    moment_capacity_knm: float | None = None,
    shear_capacity_kn: float | None = None,
    criticality: float = 0.5,
) -> StructuralAssessment:
    """
    Full structural assessment of a single infrastructure asset.

    Args:
        asset_id: Asset identifier.
        asset_class: Type string (e.g., "wood_power_pole").
        wind_speed_kmh: Forecast wind speed at asset location [km/h].
        surge_height_m: Modeled inundation depth [m].
        frontal_area_m2: Override for frontal area.
        height_m: Override for structure height.
        moment_capacity_knm: Override moment capacity for line assets.
        shear_capacity_kn: Override shear capacity for buildings.
        criticality: Asset criticality score [0–1] from exposure_scoring.

    Returns:
        StructuralAssessment dataclass instance.
    """
    notes: list[str] = []

    # ── Structural safety factor ──────────────────────────────────────────────
    if asset_class in LINE_ASSET_CLASSES:
        check = check_pole_safety_factor(
            wind_speed_kmh, surge_height_m, asset_class,
            height_m=height_m,
            frontal_area_m2=frontal_area_m2,
            moment_capacity_knm=moment_capacity_knm,
        )
    else:
        check = check_building_safety_factor(
            wind_speed_kmh, surge_height_m, asset_class,
            frontal_area_m2=frontal_area_m2,
            shear_capacity_kn=shear_capacity_kn,
        )

    sf = check["safety_factor"]
    likely_fail = check["likely_failure"]
    reinforce = check["reinforcement_advisable"]

    # ── Fragility curves ─────────────────────────────────────────────────────
    wind_frag = get_damage_state_probabilities("wind", wind_speed_kmh, asset_class)
    surge_frag = get_damage_state_probabilities("surge", surge_height_m, asset_class)

    expected_wind_ds = wind_frag["expected_damage_state"]
    expected_surge_ds = surge_frag["expected_damage_state"]
    combined_ds = _dominant_state(expected_wind_ds, expected_surge_ds)

    confidence = wind_frag["confidence"]
    if confidence == "generic_curve":
        notes.append(
            "Fragility parameters are generic (HAZUS analog). "
            "Not calibrated to Bay of Bengal construction stock. "
            "Treat damage-state estimates as screening-level only."
        )

    if likely_fail:
        notes.append("Safety factor < 1.0: structural failure under forecast loading likely.")
    elif reinforce:
        notes.append(
            "Safety factor 1.0–1.5: reinforcement advisable before landfall. "
            "Not a substitute for licensed structural engineer assessment."
        )

    priority_score = _hardening_score(sf, combined_ds, criticality)

    return StructuralAssessment(
        asset_id=asset_id,
        asset_class=asset_class,
        wind_speed_kmh=wind_speed_kmh,
        surge_height_m=surge_height_m,
        safety_factor=sf,
        likely_failure=likely_fail,
        reinforcement_advisable=reinforce,
        wind_damage_probs=wind_frag["damage_state_probabilities"],
        surge_damage_probs=surge_frag["damage_state_probabilities"],
        expected_wind_damage_state=expected_wind_ds,
        expected_surge_damage_state=expected_surge_ds,
        combined_expected_damage_state=combined_ds,
        confidence=confidence,
        hardening_priority_score=priority_score,
        notes=notes,
    )
