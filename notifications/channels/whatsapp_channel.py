"""
notifications/channels/whatsapp_channel.py

WhatsApp Business Cloud API Channel.
Dispatches structured warning templates and location pins to field responders.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from notifications.channels.base import NotificationChannel
from dispatch.whatsapp_dispatch import send_whatsapp_text


class WhatsAppNotificationChannel(NotificationChannel):
    channel_name = "whatsapp"

    async def send(
        self,
        recipient: str,
        subject: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        text = f"🚨 *{subject}*\n\n{content}"
        result = await send_whatsapp_text(to=recipient, body=text)
        return {
            "channel": "whatsapp",
            "status": "delivered_sandbox" if result.get("status") == "sandbox_logged" else result.get("status", "sent"),
            "recipient": recipient,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": result,
        }
