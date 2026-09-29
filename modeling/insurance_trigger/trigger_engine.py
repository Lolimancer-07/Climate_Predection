"""
modeling/insurance_trigger/trigger_engine.py
Parametric insurance trigger engine.

The trigger boolean is ALWAYS derived from structured hazard data only.
Gemini/LLM output is NEVER used to determine whether a trigger fires.
"""
import uuid
import hashlib
import json
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Literal, Optional


MODEL_VERSION = "trigger-engine-v0.1"

TriggerType = Literal["surge_height", "rainfall_total", "wind_speed", "composite_loss_index"]
Confidence = Literal["forecast", "observed"]


@dataclass
class PolicyZone:
    """Represents a single insured zone within a policy."""
    policy_id: str
    zone_id: str
    trigger_type: TriggerType
    threshold: float            # the contracted trigger level
    currency: str = "USD"
    payout_amount: float = 0.0  # notional payout (for notification only)


@dataclass
class TriggerRecord:
    trigger_id: str
    policy_id: str
    zone_id: str
    event_id: str
    trigger_type: TriggerType
    threshold_value: float
    observed_value: float
    confidence: Confidence
    triggered: bool
    trigger_timestamp: datetime
    source_model_version: str
    audit_hash: str             # SHA-256 of the deterministic trigger inputs
    payout_amount: float = 0.0
    currency: str = "USD"
    notes: str = ""


def evaluate_trigger(
    policy: Optional[PolicyZone] = None,
    event_id: str = "BOB07-2026",
    observed_value: float = 0.0,
    confidence: Confidence = "forecast",
    **kwargs,
) -> Any:
    """
    Compare observed/modeled value against the policy threshold.
    Returns a TriggerRecord — the trigger boolean is deterministic, never LLM-derived.
    Supports direct PolicyZone evaluation or pipeline dictionary inputs.
    """
    if policy is None and "surge_result" in kwargs:
        surge_res = kwargs["surge_result"]
        surge_m = (
            surge_res.get("max_surge_height_m", 0.0)
            if isinstance(surge_res, dict)
            else getattr(surge_res, "surge_height_m", 0.0)
        )
        dist_id = kwargs.get("district_id", "IN-OD-PURI")
        p = PolicyZone(
            policy_id=f"POL-{dist_id}",
            zone_id=dist_id,
            trigger_type="surge_height",
            threshold=kwargs.get("threshold", 3.0),
            currency="USD",
            payout_amount=1_000_000.0,
        )
        rec = evaluate_trigger(
            policy=p,
            event_id=kwargs.get("event_id", event_id),
            observed_value=float(surge_m),
            confidence=confidence,
        )
        return {
            "triggered": rec.triggered,
            "policy_id": rec.policy_id,
            "zone_id": rec.zone_id,
            "event_id": rec.event_id,
            "threshold": rec.threshold_value,
            "observed_value": rec.observed_value,
            "audit_hash": rec.audit_hash,
            "payout_amount": rec.payout_amount,
            "notes": rec.notes,
        }

    assert policy is not None, "policy must be provided for direct evaluation"
    triggered = observed_value >= policy.threshold
    ts = datetime.now(timezone.utc)

    # Deterministic audit hash — makes each trigger record cryptographically verifiable
    audit_payload = json.dumps({
        "policy_id": policy.policy_id,
        "zone_id": policy.zone_id,
        "event_id": event_id,
        "trigger_type": policy.trigger_type,
        "threshold": policy.threshold,
        "observed_value": observed_value,
        "confidence": confidence,
        "triggered": triggered,
        "timestamp": ts.isoformat(),
        "model_version": MODEL_VERSION,
    }, sort_keys=True)
    audit_hash = hashlib.sha256(audit_payload.encode()).hexdigest()

    return TriggerRecord(
        trigger_id=str(uuid.uuid4()),
        policy_id=policy.policy_id,
        zone_id=policy.zone_id,
        event_id=event_id,
        trigger_type=policy.trigger_type,
        threshold_value=policy.threshold,
        observed_value=observed_value,
        confidence=confidence,
        triggered=triggered,
        trigger_timestamp=ts,
        source_model_version=MODEL_VERSION,
        audit_hash=audit_hash,
        payout_amount=policy.payout_amount if triggered else 0.0,
        currency=policy.currency,
        notes=(
            f"Trigger {'FIRED' if triggered else 'NOT FIRED'}: "
            f"{observed_value:.2f} {'≥' if triggered else '<'} {policy.threshold:.2f} "
            f"({policy.trigger_type}, confidence={confidence})"
        ),
    )


def evaluate_all_policies(
    policies: list[PolicyZone],
    event_id: str,
    hazard_values: dict[str, float],
    confidence: Confidence = "forecast",
) -> list[TriggerRecord]:
    """
    Evaluate all policies against a dict of hazard values.

    hazard_values keys: "surge_height", "rainfall_total", "wind_speed",
                        "composite_loss_index"
    """
    records = []
    for policy in policies:
        observed = hazard_values.get(policy.trigger_type, 0.0)
        record = evaluate_trigger(policy, event_id, observed, confidence)
        records.append(record)
    return records


def build_payout_payload(record: TriggerRecord) -> dict:
    """
    Build the signed payout-initiation payload.
    This is a NOTIFICATION and AUDIT ARTIFACT — not an actual funds transfer.
    """
    return {
        "trigger_id": record.trigger_id,
        "policy_id": record.policy_id,
        "zone_id": record.zone_id,
        "event_id": record.event_id,
        "trigger_type": record.trigger_type,
        "threshold": record.threshold_value,
        "observed_or_forecast_value": record.observed_value,
        "confidence": record.confidence,
        "triggered": record.triggered,
        "trigger_timestamp": record.trigger_timestamp.isoformat(),
        "payout_amount": record.payout_amount,
        "currency": record.currency,
        "source_model_version": record.source_model_version,
        "audit_hash": record.audit_hash,
        "disclaimer": (
            "This payload is a parametric trigger notification for demonstration purposes only. "
            "It does not constitute an actual insurance payout or binding financial commitment."
        ),
    }


# ── Demo policies for Puri district ─────────────────────────────────────────

DEMO_POLICIES = [
    PolicyZone(
        policy_id="POL-ODISHA-2024-001",
        zone_id="IN-OD-PURI",
        trigger_type="surge_height",
        threshold=2.0,
        currency="USD",
        payout_amount=500_000,
    ),
    PolicyZone(
        policy_id="POL-ODISHA-2024-002",
        zone_id="IN-OD-PURI",
        trigger_type="rainfall_total",
        threshold=200.0,
        currency="USD",
        payout_amount=250_000,
    ),
    PolicyZone(
        policy_id="POL-ODISHA-2024-003",
        zone_id="IN-OD-PURI",
        trigger_type="wind_speed",
        threshold=150.0,
        currency="USD",
        payout_amount=750_000,
    ),
]
