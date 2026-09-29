"""
backend/routers/notifications.py

FastAPI router for the Unified Notification Service.
Exposes subscription onboarding, delivery audit querying,
and human-in-the-loop multi-channel advisory and daily digest dispatches.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

from notifications.subscription_manager import (
    create_subscription,
    list_subscriptions,
    get_subscription,
)
from notifications.delivery_tracker import list_deliveries, get_delivery_metrics
from notifications.notification_orchestrator import (
    dispatch_advisory,
    dispatch_daily_digest,
    is_hitl_enforced,
)

router = APIRouter(prefix="/v1/notifications", tags=["Unified Notification Service"])


class SubscriptionCreateRequest(BaseModel):
    subscriber_type: str = Field(..., description="citizen | ddma_operator | insurer | admin")
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    district_ids: List[str] = Field(default_factory=lambda: ["ALL"])
    hazard_types: List[str] = Field(default_factory=lambda: ["all"])
    channels: List[str] = Field(default_factory=lambda: ["email"])
    frequency: str = Field(default="immediate", description="immediate | daily_digest | weekly_digest")


class AdvisoryDispatchRequest(BaseModel):
    advisory_id: str
    event_name: str
    district_id: str
    hazard_type: str
    severity_tier: str
    content: str
    operator_confirmed: bool = Field(False, description="Strict HITL confirmation flag")
    override_channels: Optional[List[str]] = None
    custom_recipients: Optional[Dict[str, List[str]]] = None
    metadata: Optional[Dict[str, Any]] = None


@router.post("/subscribe")
async def subscribe(req: SubscriptionCreateRequest):
    """Creates a new opt-in notification subscription for citizens, operators, or insurers."""
    sub = create_subscription(
        subscriber_type=req.subscriber_type,
        contact_email=req.contact_email,
        contact_phone=req.contact_phone,
        district_ids=req.district_ids,
        hazard_types=req.hazard_types,
        channels=req.channels,
        frequency=req.frequency,
    )
    return {
        "status": "subscribed",
        "subscription_id": sub.subscription_id,
        "subscription": sub,
    }


@router.get("/subscriptions")
async def get_subscriptions():
    """Lists all active notification subscriptions."""
    return {"subscriptions": list_subscriptions()}


@router.get("/deliveries")
async def get_deliveries(
    limit: int = Query(50, ge=1, le=500),
    subscription_id: Optional[str] = None,
):
    """Retrieves delivery audit records."""
    return {"deliveries": list_deliveries(limit=limit, subscription_id=subscription_id)}


@router.get("/metrics")
async def get_metrics():
    """Returns multi-channel delivery metrics (success rate, channel breakdown)."""
    return get_delivery_metrics()


@router.post("/dispatch")
async def dispatch_multi_hazard_advisory(req: AdvisoryDispatchRequest):
    """
    Dispatches a multi-hazard advisory through subscribed channels.
    ENFORCES MANDATORY HUMAN CONFIRMATION if HITL is enabled.
    """
    res = await dispatch_advisory(
        advisory_id=req.advisory_id,
        event_name=req.event_name,
        district_id=req.district_id,
        hazard_type=req.hazard_type,
        severity_tier=req.severity_tier,
        content=req.content,
        operator_confirmed=req.operator_confirmed,
        override_channels=req.override_channels,
        custom_recipients=req.custom_recipients,
        metadata=req.metadata,
    )
    return res


@router.post("/digest/send")
async def send_national_daily_digest(operator_confirmed: bool = Body(True, embed=True)):
    """Triggers generation and dispatch of the all-India multi-hazard daily situational digest."""
    res = await dispatch_daily_digest(operator_confirmed=operator_confirmed)
    return res
