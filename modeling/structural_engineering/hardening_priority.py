"""
modeling/structural_engineering/hardening_priority.py
Pre-landfall infrastructure reinforcement ranking.

Produces a ranked list of assets sorted by hardening urgency:
    Priority = (safety_factor ascending) × (criticality descending)

The top of the list = most urgently needs reinforcement before landfall.

NOTE: This output is a screening-level priority list.
It is NOT a substitute for a licensed structural engineer's assessment.
All recommendations must be reviewed by a qualified engineer before action.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .damage_state import StructuralAssessment, assess_asset_damage_state


@dataclass
class HardeningRecommendation:
    """
    Pre-landfall reinforcement recommendation for a single asset.

    Attributes:
        rank: Priority rank (1 = most urgent).
        asset_id: Asset identifier.
        asset_class: Type classification.
        location: Lat/lon tuple or place name string.
        safety_factor: Structural safety factor (lower = more urgent).
        hardening_priority_score: Composite urgency score [0–1].
        combined_expected_damage_state: Dominant expected damage state.
        recommended_action: Pre-landfall action description.
        confidence: Fragility curve confidence.
        likely_failure: Whether failure is likely without intervention.
        notes: Engineering/confidence notes.
    """
    rank: int
    asset_id: str
    asset_class: str
    location: Any   # (lat, lon) tuple or descriptive string
    safety_factor: float
    hardening_priority_score: float
    combined_expected_damage_state: str
    recommended_action: str
    confidence: str
    likely_failure: bool
    notes: list[str] = field(default_factory=list)


# ── Pre-landfall action templates by damage state + asset class ──────────────

_ACTION_TEMPLATES: dict[str, dict[str, str]] = {
    "collapse": {
        "wood_power_pole":       "Immediate de-energise and guy-wire bracing; evacuate exclusion zone 2× pole height.",
        "concrete_power_pole":   "Inspect for pre-existing cracks; install storm stays; de-energise if cracked.",
        "steel_lattice_tower":   "Emergency guy-wire inspection; tighten all anchor bolts; de-energise and redispatch load.",
        "masonry_building":      "Evacuate occupants; install temporary buttress walls; board openings.",
        "thatched_roof_house":   "Evacuate to nearest cyclone shelter immediately.",
        "rcc_building":          "Inspect for rebar corrosion/spalling; reinforce roof anchorage; board openings.",
        "hospital":              "Activate hospital storm plan; pre-position backup generator fuel; board openings.",
        "shelter":               "Inspect roof anchorage and wall ties; clear drainage; stock emergency supplies.",
        "default":               "Evacuate occupants; secure all external fixtures; consult structural engineer.",
    },
    "severe": {
        "wood_power_pole":       "Guy-wire bracing and load reduction on network segment.",
        "concrete_power_pole":   "Install storm stays; inspect foundation crack status.",
        "steel_lattice_tower":   "Tighten guy wires and anchor bolts; schedule post-event inspection.",
        "masonry_building":      "Board openings; install roof tie-downs; clear gutters.",
        "thatched_roof_house":   "Reinforce roof with net/rope tie-down; prepare evacuation plan.",
        "rcc_building":          "Reinforce roof water-tank anchorage; board openings.",
        "hospital":              "Pre-position generator; activate storm-mode protocols.",
        "shelter":               "Board openings; verify capacity and stock supplies.",
        "default":               "Secure fixtures; board openings; consult engineer for assessment.",
    },
    "moderate": {
        "default": "Secure loose external fittings; inspect roof anchorage; clear storm drains.",
    },
    "minor": {
        "default": "Monitor during event; schedule post-event inspection.",
    },
    "none": {
        "default": "No pre-landfall structural action required. Continue standard monitoring.",
    },
}


def _get_action(damage_state: str, asset_class: str) -> str:
    state_actions = _ACTION_TEMPLATES.get(damage_state, _ACTION_TEMPLATES["none"])
    return state_actions.get(asset_class, state_actions.get("default", "No specific action."))


def rank_assets_for_hardening(
    assessments: list[StructuralAssessment],
    asset_locations: dict[str, Any] | None = None,
) -> list[HardeningRecommendation]:
    """
    Sort assessed assets by hardening urgency and generate recommendations.

    Args:
        assessments: List of StructuralAssessment from assess_asset_damage_state().
        asset_locations: Optional mapping of asset_id → (lat, lon) or place name.

    Returns:
        List of HardeningRecommendation, ranked #1 = most urgent.
    """
    # Sort: highest priority_score first (= lowest SF + worst damage state + high criticality)
    sorted_assessments = sorted(
        assessments,
        key=lambda a: a.hardening_priority_score,
        reverse=True,
    )

    recommendations: list[HardeningRecommendation] = []
    for rank, assessment in enumerate(sorted_assessments, start=1):
        action = _get_action(
            assessment.combined_expected_damage_state,
            assessment.asset_class,
        )
        location = (asset_locations or {}).get(assessment.asset_id, "Location unknown")

        recommendations.append(
            HardeningRecommendation(
                rank=rank,
                asset_id=assessment.asset_id,
                asset_class=assessment.asset_class,
                location=location,
                safety_factor=assessment.safety_factor,
                hardening_priority_score=assessment.hardening_priority_score,
                combined_expected_damage_state=assessment.combined_expected_damage_state,
                recommended_action=action,
                confidence=assessment.confidence,
                likely_failure=assessment.likely_failure,
                notes=assessment.notes,
            )
        )

    return recommendations


def run_district_hardening_assessment(
    asset_list: list[dict],
    wind_speed_kmh: float,
    surge_grid: dict[str, float],
    asset_locations: dict[str, Any] | None = None,
) -> list[HardeningRecommendation]:
    """
    Convenience function: run structural assessment for every asset in a district
    and return a ranked hardening priority list.

    Args:
        asset_list: List of dicts with keys: asset_id, asset_class, criticality,
                    and optionally frontal_area_m2, height_m.
        wind_speed_kmh: Forecast max 1-min wind speed for the district [km/h].
        surge_grid: Dict of asset_id → surge_height_m at asset location.
        asset_locations: Optional dict of asset_id → location.

    Returns:
        Ranked list of HardeningRecommendation (rank 1 = most urgent).
    """
    assessments: list[StructuralAssessment] = []

    for asset in asset_list:
        asset_id = asset["asset_id"]
        asset_class = asset.get("asset_class", "default")
        criticality = float(asset.get("criticality", 0.5))
        surge_height = surge_grid.get(asset_id, 0.0)

        sa = assess_asset_damage_state(
            asset_id=asset_id,
            asset_class=asset_class,
            wind_speed_kmh=wind_speed_kmh,
            surge_height_m=surge_height,
            frontal_area_m2=asset.get("frontal_area_m2"),
            height_m=asset.get("height_m"),
            criticality=criticality,
        )
        assessments.append(sa)

    return rank_assets_for_hardening(assessments, asset_locations)
