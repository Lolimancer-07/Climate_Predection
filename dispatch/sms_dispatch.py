"""
dispatch/sms_dispatch.py
Twilio SMS dispatch (sandbox mode for demo).
"""
import os
from typing import Optional


async def send_sms(to: str, body: str) -> dict:
    """
    Send an SMS via Twilio.
    In sandbox mode (TWILIO_FROM_NUMBER = Twilio magic number), messages are logged only.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER", "+15005550006")

    if not account_sid or not auth_token:
        print(f"[SMS SANDBOX] To: {to} | Body: {body[:100]}...")
        return {"channel": "sms", "status": "sandbox_logged", "to": to}

    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=body[:1600],   # SMS limit
            from_=from_number,
            to=to,
        )
        return {
            "channel": "sms",
            "status": "sent",
            "sid": message.sid,
            "to": to,
        }
    except Exception as e:
        return {"channel": "sms", "status": "error", "error": str(e), "to": to}
