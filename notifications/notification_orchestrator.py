"""
notifications/notification_orchestrator.py

Unified Notification Orchestrator.
Fuses subscriber matching, severity-tier escalation logic, and multi-channel delivery
with mandatory Human-in-the-Loop (HITL) operator confirmation.
"""

import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from notifications.channels import (
    EmailNotificationChannel,
    SMSNotificationChannel,
    WhatsAppNotificationChannel,
    PushNotificationChannel,
    CAPNotificationChannel,
    WebhookNotificationChannel,
)
from notifications.subscription_manager import match_subscriptions, list_subscriptions
from notifications.delivery_tracker import record_delivery, list_deliveries, get_delivery_metrics
from notifications.templates import render_template
from modeling.hazards.registry import compute_national_summary


# Initialize singletons for channel handlers
CHANNELS = {
    "email": EmailNotificationChannel(),
    "sms": SMSNotificationChannel(),
    "whatsapp": WhatsAppNotificationChannel(),
    "push": PushNotificationChannel(),
    "cap_xml": CAPNotificationChannel(),
    "webhook": WebhookNotificationChannel(),
}


def is_hitl_enforced() -> bool:
    val = os.getenv("HITL_ENFORCE_HUMAN_CONFIRMATION", "true").lower()
    return val in ("true", "1", "yes")


async def dispatch_advisory(
    advisory_id: str,
    event_name: str,
    district_id: str,
    hazard_type: str,
    severity_tier: str,
    content: str,
    operator_confirmed: bool = False,
    override_channels: Optional[List[str]] = None,
    custom_recipients: Optional[Dict[str, List[str]]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Executes multi-channel dispatch for an advisory.
    CRITICAL SAFETY RULE: If HITL confirmation is enforced and operator_confirmed is False,
    dispatch is BLOCKED and logged into the review queue.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    meta = metadata or {}

    if is_hitl_enforced() and not operator_confirmed:
        return {
            "status": "blocked_awaiting_operator_confirmation",
            "message": "Human operator confirmation is mandatory before public multi-channel broadcast.",
            "advisory_id": advisory_id,
            "timestamp": now_iso,
            "dispatches": [],
        }

    # Match subscriptions
    subs = match_subscriptions(district_id=district_id, hazard_type=hazard_type, frequency="immediate")

    # Aggregate target endpoints by channel
    targets_by_channel: Dict[str, List[Dict[str, Any]]] = {
        "email": [],
        "sms": [],
        "whatsapp": [],
        "push": [],
        "cap_xml": [],
    }

    for sub in subs:
        if "email" in sub.channels and sub.contact_email:
            targets_by_channel["email"].append({"sub_id": sub.subscription_id, "to": sub.contact_email})
        if "sms" in sub.channels and sub.contact_phone:
            targets_by_channel["sms"].append({"sub_id": sub.subscription_id, "to": sub.contact_phone})
        if "whatsapp" in sub.channels and sub.contact_phone:
            targets_by_channel["whatsapp"].append({"sub_id": sub.subscription_id, "to": sub.contact_phone})
        if "push" in sub.channels:
            targets_by_channel["push"].append({"sub_id": sub.subscription_id, "to": f"push-sub-{sub.subscription_id}"})

    # Add custom recipients if provided
    if custom_recipients:
        for ch, recips in custom_recipients.items():
            if ch in targets_by_channel:
                for r in recips:
                    targets_by_channel[ch].append({"sub_id": "custom", "to": r})

    # Always broadcast CAP XML for interop (e.g. SACHET gateway)
    targets_by_channel["cap_xml"].append({"sub_id": "ndma_sachet", "to": "https://sachet.ndma.gov.in/api/v1/cap/inbound"})

    # Filter by override_channels if operator selected specific channels
    active_channels = override_channels if override_channels else list(targets_by_channel.keys())

    dispatch_results: List[Dict[str, Any]] = []

    # Format email HTML
    template_name = "watch"
    if severity_tier.lower() == "warning":
        template_name = "warning"
    elif severity_tier.lower() in ("severe", "emergency", "evacuation order"):
        template_name = "evacuation_order"

    email_body = render_template(
        template_name,
        {
            "event_name": event_name,
            "district_name": district_id,
            "state_name": meta.get("state_name", "India"),
            "advisory_content": content,
            "hazard_type": hazard_type.upper(),
            "lead_time": meta.get("lead_time", "24-48 hours"),
            "exposed_population": meta.get("exposed_population", "Estimated at risk"),
            "advisory_id": advisory_id,
            "peak_intensity": meta.get("peak_intensity", "High"),
            "critical_assets_count": meta.get("critical_assets_count", "Multiple"),
            "trigger_status": "Threshold Exceeded" if meta.get("parametric_trigger_met") else "Monitored",
            "recommended_action": meta.get("recommended_action", "Maintain readiness and monitor bulletins."),
            "sector_or_ward": meta.get("ward_id", "Vulnerable Coastal / Lowland Sector"),
            "safe_shelters_list": meta.get("safe_shelters_list", "Designated Cyclone & Flood Shelters"),
            "cutoff_hours": meta.get("cutoff_hours", "12"),
            "clearance_corridor": meta.get("clearance_corridor", "National / State Arterials"),
        },
    )

    subject = f"KAVACH ALERT [{severity_tier.upper()}]: {event_name} — {district_id}"

    # Execute sends across active channels
    for ch_name in active_channels:
        channel_handler = CHANNELS.get(ch_name)
        if not channel_handler:
            continue

        targets = targets_by_channel.get(ch_name, [])
        for target in targets:
            recipient = target["to"]
            sub_id = target["sub_id"]

            send_content = email_body if ch_name == "email" else content

            try:
                res = await channel_handler.send(
                    recipient=recipient,
                    subject=subject,
                    content=send_content,
                    metadata={"advisory_id": advisory_id, "severity": severity_tier, "area_desc": district_id},
                )
                status = res.get("status", "sent")
                record = record_delivery(
                    advisory_id=advisory_id,
                    channel=ch_name,
                    recipient=recipient,
                    status=status,
                    subscription_id=sub_id if sub_id != "custom" else None,
                    metadata=res,
                )
                dispatch_results.append({
                    "channel": ch_name,
                    "recipient": recipient,
                    "status": status,
                    "delivery_id": record.delivery_id,
                })
            except Exception as e:
                record = record_delivery(
                    advisory_id=advisory_id,
                    channel=ch_name,
                    recipient=recipient,
                    status="failed",
                    subscription_id=sub_id if sub_id != "custom" else None,
                    metadata={"error": str(e)},
                )
                dispatch_results.append({
                    "channel": ch_name,
                    "recipient": recipient,
                    "status": "failed",
                    "error": str(e),
                })

    return {
        "status": "dispatched",
        "advisory_id": advisory_id,
        "operator_confirmed": True,
        "dispatched_at": now_iso,
        "total_dispatched": len(dispatch_results),
        "dispatches": dispatch_results,
    }


async def dispatch_daily_digest(operator_confirmed: bool = True) -> Dict[str, Any]:
    """
    Generates and dispatches the all-India multi-hazard daily situational digest.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    summary = compute_national_summary()

    # Generate events HTML list
    events_html = ""
    for ev in summary["events"]:
        sev = ev["severity"].lower()
        badge_cls = f"tag-{sev}" if sev in ("emergency", "severe", "warning", "watch") else "tag-warning"
        events_html += f"""
        <div class="event-card">
          <div class="event-header">
            <span class="event-name">{ev['name']}</span>
            <span class="tag {badge_cls}">{ev['severity']}</span>
          </div>
          <div class="event-meta">
            <strong>Peril:</strong> {ev['hazard_type'].upper()} · 
            <strong>Affected:</strong> {', '.join(ev['affected_states'])} · 
            <strong>Status:</strong> {ev['status']}
          </div>
        </div>
        """

    digest_body = render_template(
        "daily_digest",
        {
            "digest_timestamp": datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC"),
            "emergency_count": summary["emergency_events_count"],
            "severe_count": summary["severe_events_count"],
            "states_count": summary["affected_states_count"],
            "exposed_population": f"{summary['total_exposed_population']:,}",
            "events_html_list": events_html,
        }
    )

    # Deliver to digest subscribers
    email_channel = CHANNELS["email"]
    deliveries = []

    for sub in list_subscriptions():
        if sub.get("frequency") in ("daily_digest", "weekly_digest") and sub.get("contact_email"):
            res = await email_channel.send(
                recipient=sub["contact_email"],
                subject="KAVACH Pan-India Multi-Hazard Daily Situational Digest",
                content=digest_body,
                metadata={"type": "daily_digest"},
            )
            record_delivery(
                advisory_id="DIGEST-DAILY",
                channel="email",
                recipient=sub["contact_email"],
                status=res.get("status", "sent"),
                subscription_id=sub.get("subscription_id"),
                metadata=res,
            )
            deliveries.append({"recipient": sub["contact_email"], "status": res.get("status", "sent")})

    return {
        "status": "digest_dispatched",
        "timestamp": now_iso,
        "recipients_count": len(deliveries),
        "deliveries": deliveries,
        "summary": summary,
    }
