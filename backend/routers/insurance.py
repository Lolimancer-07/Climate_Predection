"""
backend/routers/insurance.py
Insurance trigger evaluation and notification endpoints.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from modeling.insurance_trigger.trigger_engine import (
    PolicyZone, evaluate_all_policies, build_payout_payload, DEMO_POLICIES
)

router = APIRouter()

# In-memory trigger store for demo
_trigger_store: dict[str, dict] = {}


class TriggerListItem(BaseModel):
    trigger_id: str
    policy_id: str
    zone_id: str
    trigger_type: str
    threshold_value: float
    observed_value: float
    triggered: bool
    trigger_timestamp: str
    audit_hash: str
    notes: str


class EvaluateRequest(BaseModel):
    event_id: str
    hazard_values: dict[str, float]   # e.g. {"surge_height": 2.6, "rainfall_total": 280}
    confidence: str = "forecast"      # forecast | observed


@router.post("/triggers/evaluate", status_code=201)
async def evaluate_triggers(req: EvaluateRequest):
    """
    Evaluate all registered policies against current hazard values.
    Returns trigger records; stores them for retrieval.
    """
    records = evaluate_all_policies(
        policies=DEMO_POLICIES,
        event_id=req.event_id,
        hazard_values=req.hazard_values,
        confidence=req.confidence,
    )

    stored = []
    for r in records:
        payload = build_payout_payload(r)
        _trigger_store[r.trigger_id] = payload
        stored.append(payload)

    return {
        "event_id": req.event_id,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "triggers": stored,
        "fired_count": sum(1 for r in records if r.triggered),
    }


@router.get("/triggers/{event_id}", response_model=list[TriggerListItem])
async def list_triggers(event_id: str):
    """List all insurance trigger evaluations for an event."""
    triggers = [
        TriggerListItem(
            trigger_id=v["trigger_id"],
            policy_id=v["policy_id"],
            zone_id=v["zone_id"],
            trigger_type=v["trigger_type"],
            threshold_value=v["threshold"],
            observed_value=v["observed_or_forecast_value"],
            triggered=v["triggered"],
            trigger_timestamp=v["trigger_timestamp"],
            audit_hash=v["audit_hash"],
            notes=v.get("disclaimer", ""),
        )
        for v in _trigger_store.values()
        if v.get("event_id") == event_id
    ]
    return triggers


@router.post("/triggers/{trigger_id}/notify")
async def notify_trigger(trigger_id: str, operator_id: str = "DEMO_OPERATOR"):
    """
    Dispatch a trigger notification to the insurer webhook.
    Requires explicit operator call — no autonomous dispatch.
    """
    if trigger_id not in _trigger_store:
        raise HTTPException(status_code=404, detail="Trigger not found.")

    payload = _trigger_store[trigger_id]

    if not payload.get("triggered"):
        return {"status": "skipped", "reason": "Trigger not fired — no notification sent."}

    from dispatch.insurer_webhook import send_trigger_notification
    result = await send_trigger_notification(payload)

    # Generate Gemini plain-language notice
    from ai_reasoning.advisory_generator import generate_trigger_notice
    notice_text = generate_trigger_notice(payload)

    return {
        "trigger_id": trigger_id,
        "webhook_result": result,
        "trigger_notice": notice_text,
        "operator_id": operator_id,
        "notified_at": datetime.now(timezone.utc).isoformat(),
    }
