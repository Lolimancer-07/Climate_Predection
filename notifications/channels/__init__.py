"""
notifications/channels package
Multi-channel dispatch adapters for early warnings and parametric insurance triggers.
"""

from notifications.channels.base import NotificationChannel
from notifications.channels.email_channel import EmailNotificationChannel
from notifications.channels.sms_channel import SMSNotificationChannel
from notifications.channels.whatsapp_channel import WhatsAppNotificationChannel
from notifications.channels.push_channel import PushNotificationChannel
from notifications.channels.cap_channel import CAPNotificationChannel
from notifications.channels.webhook_channel import WebhookNotificationChannel

__all__ = [
    "NotificationChannel",
    "EmailNotificationChannel",
    "SMSNotificationChannel",
    "WhatsAppNotificationChannel",
    "PushNotificationChannel",
    "CAPNotificationChannel",
    "WebhookNotificationChannel",
]
