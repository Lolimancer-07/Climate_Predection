"""
modeling/rainfall_runoff/flash_flood_model.py
TWI-based rainfall-runoff / flash-flood pathway scoring.
"""
import math
from dataclasses import dataclass
from typing import Literal


SeverityClass = Literal["Low", "Medium", "High", "Severe"]

MODEL_VERSION = "runoff-twi-v0.2"


@dataclass
class RunoffInput:
    ward_id: str
    event_id: str
    rainfall_mm_24h: float
    rainfall_mm_48h: float
    avg_twi: float                  # mean TWI for the ward (dimensionless)
    land_cover_permeability: float  # 0–1, from landcover.py
    district_id: str


@dataclass
class RunoffResult:
    ward_id: str
    event_id: str
    model_version: str
    runoff_risk_score: float        # 0–1
    severity_class: SeverityClass
    rainfall_mm_48h: float
    contributing_factors: dict
    notes: str = ""


def compute_runoff_risk(inp: RunoffInput) -> float:
    """
    Composite runoff risk score (0–1):
        risk = w1 * normalized_rainfall + w2 * normalized_twi + w3 * permeability

    Weights calibrated heuristically against Bay of Bengal flood events.
    """
    # Normalize rainfall (reference maximum ~400mm/48h for extreme BoB events)
    rain_norm = min(inp.rainfall_mm_48h / 400.0, 1.0)

    # Normalize TWI (typical BoB coastal delta range 4–18)
    twi_norm = min(max((inp.avg_twi - 4.0) / 14.0, 0.0), 1.0)

    # Permeability directly as a risk factor (higher = more runoff)
    perm = inp.land_cover_permeability

    # Weighted sum
    w1, w2, w3 = 0.45, 0.30, 0.25
    score = w1 * rain_norm + w2 * twi_norm + w3 * perm

    return round(min(score, 1.0), 3)


def classify_severity(score: float) -> SeverityClass:
    if score < 0.25:
        return "Low"
    elif score < 0.50:
        return "Medium"
    elif score < 0.75:
        return "High"
    else:
        return "Severe"


def run_runoff_model(inp: RunoffInput) -> RunoffResult:
    score = compute_runoff_risk(inp)
    severity = classify_severity(score)

    return RunoffResult(
        ward_id=inp.ward_id,
        event_id=inp.event_id,
        model_version=MODEL_VERSION,
        runoff_risk_score=score,
        severity_class=severity,
        rainfall_mm_48h=inp.rainfall_mm_48h,
        contributing_factors={
            "rainfall_mm_24h": inp.rainfall_mm_24h,
            "rainfall_mm_48h": inp.rainfall_mm_48h,
            "avg_twi": inp.avg_twi,
            "land_cover_permeability": inp.land_cover_permeability,
            "rain_norm": round(min(inp.rainfall_mm_48h / 400.0, 1.0), 3),
        },
        notes=f"TWI-based runoff proxy ({MODEL_VERSION}). "
              "Upgrade path: TOPMODEL or distributed hydrological model.",
    )


# ── Demo convenience ─────────────────────────────────────────────────────────

def fani_ward7_runoff() -> RunoffResult:
    """Pre-computed runoff result for Fani 2019, Puri Ward 7."""
    return run_runoff_model(RunoffInput(
        ward_id="WARD-07",
        event_id="CYCLONE-FANI-2019",
        rainfall_mm_24h=180.0,
        rainfall_mm_48h=280.0,
        avg_twi=12.5,
        land_cover_permeability=0.55,
        district_id="IN-OD-PURI",
    ))
