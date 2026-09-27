"""
dispatch/insurer_webhook.py
Send parametric trigger notification to insurer webhook endpoint.
"""
import os
import json
import httpx
from datetime import datetime, timezone


MOCK_URL = os.getenv("MOCK_INSURER_WEBHOOK_URL", "http://localhost:9000/mock-insurer/trigger")


async def send_trigger_notification(payload: dict) -> dict:
    """
    POST the payout-initiation payload to the insurer webhook endpoint.
    In demo mode, posts to the mock insurer container.
    This is a NOTIFICATION — not an actual funds transfer.
    """
    webhook_url = os.getenv("INSURER_WEBHOOK_URL", MOCK_URL)

    headers = {
        "Content-Type": "application/json",
        "X-Source": "cyclone-anticipatory-platform",
        "X-Audit-Hash": payload.get("audit_hash", ""),
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(webhook_url, json=payload, headers=headers)
            return {
                "channel": "insurer_webhook",
                "status": "sent",
                "http_status": resp.status_code,
                "response": resp.text[:500],
                "sent_at": datetime.now(timezone.utc).isoformat(),
            }
    except httpx.ConnectError:
        print(f"[INSURER WEBHOOK] Could not reach {webhook_url} — logging payload locally.")
        print(json.dumps(payload, indent=2))
        return {
            "channel": "insurer_webhook",
            "status": "sandbox_logged",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return {
            "channel": "insurer_webhook",
            "status": "error",
            "error": str(e),
        }
