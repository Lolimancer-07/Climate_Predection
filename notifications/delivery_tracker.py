"""
notifications/delivery_tracker.py

Delivery Tracker & Audit Trail for Multi-Hazard Disaster Alerts.
Maintains persistent/in-memory records of dispatch timestamps, receipt confirmations,
and delivery failures across Email, SMS, WhatsApp, Push, and Webhooks.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import uuid


@dataclass
class DeliveryRecord:
    delivery_id: str
    advisory_id: str
    channel: str
    recipient: str
    status: str                         # sent | delivered | delivered_sandbox | bounced | failed
    sent_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    subscription_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


_DELIVERY_LOG: List[DeliveryRecord] = []


def record_delivery(
    advisory_id: str,
    channel: str,
    recipient: str,
    status: str,
    subscription_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> DeliveryRecord:
    record = DeliveryRecord(
        delivery_id=f"del-{uuid.uuid4().hex[:10]}",
        advisory_id=advisory_id,
        channel=channel,
        recipient=recipient,
        status=status,
        subscription_id=subscription_id,
        metadata=metadata or {},
    )
    _DELIVERY_LOG.insert(0, record)
    return record


def list_deliveries(limit: int = 50, subscription_id: Optional[str] = None) -> List[Dict[str, Any]]:
    records = _DELIVERY_LOG
    if subscription_id:
        records = [r for r in records if r.subscription_id == subscription_id]
    return [asdict(r) for r in records[:limit]]


def get_delivery_metrics() -> Dict[str, Any]:
    total = len(_DELIVERY_LOG)
    delivered = sum(1 for r in _DELIVERY_LOG if "delivered" in r.status or r.status == "sent")
    failed = sum(1 for r in _DELIVERY_LOG if r.status in ("failed", "bounced"))
    
    by_channel: Dict[str, int] = {}
    for r in _DELIVERY_LOG:
        by_channel[r.channel] = by_channel.get(r.channel, 0) + 1

    return {
        "total_dispatches": total,
        "successful_deliveries": delivered,
        "failed_deliveries": failed,
        "success_rate_pct": round((delivered / total * 100), 1) if total > 0 else 100.0,
        "channel_breakdown": by_channel,
    }
