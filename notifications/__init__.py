"""
notifications package
Unified multi-channel notification and alert service for the KAVACH platform.
"""

from notifications.subscription_manager import (
    NotificationSubscription,
    create_subscription,
    list_subscriptions,
    get_subscription,
    match_subscriptions,
)
from notifications.delivery_tracker import (
    DeliveryRecord,
    record_delivery,
    list_deliveries,
    get_delivery_metrics,
)
from notifications.notification_orchestrator import (
    dispatch_advisory,
    dispatch_daily_digest,
    is_hitl_enforced,
)

__all__ = [
    "NotificationSubscription",
    "create_subscription",
    "list_subscriptions",
    "get_subscription",
    "match_subscriptions",
    "DeliveryRecord",
    "record_delivery",
    "list_deliveries",
    "get_delivery_metrics",
    "dispatch_advisory",
    "dispatch_daily_digest",
    "is_hitl_enforced",
]
