"""
dispatch/whatsapp_dispatch.py
WhatsApp Business Cloud API integration (Meta Graph API).
Uses sandbox / test number for demo mode.
"""
import os
import json
import httpx
from typing import Optional


GRAPH_API_VERSION = "v20.0"
GRAPH_API_BASE    = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


async def send_whatsapp_text(
    to: str,
    body: str,
    phone_number_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict:
    """
    Send a plain-text WhatsApp message via the Meta Graph API.
    Falls back to sandbox logging if credentials are absent.
    """
    phone_number_id = phone_number_id or os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    access_token    = access_token    or os.getenv("WHATSAPP_ACCESS_TOKEN")

    if not phone_number_id or not access_token:
        print(f"[WHATSAPP SANDBOX] To: {to}\nBody: {body[:200]}…")
        return {"channel": "whatsapp", "status": "sandbox_logged", "to": to}

    url = f"{GRAPH_API_BASE}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type":  "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type":    "individual",
        "to":                to,
        "type":              "text",
        "text":              {"preview_url": False, "body": body[:4096]},
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, headers=headers, json=payload)
            data = resp.json()
            if resp.status_code == 200:
                return {
                    "channel": "whatsapp",
                    "status":  "sent",
                    "message_id": data.get("messages", [{}])[0].get("id"),
                    "to": to,
                }
            return {
                "channel": "whatsapp",
                "status":  "error",
                "http_status": resp.status_code,
                "error": data,
                "to": to,
            }
    except Exception as e:
        return {"channel": "whatsapp", "status": "error", "error": str(e), "to": to}


async def send_whatsapp_advisory(
    to: str,
    advisory_en: str,
    cyclone_name: str,
    severity_tier: str,
    phone_number_id: Optional[str] = None,
    access_token: Optional[str] = None,
) -> dict:
    """
    Format an advisory as a WhatsApp message with a header summary
    and send it. WhatsApp has a 4096 char limit.
    """
    header = f"🌀 *CYCLONE {cyclone_name.upper()} — {severity_tier.upper()}*\n\n"
    message = header + advisory_en
    return await send_whatsapp_text(
        to=to,
        body=message[:4096],
        phone_number_id=phone_number_id,
        access_token=access_token,
    )
