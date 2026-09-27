"""
backend/routers/advisory.py
Advisory generation, review, and dispatch endpoints.
"""
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import get_db
from backend.db.models import Advisory, DispatchLog

router = APIRouter()

# In-memory store for demo (replace with DB in production)
_advisory_store: dict[str, dict] = {}


class GenerateRequest(BaseModel):
    ward_id: str
    event_id: str
    severity_tier: str          # Watch | Warning | Evacuation Order
    local_language: str = "Odia"
    risk_payload: dict          # full ward risk JSON


class ReviewRequest(BaseModel):
    reviewed_by: str
    approved: bool
    edited_content_en: Optional[str] = None
    edited_content_local: Optional[str] = None


class DispatchRequest(BaseModel):
    channels: list[str]         # sms | whatsapp | cap_xml | pdf
    recipients: list[str]
    operator_id: str


class AdvisoryOut(BaseModel):
    advisory_id: str
    ward_id: str
    event_id: str
    severity_tier: str
    content_en: str
    content_local: str
    validation_passed: bool
    validation_warnings: list[str]
    status: str                 # draft | reviewed | dispatched


@router.post("/generate", response_model=AdvisoryOut, status_code=201)
async def generate_advisory_endpoint(req: GenerateRequest):
    """
    Trigger Gemini advisory generation for a given ward + event.
    Returns a draft advisory for human review.
    """
    from ai_reasoning.advisory_generator import generate_advisory
    import uuid

    draft = generate_advisory(
        risk_payload=req.risk_payload,
        severity_tier=req.severity_tier,
        local_language=req.local_language,
    )

    advisory_id = str(uuid.uuid4())
    record = {
        "advisory_id": advisory_id,
        "ward_id": req.ward_id,
        "event_id": req.event_id,
        "severity_tier": req.severity_tier,
        "content_en": draft.content_en,
        "content_local": draft.content_local,
        "validation_passed": draft.validation_passed,
        "validation_warnings": draft.validation_warnings,
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _advisory_store[advisory_id] = record
    return AdvisoryOut(**record)


@router.post("/{advisory_id}/review", response_model=AdvisoryOut)
async def review_advisory(advisory_id: str, req: ReviewRequest):
    """
    Human operator approves/edits a draft advisory.
    CRITICAL: No advisory leaves the system without this step.
    """
    if advisory_id not in _advisory_store:
        raise HTTPException(status_code=404, detail="Advisory not found.")

    record = _advisory_store[advisory_id]
    if not req.approved:
        record["status"] = "rejected"
        return AdvisoryOut(**record)

    if req.edited_content_en:
        record["content_en"] = req.edited_content_en
    if req.edited_content_local:
        record["content_local"] = req.edited_content_local

    record["status"] = "reviewed"
    record["reviewed_by"] = req.reviewed_by
    return AdvisoryOut(**record)


@router.post("/{advisory_id}/dispatch")
async def dispatch_advisory(advisory_id: str, req: DispatchRequest):
    """
    Send an approved advisory via selected channel(s).
    Requires status='reviewed' — enforces human-in-the-loop gate.
    """
    if advisory_id not in _advisory_store:
        raise HTTPException(status_code=404, detail="Advisory not found.")

    record = _advisory_store[advisory_id]
    if record["status"] != "reviewed":
        raise HTTPException(
            status_code=400,
            detail="Advisory must be reviewed and approved before dispatch. "
                   "Human-in-the-loop gate not cleared.",
        )

    results = []
    for channel in req.channels:
        for recipient in req.recipients:
            result = await _dispatch_to_channel(
                channel=channel,
                recipient=recipient,
                content_en=record["content_en"],
                advisory_id=advisory_id,
            )
            results.append(result)

    record["status"] = "dispatched"
    record["dispatched_at"] = datetime.now(timezone.utc).isoformat()
    record["dispatched_by"] = req.operator_id

    return {"advisory_id": advisory_id, "dispatch_results": results}


async def _dispatch_to_channel(channel: str, recipient: str, content_en: str, advisory_id: str) -> dict:
    """Route to the appropriate dispatch module."""
    from dispatch.sms_dispatch import send_sms
    from dispatch.cap_alert import build_cap_xml

    if channel == "sms":
        status = await send_sms(to=recipient, body=content_en[:1600])
    elif channel == "cap_xml":
        xml_content = build_cap_xml(advisory_id=advisory_id, content=content_en)
        status = {"channel": "cap_xml", "status": "generated", "bytes": len(xml_content)}
    else:
        status = {"channel": channel, "status": "sandbox_mode", "recipient": recipient}

    return status


@router.get("/{advisory_id}", response_model=AdvisoryOut)
async def get_advisory(advisory_id: str):
    if advisory_id not in _advisory_store:
        raise HTTPException(status_code=404, detail="Advisory not found.")
    return AdvisoryOut(**_advisory_store[advisory_id])
