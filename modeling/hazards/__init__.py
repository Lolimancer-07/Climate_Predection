"""
modeling/hazards package
Pluggable multi-hazard framework covering 8 perils across India.
"""

from modeling.hazards.base import (
    HazardType,
    SeverityTier,
    HazardEvent,
    HazardForecast,
    DistrictImpact,
    HazardModule,
)
from modeling.hazards.registry import (
    HAZARD_REGISTRY,
    get_hazard_module,
    list_supported_hazards,
    list_active_national_events,
    compute_national_summary,
)

__all__ = [
    "HazardType",
    "SeverityTier",
    "HazardEvent",
    "HazardForecast",
    "DistrictImpact",
    "HazardModule",
    "HAZARD_REGISTRY",
    "get_hazard_module",
    "list_supported_hazards",
    "list_active_national_events",
    "compute_national_summary",
]
