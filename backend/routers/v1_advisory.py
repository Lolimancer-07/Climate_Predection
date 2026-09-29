"""
backend/routers/v1_advisory.py
Phase 3 — secure advisory review and dispatch endpoints.

Design rules (Phase 3 gates):
  1. Review requires ddma_operator or admin role (server-enforced)
  2. Dispatch requires an approved review record in the store
  3. Scenario-derived drafts are rejected from the review queue
  4. Every dispatch attempt creates a DB record with actor_id, event_id, run_id
  5. Insurer viewers cannot access draft text or dispatch
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.rbac import require_permission, get_current_role, Role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/advisories", tags=["Advisory Review & Dispatch"])


# ── Request / Response schemas ────────────────────────────────────────────────

class ReviewDecisionRequest(BaseModel):
    decision: str           # approved | rejected | edited
    edited_text: Optional[str] = None
    reason: Optional[str] = None
    actor_id: str = "operator"


class DispatchRequest(BaseModel):
    channels: list[str]     # sms | whatsapp | cap_xml | pdf | insurer_webhook
    recipients: list[str]
    operator_id: str = "operator"


# ── List drafts ───────────────────────────────────────────────────────────────

@router.get("")
async def list_advisory_drafts(
    status: str | None = None,
    event_id: str | None = None,
    role: Role = Depends(require_permission("read:risk")),
):
    """List advisory drafts, optionally filtered by status or event."""
    from backend.services.pipeline_orchestrator import _draft_store, _runs

    drafts = list(_draft_store.values())
    if status:
        drafts = [d for d in drafts if d.get("status") == status]
    if event_id:
        drafts = [d for d in drafts if d.get("event_id") == event_id]

    # Enrich with is_scenario flag from the parent run
    result = []
    for d in drafts:
        run_id = d.get("run_id")
        run = _runs.get(run_id, {}) if run_id else {}
        result.append({
            **d,
            "is_scenario": run.get("is_scenario", False),
        })

    return {"drafts": result, "count": len(result), "schema_version": "1.0"}


@router.get("/{draft_id}")
async def get_advisory_draft(
    draft_id: str,
    role: Role = Depends(require_permission("read:risk")),
):
    """Get a single advisory draft with evidence JSON."""
    from backend.services.pipeline_orchestrator import get_draft, _runs, get_latest_review, list_dispatch_attempts

    draft = get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")

    run_id = draft.get("run_id")
    run = _runs.get(run_id, {}) if run_id else {}

    return {
        **draft,
        "is_scenario": run.get("is_scenario", False),
        "latest_review": get_latest_review(draft_id),
        "dispatch_attempts": list_dispatch_attempts(draft_id),
        "schema_version": "1.0",
    }


# ── Review ────────────────────────────────────────────────────────────────────

@router.post("/{draft_id}/review")
async def review_advisory(
    draft_id: str,
    body: ReviewDecisionRequest,
    role: Role = Depends(require_permission("dispatch:advisory")),  # ddma_operator or admin
    current_role: Role = Depends(get_current_role),
):
    """
    Submit a human review decision for an advisory draft.

    Phase 3 gates:
    - Requires ddma_operator or admin (server-side, not just frontend)
    - Rejects scenario-derived drafts (data_mode=SIMULATED cannot be reviewed)
    - Records actor_role, actor_id, decision, and timestamp
    """
    from backend.services.pipeline_orchestrator import get_draft, record_review, _runs

    draft = get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")

    # Gate: scenario-derived drafts cannot enter the review queue
    run_id = draft.get("run_id")
    run = _runs.get(run_id, {}) if run_id else {}
    if run.get("is_scenario"):
        raise HTTPException(
            status_code=403,
            detail=(
                "This advisory draft was generated from a scenario run (SIMULATED data). "
                "Scenario-derived advisories cannot enter the human review queue. "
                "Run a real pipeline to generate a reviewable advisory."
            ),
        )

    if body.decision not in ("approved", "rejected", "edited"):
        raise HTTPException(status_code=400, detail="decision must be approved | rejected | edited")
    if body.decision == "edited" and not body.edited_text:
        raise HTTPException(status_code=400, detail="edited_text required when decision=edited")

    # Treat 'edited' + text as approval of the edited version
    decision = body.decision
    edited = body.edited_text
    if decision == "edited":
        decision = "approved"

    review = record_review(
        draft_id=draft_id,
        actor_id=body.actor_id,
        actor_role=current_role.value,
        decision=decision,
        edited_text=edited,
        reason=body.reason,
    )

    return {
        "review_id": review["review_id"],
        "draft_id": draft_id,
        "decision": decision,
        "actor_id": body.actor_id,
        "actor_role": current_role.value,
        "reviewed_at": review["reviewed_at"],
        "draft_status": get_draft(draft_id).get("status"),
        "schema_version": "1.0",
    }


# ── Dispatch ──────────────────────────────────────────────────────────────────

@router.post("/{draft_id}/dispatch")
async def dispatch_advisory(
    draft_id: str,
    body: DispatchRequest,
    role: Role = Depends(require_permission("dispatch:advisory")),  # ddma_operator or admin
    current_role: Role = Depends(get_current_role),
):
    """
    Dispatch an approved advisory via selected channels.

    Phase 3 gates (all server-side):
    1. Draft must exist and not be from a scenario run
    2. Draft must have an approved review record
    3. Every dispatch attempt is recorded with actor_id, event_id, run_id
    4. Status 'dispatched' is only set once all channels report sent/sandbox
    """
    from backend.services.pipeline_orchestrator import (
        get_draft, get_latest_review, record_dispatch_attempt, _runs
    )
    from dispatch.sms_dispatch import send_sms
    from dispatch.cap_alert import build_cap_xml

    draft = get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")

    # Gate: scenario drafts cannot be dispatched
    run_id = draft.get("run_id")
    run = _runs.get(run_id, {}) if run_id else {}
    if run.get("is_scenario"):
        raise HTTPException(
            status_code=403,
            detail="Cannot dispatch a scenario-derived advisory. Only real pipeline advisories can be dispatched.",
        )

    # Gate: must have an approved review record
    latest_review = get_latest_review(draft_id)
    if not latest_review or latest_review.get("decision") != "approved":
        raise HTTPException(
            status_code=403,
            detail=(
                "Advisory must be approved before dispatch. "
                "Human-in-the-loop gate not cleared. "
                f"Current review status: {latest_review.get('decision') if latest_review else 'none'}. "
                "POST /v1/advisories/{id}/review with decision=approved first."
            ),
        )

    content_text = draft.get("draft_text", "")
    dispatch_results = []

    for channel in body.channels:
        for recipient in body.recipients:
            attempt_status = "sandbox"
            provider_response: dict = {}

            try:
                if channel == "sms":
                    result = await send_sms(to=recipient, body=content_text[:1600])
                    attempt_status = "sent" if result else "sandbox"
                    provider_response = {"result": str(result)}
                elif channel == "cap_xml":
                    xml_bytes = build_cap_xml(advisory_id=draft_id, content=content_text)
                    attempt_status = "sent"
                    provider_response = {"bytes": len(xml_bytes)}
                else:
                    attempt_status = "sandbox"
                    provider_response = {"note": f"Channel '{channel}' in sandbox mode"}
            except Exception as exc:
                attempt_status = "failed"
                provider_response = {"error": str(exc)}
                logger.warning("Dispatch channel %s failed: %s", channel, exc)

            attempt = record_dispatch_attempt(
                draft_id=draft_id,
                channel=channel,
                recipient_ref=recipient,
                status=attempt_status,
                actor_id=body.operator_id,
                provider_response=provider_response,
            )
            dispatch_results.append(attempt)

    return {
        "draft_id": draft_id,
        "event_id": draft.get("event_id"),
        "run_id": run_id,
        "actor_id": body.operator_id,
        "actor_role": current_role.value,
        "dispatched_at": datetime.now(timezone.utc).isoformat(),
        "channels": body.channels,
        "results": dispatch_results,
        "draft_status": get_draft(draft_id).get("status"),
        "schema_version": "1.0",
    }


# ── Audit trail ───────────────────────────────────────────────────────────────

@router.get("/{draft_id}/audit")
async def get_dispatch_audit(
    draft_id: str,
    role: Role = Depends(require_permission("read:risk")),
):
    """
    Full audit trail for a draft: reviews + dispatch attempts.
    Returns actor_id, event_id, run_id for every action.
    """
    from backend.services.pipeline_orchestrator import (
        get_draft, _review_store, list_dispatch_attempts, _runs
    )

    draft = get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft '{draft_id}' not found")

    run_id = draft.get("run_id")
    run = _runs.get(run_id, {}) if run_id else {}

    return {
        "draft_id": draft_id,
        "event_id": draft.get("event_id"),
        "run_id": run_id,
        "is_scenario": run.get("is_scenario", False),
        "grounding_passed": draft.get("grounding_passed"),
        "reviews": _review_store.get(draft_id, []),
        "dispatch_attempts": list_dispatch_attempts(draft_id),
        "schema_version": "1.0",
    }


# ── Regulatory & Insurer Compliance Audit Export ──────────────────────────────
admin_router = APIRouter(prefix="/v1/admin", tags=["Admin & Compliance Audit"])


@admin_router.get("/audit-export")
async def export_audit_log(
    event_id: str | None = None,
    role: Role = Depends(require_permission("admin:all")),
):
    """
    Consolidated compliance and audit export endpoint (admin role only).
    Exports all pipeline runs, advisory drafts, human reviews, dispatch attempts,
    and deterministic trigger records in one canonical structure.
    """
    from backend.services.pipeline_orchestrator import (
        _runs, _draft_store, _review_store, _dispatch_store, _scenario_store
    )

    runs = list(_runs.values())
    drafts = list(_draft_store.values())
    scenarios = list(_scenario_store.values())

    if event_id:
        runs = [r for r in runs if r.get("event_id") == event_id]
        drafts = [d for d in drafts if d.get("event_id") == event_id]
        scenarios = [s for s in scenarios if s.get("event_id") == event_id]

    draft_ids = {d["draft_id"] for d in drafts}
    reviews = [r for did, rlist in _review_store.items() if did in draft_ids for r in rlist]
    dispatches = [a for did, alist in _dispatch_store.items() if did in draft_ids for a in alist]

    return {
        "event_id": event_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "total_runs": len(runs),
        "total_drafts": len(drafts),
        "total_reviews": len(reviews),
        "total_dispatches": len(dispatches),
        "total_scenarios": len(scenarios),
        "pipeline_runs": runs,
        "advisory_drafts": drafts,
        "advisory_reviews": reviews,
        "dispatch_attempts": dispatches,
        "scenarios": scenarios,
        "schema_version": "1.0",
    }
