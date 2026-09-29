"""
notifications/channels/cap_channel.py

OASIS Common Alerting Protocol (CAP 1.2) XML Channel.
Interoperable with NDMA SACHET, State EOC gateways, and WMO Alert Hub.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timezone
from notifications.channels.base import NotificationChannel
from dispatch.cap_alert import build_cap_xml


class CAPNotificationChannel(NotificationChannel):
    channel_name = "cap_xml"

    async def send(
        self,
        recipient: str,
        subject: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        meta = metadata or {}
        advisory_id = meta.get("advisory_id", f"ADV-{int(datetime.now().timestamp())}")
        severity = meta.get("severity", "Severe")
        area_desc = meta.get("area_desc", "Affected District")

        cap_xml = build_cap_xml(
            advisory_id=advisory_id,
            content=content,
            event_name=subject,
            area_desc=area_desc,
            severity=severity,
        )

        return {
            "channel": "cap_xml",
            "status": "generated",
            "recipient": recipient,
            "advisory_id": advisory_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "xml_payload": cap_xml,
            "sachet_ready": True,
        }
