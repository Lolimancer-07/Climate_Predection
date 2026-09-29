"""
notifications/channels/base.py

Abstract interface for multi-channel disaster alert dispatchers.
Standardizes delivery across Email, SMS, WhatsApp, Web/Mobile Push, CAP 1.2 XML, and Insurer Webhooks.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from datetime import datetime, timezone


class NotificationChannel(ABC):
    channel_name: str

    @abstractmethod
    async def send(
        self,
        recipient: str,
        subject: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Dispatches an advisory or trigger message through the specified communication channel.
        Returns a delivery receipt dict with status, channel, recipient, and timestamps.
        """
        pass
