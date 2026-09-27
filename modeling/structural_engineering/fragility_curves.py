"""
modeling/structural_engineering/fragility_curves.py
Lognormal fragility curves for cyclone damage state probabilities.

Damage state probabilities follow the HAZUS-style lognormal form:
    P(damage_state >= ds | intensity) = Φ( ln(I / median) / beta )

where:
    I      = hazard intensity (wind speed in km/h or surge height in m)
    median = median intensity at which P(damage_state) = 0.5
    beta   = log-standard deviation (dispersion)
    Φ      = standard normal CDF

Fragility parameters sourced from:
    FEMA HAZUS-MH Hurricane Model Technical Manual (2022)
    Vickery et al. (2006) — Florida wind vulnerability
    Li & Ellingwood (2006) — Residential wind vulnerability
    Bjarnadottir et al. (2014) — Power distribution network fragility

Confidence tags:
    "region_calibrated"  — curve fitted to Bay of Bengal or Indian coastal data
    "generic_curve"      — nearest HAZUS/literature analog, not region-specific
"""
from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Literal

# Standard normal CDF approximation (no scipy dependency)
def _norm_cdf(x: float) -> float:
    """Abramowitz & Stegun approximation of Φ(x). Max error ~1.5e-7."""
    a1, a2, a3, a4, a5 = (
        0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429
    )
    t = 1.0 / (1.0 + 0.2316419 * abs(x))
    poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))))
    cdf = 1.0 - (1.0 / math.sqrt(2 * math.pi)) * math.exp(-x * x / 2) * poly
    return cdf if x >= 0 else 1.0 - cdf


DamageState = Literal["none", "minor", "moderate", "severe", "collapse"]


@dataclass
class FragilityPoint:
    """Single damage state fragility curve parameters."""
    damage_state: DamageState
    median_intensity: float   # median intensity at P=0.5 (wind in km/h or surge in m)
    beta: float               # log-standard deviation of fragility
    confidence: Literal["region_calibrated", "generic_curve"]


# ── Fragility parameter tables ─────────────────────────────────────────────────

FRAGILITY_PARAMS: dict[str, dict[str, list[FragilityPoint]]] = {
    # ──────────────────── WIND fragility (intensity in km/h) ─────────────────
    "wind": {
        "wood_power_pole": [
            FragilityPoint("minor",    100.0, 0.35, "generic_curve"),
            FragilityPoint("moderate", 130.0, 0.35, "generic_curve"),
            FragilityPoint("severe",   165.0, 0.40, "generic_curve"),
            FragilityPoint("collapse", 200.0, 0.40, "generic_curve"),
        ],
        "concrete_power_pole": [
            FragilityPoint("minor",    130.0, 0.30, "generic_curve"),
            FragilityPoint("moderate", 165.0, 0.30, "generic_curve"),
            FragilityPoint("severe",   200.0, 0.35, "generic_curve"),
            FragilityPoint("collapse", 250.0, 0.35, "generic_curve"),
        ],
        "steel_lattice_tower": [
            FragilityPoint("minor",    160.0, 0.25, "generic_curve"),
            FragilityPoint("moderate", 200.0, 0.25, "generic_curve"),
            FragilityPoint("severe",   250.0, 0.30, "generic_curve"),
            FragilityPoint("collapse", 300.0, 0.30, "generic_curve"),
        ],
        "masonry_building": [
            FragilityPoint("minor",     90.0, 0.45, "generic_curve"),
            FragilityPoint("moderate", 115.0, 0.45, "generic_curve"),
            FragilityPoint("severe",   145.0, 0.50, "generic_curve"),
            FragilityPoint("collapse", 175.0, 0.50, "generic_curve"),
        ],
        "thatched_roof_house": [
            FragilityPoint("minor",     65.0, 0.50, "generic_curve"),
            FragilityPoint("moderate",  90.0, 0.55, "generic_curve"),
            FragilityPoint("severe",   110.0, 0.55, "generic_curve"),
            FragilityPoint("collapse", 130.0, 0.60, "generic_curve"),
        ],
        "rcc_building": [
            FragilityPoint("minor",    110.0, 0.35, "generic_curve"),
            FragilityPoint("moderate", 145.0, 0.35, "generic_curve"),
            FragilityPoint("severe",   185.0, 0.40, "generic_curve"),
            FragilityPoint("collapse", 225.0, 0.40, "generic_curve"),
        ],
        "hospital": [
            FragilityPoint("minor",    120.0, 0.30, "generic_curve"),
            FragilityPoint("moderate", 160.0, 0.30, "generic_curve"),
            FragilityPoint("severe",   200.0, 0.35, "generic_curve"),
            FragilityPoint("collapse", 260.0, 0.35, "generic_curve"),
        ],
        "shelter": [
            FragilityPoint("minor",    130.0, 0.28, "generic_curve"),
            FragilityPoint("moderate", 170.0, 0.28, "generic_curve"),
            FragilityPoint("severe",   210.0, 0.32, "generic_curve"),
            FragilityPoint("collapse", 270.0, 0.32, "generic_curve"),
        ],
    },
    # ─────────────────── SURGE fragility (intensity in meters) ──────────────
    "surge": {
        "wood_power_pole": [
            FragilityPoint("minor",    0.3, 0.50, "generic_curve"),
            FragilityPoint("moderate", 0.6, 0.50, "generic_curve"),
            FragilityPoint("severe",   1.2, 0.55, "generic_curve"),
            FragilityPoint("collapse", 2.0, 0.55, "generic_curve"),
        ],
        "masonry_building": [
            FragilityPoint("minor",    0.5, 0.60, "generic_curve"),
            FragilityPoint("moderate", 1.0, 0.60, "generic_curve"),
            FragilityPoint("severe",   1.8, 0.65, "generic_curve"),
            FragilityPoint("collapse", 3.0, 0.65, "generic_curve"),
        ],
        "thatched_roof_house": [
            FragilityPoint("minor",    0.2, 0.55, "generic_curve"),
            FragilityPoint("moderate", 0.5, 0.60, "generic_curve"),
            FragilityPoint("severe",   0.9, 0.65, "generic_curve"),
            FragilityPoint("collapse", 1.5, 0.65, "generic_curve"),
        ],
        "rcc_building": [
            FragilityPoint("minor",    0.8, 0.50, "generic_curve"),
            FragilityPoint("moderate", 1.5, 0.50, "generic_curve"),
            FragilityPoint("severe",   2.5, 0.55, "generic_curve"),
            FragilityPoint("collapse", 4.0, 0.55, "generic_curve"),
        ],
        "hospital": [
            FragilityPoint("minor",    1.0, 0.45, "generic_curve"),
            FragilityPoint("moderate", 2.0, 0.45, "generic_curve"),
            FragilityPoint("severe",   3.0, 0.50, "generic_curve"),
            FragilityPoint("collapse", 5.0, 0.50, "generic_curve"),
        ],
        "shelter": [
            FragilityPoint("minor",    1.0, 0.42, "generic_curve"),
            FragilityPoint("moderate", 2.2, 0.42, "generic_curve"),
            FragilityPoint("severe",   3.5, 0.45, "generic_curve"),
            FragilityPoint("collapse", 5.5, 0.45, "generic_curve"),
        ],
    },
}

# Fallback for asset classes not in the table
_DEFAULT_WIND_CURVES = FRAGILITY_PARAMS["wind"]["rcc_building"]
_DEFAULT_SURGE_CURVES = FRAGILITY_PARAMS["surge"]["masonry_building"]


def _lognormal_exceedance(intensity: float, median: float, beta: float) -> float:
    """P(damage ≥ ds | intensity) using lognormal CDF."""
    if intensity <= 0 or median <= 0:
        return 0.0
    z = math.log(intensity / median) / beta
    return _norm_cdf(z)


def get_damage_state_probabilities(
    hazard_type: Literal["wind", "surge"],
    intensity: float,
    asset_class: str,
) -> dict[str, float | dict]:
    """
    Compute mutually exclusive damage state probabilities for an asset.

    Method: P(ds=none) = 1 - P(ds≥minor)
            P(ds=minor) = P(ds≥minor) - P(ds≥moderate)
            P(ds=moderate) = P(ds≥moderate) - P(ds≥severe)
            P(ds=severe) = P(ds≥severe) - P(ds≥collapse)
            P(ds=collapse) = P(ds≥collapse)

    Args:
        hazard_type: "wind" or "surge".
        intensity: Wind speed [km/h] or surge height [m].
        asset_class: Asset type string.

    Returns:
        dict with damage_state_probabilities, expected_damage_state, and confidence.
    """
    hazard_table = FRAGILITY_PARAMS.get(hazard_type, {})
    curves: list[FragilityPoint] = (
        hazard_table.get(asset_class)
        or (
            _DEFAULT_WIND_CURVES if hazard_type == "wind" else _DEFAULT_SURGE_CURVES
        )
    )

    # Compute exceedance probabilities for each threshold
    exceedance = {fp.damage_state: _lognormal_exceedance(intensity, fp.median_intensity, fp.beta)
                  for fp in curves}

    confidence = curves[0].confidence if curves else "generic_curve"

    states: dict[str, float] = {}
    states["none"] = max(0.0, 1.0 - exceedance.get("minor", 0.0))
    states["minor"] = max(0.0, exceedance.get("minor", 0.0) - exceedance.get("moderate", 0.0))
    states["moderate"] = max(0.0, exceedance.get("moderate", 0.0) - exceedance.get("severe", 0.0))
    states["severe"] = max(0.0, exceedance.get("severe", 0.0) - exceedance.get("collapse", 0.0))
    states["collapse"] = max(0.0, exceedance.get("collapse", 0.0))

    # Normalise to ensure they sum to 1.0
    total = sum(states.values()) or 1.0
    states = {k: round(v / total, 4) for k, v in states.items()}

    # Expected (most probable) damage state
    expected_ds = max(states, key=lambda k: states[k])  # type: ignore[arg-type]

    return {
        "hazard_type": hazard_type,
        "intensity": intensity,
        "asset_class": asset_class,
        "confidence": confidence,
        "damage_state_probabilities": states,
        "expected_damage_state": expected_ds,
    }
