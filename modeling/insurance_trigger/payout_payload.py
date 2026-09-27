"""
modeling/insurance_trigger/payout_payload.py
Builds and signs the payout-initiation payload.

The payload is a NOTIFICATION and AUDIT ARTIFACT — not an actual funds transfer.
All financial logic is deterministic; Gemini is never involved in the trigger boolean.
"""
import json
import hashlib
from datetime import datetime, timezone
from typing import Any


PAYLOAD_SCHEMA_VERSION = "1.0"


def build_signed_payout_payload(
    trigger_record: dict[str, Any],
    signing_key: str = "DEMO-KEY",
) -> dict[str, Any]:
    """
    Enrich and "sign" a trigger record for dispatch to the insurer webhook.

    Signing in demo mode is an HMAC-SHA256 over the deterministic payload fields.
    In production, replace with an asymmetric signature (e.g., RSA-PSS or EdDSA).
    """
    import hmac

    canonical = _canonical_payload(trigger_record)
    signature = hmac.new(
        signing_key.encode(),
        canonical.encode(),
        hashlib.sha256,
    ).hexdigest()

    return {
        **trigger_record,
        "schema_version": PAYLOAD_SCHEMA_VERSION,
        "payload_signed_at": datetime.now(timezone.utc).isoformat(),
        "signing_key_id": "demo-key-v1",
        "hmac_signature": signature,
        "transmission_note": (
            "This payload is dispatched to a sandbox insurer webhook. "
            "No real funds movement occurs in this demo."
        ),
    }


def _canonical_payload(record: dict[str, Any]) -> str:
    """
    Produce a canonical JSON string for signing.
    Only includes deterministic, non-timestamp fields.
    """
    canonical_fields = {
        "trigger_id":                   record.get("trigger_id"),
        "policy_id":                    record.get("policy_id"),
        "zone_id":                      record.get("zone_id"),
        "event_id":                     record.get("event_id"),
        "trigger_type":                 record.get("trigger_type"),
        "threshold":                    record.get("threshold"),
        "observed_or_forecast_value":   record.get("observed_or_forecast_value"),
        "triggered":                    record.get("triggered"),
        "trigger_timestamp":            record.get("trigger_timestamp"),
        "source_model_version":         record.get("source_model_version"),
        "audit_hash":                   record.get("audit_hash"),
    }
    return json.dumps(canonical_fields, sort_keys=True)


def format_trigger_for_insurer(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Format the payout payload in the expected insurer webhook schema.
    Strips internal fields; keeps only insurer-relevant data.
    """
    return {
        "trigger_notification": {
            "id":            payload["trigger_id"],
            "policy_ref":    payload["policy_id"],
            "zone":          payload["zone_id"],
            "event":         payload["event_id"],
            "index_type":    payload["trigger_type"],
            "threshold":     payload["threshold"],
            "index_value":   payload["observed_or_forecast_value"],
            "confidence":    payload.get("confidence", "forecast"),
            "triggered":     payload["triggered"],
            "issued_at":     payload["trigger_timestamp"],
        },
        "payout": {
            "amount":    payload.get("payout_amount", 0),
            "currency":  payload.get("currency", "USD"),
            "status":    "INITIATED" if payload.get("triggered") else "NOT_TRIGGERED",
        },
        "audit": {
            "model_version": payload["source_model_version"],
            "audit_hash":    payload["audit_hash"],
            "hmac_sig":      payload.get("hmac_signature", ""),
            "schema_version":payload.get("schema_version", PAYLOAD_SCHEMA_VERSION),
        },
        "disclaimer": payload.get("disclaimer", ""),
    }
