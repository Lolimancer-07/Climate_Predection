"""
notifications/channels/webhook_channel.py

Signed HMAC Webhook Channel for Parametric Insurance Liquidity Triggers.
Dispatches canonical cryptographic payloads to insurer API endpoints.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from notifications.channels.base import NotificationChannel
from dispatch.insurer_webhook import send_trigger_notification


class WebhookNotificationChannel(NotificationChannel):
    channel_name = "webhook"

    async def send(
        self,
        recipient: str,
        subject: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        meta = metadata or {}
        payload = {
            "subject": subject,
            "content": content,
            "metadata": meta,
            "dispatched_at": datetime.now(timezone.utc).isoformat(),
        }
        res = await send_trigger_notification(payload=payload)
        return {
            "channel": "webhook",
            "status": "delivered_sandbox" if res.get("status") == "sandbox_logged" else res.get("status", "sent"),
            "recipient": recipient,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": res,
        }
