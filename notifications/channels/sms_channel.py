"""
notifications/channels/sms_channel.py

SMS Notification Channel wrapping Twilio API with sandbox fallback.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from notifications.channels.base import NotificationChannel
from dispatch.sms_dispatch import send_sms


class SMSNotificationChannel(NotificationChannel):
    channel_name = "sms"

    async def send(
        self,
        recipient: str,
        subject: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        body = f"[{subject}] {content}"
        result = await send_sms(to=recipient, body=body)
        return {
            "channel": "sms",
            "status": "delivered_sandbox" if result.get("status") == "sandbox_logged" else result.get("status", "sent"),
            "recipient": recipient,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": result,
        }
