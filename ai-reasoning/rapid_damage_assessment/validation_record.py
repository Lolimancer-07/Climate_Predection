"""
ai-reasoning/rapid_damage_assessment/validation_record.py
Validation records — compare Gemini vision damage signal against
pre-landfall structural predictions.

This comparison:
    1. Provides fast initial loss signal for insurers.
    2. Feeds back into model recalibration (surge + fragility curves).
    3. Creates an auditable post-event record for regulatory review.

Human review is MANDATORY before any validation record is accepted as ground truth.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

# Ordered damage state scale for comparison
_DS_RANK = {"none": 0, "minor": 1, "moderate": 2, "severe": 3, "collapse": 4}


@dataclass
class ValidationRecord:
    """
    Per-asset post-event validation record.

    Compares pre-landfall structural prediction against Gemini-observed damage signal.

    Attributes:
        record_id: Unique record UUID.
        event_id: Cyclone event identifier.
        asset_id: Infrastructure asset identifier.
        asset_class: Asset type classification.
        predicted_damage_state: Pre-landfall structural model prediction.
        observed_damage_state: Gemini vision change-detection signal.
        match: True if predicted and observed states agree (within ±1 level).
        match_strict: True if states are exactly equal.
        model_over_predicted: True if prediction was worse than observed (model was conservative).
        model_under_predicted: True if prediction was less severe than observed (dangerous gap).
        observation_confidence: Gemini confidence in the observed damage.
        observation_caveat: Any Gemini-reported image quality caveats.
        predicted_safety_factor: Structural safety factor from pre-landfall model.
        reviewed_by: Operator who reviewed/confirmed this record (None = not yet reviewed).
        human_confirmed: Whether a human operator has confirmed this record.
        created_at: Record creation timestamp (UTC).
        notes: Additional notes.
    """
    record_id: str
    event_id: str
    asset_id: str
    asset_class: str
    predicted_damage_state: str
    observed_damage_state: str
    match: bool
    match_strict: bool
    model_over_predicted: bool
    model_under_predicted: bool
    observation_confidence: str
    observation_caveat: str
    predicted_safety_factor: float
    reviewed_by: str | None = None
    human_confirmed: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialise to dict for DB storage or API response."""
        return {
            "record_id": self.record_id,
            "event_id": self.event_id,
            "asset_id": self.asset_id,
            "asset_class": self.asset_class,
            "predicted_damage_state": self.predicted_damage_state,
            "observed_damage_state": self.observed_damage_state,
            "match": self.match,
            "match_strict": self.match_strict,
            "model_over_predicted": self.model_over_predicted,
            "model_under_predicted": self.model_under_predicted,
            "observation_confidence": self.observation_confidence,
            "observation_caveat": self.observation_caveat,
            "predicted_safety_factor": self.predicted_safety_factor,
            "reviewed_by": self.reviewed_by,
            "human_confirmed": self.human_confirmed,
            "created_at": self.created_at.isoformat(),
            "notes": self.notes,
        }


def _compare_damage_states(predicted: str, observed: str) -> dict:
    """
    Compare predicted and observed damage states.

    Returns:
        dict with match, match_strict, model_over_predicted, model_under_predicted.
    """
    p_rank = _DS_RANK.get(predicted, 0)
    o_rank = _DS_RANK.get(observed, 0)
    delta = p_rank - o_rank  # positive → model predicted worse than observed

    return {
        "match_strict": predicted == observed,
        "match": abs(delta) <= 1,   # ±1 level tolerance
        "model_over_predicted": delta > 1,   # model was too conservative
        "model_under_predicted": delta < -1,  # dangerous: model missed damage
    }


def create_validation_records(
    event_id: str,
    structural_assessments: list[dict],
    change_detection_results: list[dict],
) -> list[ValidationRecord]:
    """
    Create validation records by pairing structural predictions with observed damage.

    Args:
        event_id: Cyclone event identifier.
        structural_assessments: List of assessment dicts with keys:
            asset_id, asset_class, combined_expected_damage_state, safety_factor.
        change_detection_results: List of dicts with keys:
            asset_id, overall_damage_signal, confidence_overall, caveat.

    Returns:
        List of ValidationRecord (not yet confirmed — human review required).
    """
    # Index by asset_id for pairing
    observed_by_asset: dict[str, dict] = {
        r["asset_id"]: r for r in change_detection_results
    }

    records: list[ValidationRecord] = []

    for pred in structural_assessments:
        asset_id = pred["asset_id"]
        predicted_ds = pred.get("combined_expected_damage_state", "none")
        safety_factor = float(pred.get("safety_factor", 999.0))
        asset_class = pred.get("asset_class", "default")

        observed = observed_by_asset.get(asset_id, {})
        observed_ds = observed.get("overall_damage_signal", "none")
        obs_confidence = observed.get("confidence_overall", "low")
        obs_caveat = observed.get("caveat", "No observation available.")

        comparison = _compare_damage_states(predicted_ds, observed_ds)

        notes: list[str] = []
        if comparison["model_under_predicted"]:
            notes.append(
                "⚠️ Model under-predicted damage. Review surge/fragility parameters "
                "for this asset class. Prioritise for model recalibration."
            )
        if obs_confidence == "low":
            notes.append(
                "Gemini observation confidence is LOW — image quality or cloud cover "
                "may have limited analysis. Do not treat as definitive ground truth."
            )
        notes.append(
            "This record requires human operator confirmation before it is accepted "
            "as verified post-event ground truth."
        )

        records.append(
            ValidationRecord(
                record_id=str(uuid.uuid4()),
                event_id=event_id,
                asset_id=asset_id,
                asset_class=asset_class,
                predicted_damage_state=predicted_ds,
                observed_damage_state=observed_ds,
                match=comparison["match"],
                match_strict=comparison["match_strict"],
                model_over_predicted=comparison["model_over_predicted"],
                model_under_predicted=comparison["model_under_predicted"],
                observation_confidence=obs_confidence,
                observation_caveat=obs_caveat,
                predicted_safety_factor=safety_factor,
                human_confirmed=False,
                notes=notes,
            )
        )

    return records


def summarise_validation_batch(records: list[ValidationRecord]) -> dict:
    """
    Summarise a batch of validation records for reporting.

    Args:
        records: List of ValidationRecord.

    Returns:
        dict with accuracy metrics and calibration recommendations.
    """
    if not records:
        return {"total": 0, "note": "No validation records to summarise."}

    total = len(records)
    match_count = sum(1 for r in records if r.match)
    strict_match_count = sum(1 for r in records if r.match_strict)
    under_predicted = [r for r in records if r.model_under_predicted]
    over_predicted = [r for r in records if r.model_over_predicted]
    unconfirmed = [r for r in records if not r.human_confirmed]

    return {
        "total": total,
        "match_within_1_level": match_count,
        "strict_exact_match": strict_match_count,
        "match_rate_pct": round(match_count / total * 100, 1),
        "strict_match_rate_pct": round(strict_match_count / total * 100, 1),
        "under_predicted_count": len(under_predicted),
        "over_predicted_count": len(over_predicted),
        "unconfirmed_count": len(unconfirmed),
        "recalibration_recommended": len(under_predicted) > total * 0.15,
        "note": (
            "Model under-predicted damage for >15% of assets. "
            "Surge constants and fragility curves should be recalibrated. "
            "See notebooks/03_insurance_trigger_backtest.ipynb."
        ) if len(under_predicted) > total * 0.15 else (
            "Model accuracy within acceptable bounds for screening-level assessment."
        ),
    }
