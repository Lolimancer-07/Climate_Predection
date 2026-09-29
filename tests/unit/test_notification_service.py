"""
tests/unit/test_notification_service.py

Unit tests for the Unified Notification Service.
Verifies multi-channel dispatch, subscription matching, delivery tracking, and HITL gate.
"""

import pytest
import os
from notifications.subscription_manager import (
    create_subscription,
    list_subscriptions,
    match_subscriptions,
    get_subscription,
)
from notifications.delivery_tracker import (
    record_delivery,
    list_deliveries,
    get_delivery_metrics,
)
from notifications.notification_orchestrator import (
    dispatch_advisory,
    dispatch_daily_digest,
    is_hitl_enforced,
)
from notifications.templates import render_template, load_email_template


def test_template_rendering():
    rendered = render_template(
        "watch",
        {
            "event_name": "Test Cyclone",
            "district_name": "Puri",
            "state_name": "Odisha",
            "advisory_content": "Heavy rainfall expected.",
            "hazard_type": "CYCLONE",
            "lead_time": "36 hours",
            "exposed_population": "50,000",
            "advisory_id": "ADV-001",
        },
    )
    assert "Test Cyclone" in rendered
    assert "Puri" in rendered
    assert "TIER: WATCH" in rendered


def test_subscription_creation_and_matching():
    sub = create_subscription(
        subscriber_type="citizen",
        contact_email="test.citizen@example.com",
        contact_phone="+919999988888",
        district_ids=["IN-OD-PURI"],
        hazard_types=["cyclone", "flood"],
        channels=["email", "sms"],
        frequency="immediate",
    )
    assert sub.subscription_id.startswith("sub-")

    matched = match_subscriptions("IN-OD-PURI", "cyclone")
    matched_ids = [s.subscription_id for s in matched]
    assert sub.subscription_id in matched_ids

    # Unmatched district
    unmatched = match_subscriptions("IN-GJ-KUTCH", "cyclone")
    assert sub.subscription_id not in [s.subscription_id for s in unmatched]


def test_delivery_tracker_records_and_metrics():
    initial_metrics = get_delivery_metrics()
    rec = record_delivery(
        advisory_id="ADV-TEST-100",
        channel="sms",
        recipient="+919876543210",
        status="delivered_sandbox",
    )
    assert rec.delivery_id.startswith("del-")

    deliveries = list_deliveries(limit=5)
    assert any(d["delivery_id"] == rec.delivery_id for d in deliveries)

    updated_metrics = get_delivery_metrics()
    assert updated_metrics["total_dispatches"] >= initial_metrics["total_dispatches"] + 1


@pytest.mark.asyncio
async def test_hitl_gate_blocks_unconfirmed_dispatch():
    os.environ["HITL_ENFORCE_HUMAN_CONFIRMATION"] = "true"
    res = await dispatch_advisory(
        advisory_id="ADV-UNCONFIRMED",
        event_name="Imminent Cyclone",
        district_id="IN-OD-PURI",
        hazard_type="cyclone",
        severity_tier="Warning",
        content="Evacuate low lying areas.",
        operator_confirmed=False,  # Unconfirmed!
    )
    assert res["status"] == "blocked_awaiting_operator_confirmation"


@pytest.mark.asyncio
async def test_hitl_gate_allows_confirmed_dispatch():
    os.environ["HITL_ENFORCE_HUMAN_CONFIRMATION"] = "true"
    res = await dispatch_advisory(
        advisory_id="ADV-CONFIRMED",
        event_name="Imminent Cyclone",
        district_id="IN-OD-PURI",
        hazard_type="cyclone",
        severity_tier="Warning",
        content="Evacuate low lying areas.",
        operator_confirmed=True,  # Confirmed!
        override_channels=["email", "sms", "cap_xml"],
    )
    assert res["status"] == "dispatched"
    assert res["operator_confirmed"] is True
    assert res["total_dispatched"] >= 1
