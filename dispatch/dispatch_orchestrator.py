"""
dispatch/dispatch_orchestrator.py
Human-in-the-loop dispatch orchestration with escalation logic.

INVARIANT: No advisory or insurance trigger notification leaves the system
without an explicit human confirmation. This is a hard architectural constraint.
"""
from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional


class SeverityTier(str, Enum):
    WATCH           = "Watch"
    WARNING         = "Warning"
    EVACUATION_ORDER = "Evacuation Order"


def determine_severity_tier(
    surge_height_m: float,
    rainfall_mm_48h: float,
    wind_speed_kmh: float,
    hours_to_landfall: float,
) -> SeverityTier:
    """
    Determine severity tier based on hazard values and time-to-landfall.
    Escalates automatically as landfall approaches.
    """
    # Base severity from surge height
    if surge_height_m >= 2.5 or wind_speed_kmh >= 200:
        base = SeverityTier.EVACUATION_ORDER
    elif surge_height_m >= 1.0 or wind_speed_kmh >= 120:
        base = SeverityTier.WARNING
    else:
        base = SeverityTier.WATCH

    # Escalate if very close to landfall
    if hours_to_landfall <= 12 and base == SeverityTier.WARNING:
        return SeverityTier.EVACUATION_ORDER
    if hours_to_landfall <= 24 and base == SeverityTier.WATCH:
        return SeverityTier.WARNING

    return base


@dataclass
class DispatchDecision:
    advisory_id: str
    severity_tier: SeverityTier
    channels: list[str]
    approved_by: str
    approved_at: datetime
    dispatched: bool = False
    dispatch_results: list[dict] | None = None


def require_human_approval(
    advisory_id: str,
    severity_tier: SeverityTier,
    operator_id: Optional[str],
) -> bool:
    """
    Gate: returns True only if a human operator has confirmed dispatch.
    In demo mode, requires operator_id to be non-None.
    In production, this would check an RBAC-protected confirmation table.
    """
    if not operator_id:
        raise PermissionError(
            "HITL Gate: Advisory dispatch requires explicit human operator confirmation. "
            f"Advisory {advisory_id} (tier={severity_tier.value}) cannot be dispatched autonomously."
        )
    return True
