"""
modeling/hazards/base.py

Pluggable Multi-Hazard Framework — Core Abstractions & Interfaces.
Standardizes ingestion, forecasting, and impact assessment across all 8 peril types:
  1. Cyclone (Storm surge & gale winds)
  2. Riverine Flood (CWC gauge monitoring & stage discharge)
  3. Earthquake (Post-event shake-intensity & structural damage assessment — explicitly non-predictive)
  4. Landslide (Rainfall intensity-duration threshold)
  5. Heatwave (Temperature departure & consecutive-day duration)
  6. Drought (Standardized Precipitation Index & soil moisture)
  7. Wildfire (Active thermal anomaly & wind spread rate)
  8. Tsunami (Chained seismic sea-surface displacement & wave run-up)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, List, Optional


class HazardType(str, Enum):
    CYCLONE = "cyclone"
    FLOOD = "flood"
    EARTHQUAKE = "earthquake"
    LANDSLIDE = "landslide"
    HEATWAVE = "heatwave"
    DROUGHT = "drought"
    WILDFIRE = "wildfire"
    TSUNAMI = "tsunami"


class SeverityTier(str, Enum):
    WATCH = "Watch"
    WARNING = "Warning"
    SEVERE = "Severe"
    EMERGENCY = "Emergency"


@dataclass
class HazardEvent:
    event_id: str
    hazard_type: HazardType
    name: str
    status: str                         # active | forecast | post_event | resolved
    severity: SeverityTier
    coordinates: Dict[str, float]       # {"lat": float, "lon": float}
    affected_states: List[str]
    detected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    origin_event_id: Optional[str] = None  # e.g., originating earthquake for a tsunami
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HazardForecast:
    event_id: str
    hazard_type: HazardType
    lead_hours: int
    peak_intensity: float
    intensity_unit: str                 # m (surge), km/h (wind), mm (rain), %g (PGA), °C (heat), etc.
    confidence: str                     # observed | extrapolated | calibrated
    spatial_extent_geojson: Dict[str, Any]
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DistrictImpact:
    district_id: str
    event_id: str
    hazard_type: HazardType
    severity_tier: SeverityTier
    exposed_population: int
    critical_assets_at_risk: int
    estimated_damage_inr_cr: float
    recommended_action: str
    parametric_trigger_met: bool
    details: Dict[str, Any] = field(default_factory=dict)


class HazardModule(ABC):
    """
    Abstract base interface for all hazard peril plugins.
    Ensures identical contract for downstream exposure scoring, Gemini reasoning,
    and multi-channel notification dispatch.
    """
    hazard_type: HazardType

    @abstractmethod
    def detect_active_events(self) -> List[HazardEvent]:
        """Detects current active or newly reported events from real or mock feeds."""
        pass

    @abstractmethod
    def forecast(self, event: HazardEvent) -> HazardForecast:
        """Computes forward-looking physical trajectory and hazard intensity footprint."""
        pass

    @abstractmethod
    def compute_district_impact(self, forecast: HazardForecast, district_id: str) -> DistrictImpact:
        """Assesses localized exposure, structural risk, and parametric trigger status."""
        pass
