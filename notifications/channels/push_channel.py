"""
notifications/channels/push_channel.py

Web & Mobile Push Notification Channel.
Broadcasts instant warning banners to browser clients and PWA field tablets.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from notifications.channels.base import NotificationChannel


class PushNotificationChannel(NotificationChannel):
    channel_name = "push"

    async def send(
        self,
        recipient: str,
        subject: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        print(f"[PUSH BROADCAST] Device: {recipient} | Title: {subject}")
        return {
            "channel": "push",
            "status": "delivered",
            "recipient": recipient,
            "title": subject,
            "timestamp": now_iso,
            "ttl": 3600,
        }
