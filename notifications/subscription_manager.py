"""
notifications/subscription_manager.py

Subscription Manager for Citizen, DDMA Operator, and Parametric Insurer Opt-Ins.
Allows granular subscription by District, Hazard Peril (8 types), Preferred Channel, and Frequency.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import uuid


@dataclass
class NotificationSubscription:
    subscription_id: str
    subscriber_type: str        # citizen | ddma_operator | insurer | admin
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    district_ids: List[str] = field(default_factory=list)      # e.g., ["IN-OD-PURI", "IN-GJ-KUTCH"]
    hazard_types: List[str] = field(default_factory=list)      # e.g., ["cyclone", "flood"] or ["all"]
    channels: List[str] = field(default_factory=list)          # ["email", "sms", "whatsapp", "push"]
    frequency: str = "immediate"                                # immediate | daily_digest | weekly_digest
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    active: bool = True


# Pre-seeded operational subscriptions for demonstration
_SUBSCRIPTIONS: Dict[str, NotificationSubscription] = {
    "sub-odisha-sdma": NotificationSubscription(
        subscription_id="sub-odisha-sdma",
        subscriber_type="ddma_operator",
        contact_email="eoc@osdma.odisha.gov.in",
        contact_phone="+919437000001",
        district_ids=["IN-OD-PURI", "IN-OD-JAGAT", "IN-OD-KENDR", "IN-OD-GANJ", "IN-OD-BHAD"],
        hazard_types=["cyclone", "flood", "tsunami", "wildfire"],
        channels=["email", "sms", "whatsapp", "push"],
        frequency="immediate",
    ),
    "sub-puri-collector": NotificationSubscription(
        subscription_id="sub-puri-collector",
        subscriber_type="ddma_operator",
        contact_email="collector.puri@odisha.gov.in",
        contact_phone="+919437000002",
        district_ids=["IN-OD-PURI"],
        hazard_types=["cyclone", "flood", "tsunami"],
        channels=["email", "sms", "whatsapp"],
        frequency="immediate",
    ),
    "sub-national-reinsurer": NotificationSubscription(
        subscription_id="sub-national-reinsurer",
        subscriber_type="insurer",
        contact_email="underwriting-alerts@gicre.in",
        district_ids=["ALL"],
        hazard_types=["all"],
        channels=["email", "push"],
        frequency="daily_digest",
    ),
    "sub-coastal-fisherfolk": NotificationSubscription(
        subscription_id="sub-coastal-fisherfolk",
        subscriber_type="citizen",
        contact_phone="+919800000003",
        district_ids=["IN-OD-PURI", "IN-WB-S24P"],
        hazard_types=["cyclone", "tsunami"],
        channels=["sms", "whatsapp"],
        frequency="immediate",
    ),
}


def create_subscription(
    subscriber_type: str,
    district_ids: List[str],
    hazard_types: List[str],
    channels: List[str],
    contact_email: Optional[str] = None,
    contact_phone: Optional[str] = None,
    frequency: str = "immediate",
) -> NotificationSubscription:
    sub_id = f"sub-{uuid.uuid4().hex[:8]}"
    sub = NotificationSubscription(
        subscription_id=sub_id,
        subscriber_type=subscriber_type,
        contact_email=contact_email,
        contact_phone=contact_phone,
        district_ids=district_ids or ["ALL"],
        hazard_types=hazard_types or ["all"],
        channels=channels or ["email"],
        frequency=frequency,
    )
    _SUBSCRIPTIONS[sub_id] = sub
    return sub


def list_subscriptions() -> List[Dict[str, Any]]:
    return [asdict(s) for s in _SUBSCRIPTIONS.values()]


def get_subscription(subscription_id: str) -> Optional[NotificationSubscription]:
    return _SUBSCRIPTIONS.get(subscription_id)


def match_subscriptions(district_id: str, hazard_type: str, frequency: str = "immediate") -> List[NotificationSubscription]:
    """Finds all active subscriptions covering the given district and hazard peril."""
    matched = []
    hazard_type = hazard_type.lower()
    for sub in _SUBSCRIPTIONS.values():
        if not sub.active:
            continue
        
        # Check frequency match
        if frequency and sub.frequency != frequency and sub.frequency != "immediate":
            continue

        # Check district match
        district_match = "ALL" in sub.district_ids or district_id in sub.district_ids
        
        # Check hazard match
        hazard_match = "all" in [h.lower() for h in sub.hazard_types] or hazard_type in [h.lower() for h in sub.hazard_types]

        if district_match and hazard_match:
            matched.append(sub)

    return matched
