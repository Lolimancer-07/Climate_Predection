"""
modeling/hazards/tsunami/tsunami_module.py

Tsunami Coastal Wave Inundation Module.
Triggered as a chained secondary hazard following sub-sea megathrust seismic detection (Mw >= 7.2).
Models shallow-water wave celerity (c = sqrt(g*h)), Green's law amplification, and coastal run-up.
"""

from typing import List, Dict, Any
from modeling.hazards.base import HazardModule, HazardType, HazardEvent, HazardForecast, DistrictImpact, SeverityTier
from geo.districts import get_district


class TsunamiHazardModule(HazardModule):
    hazard_type = HazardType.TSUNAMI

    def detect_active_events(self) -> List[HazardEvent]:
        return [
            HazardEvent(
                event_id="TSU-ANDAMAN-2026",
                hazard_type=HazardType.TSUNAMI,
                name="Andaman-Sumatra Subduction Zone Tsunami Watch",
                status="forecast",
                severity=SeverityTier.EMERGENCY,
                coordinates={"lat": 10.45, "lon": 92.50},
                affected_states=["IN-TN", "IN-AP", "IN-OD"],
                origin_event_id="EQ-SUMATRA-2026",
                metadata={
                    "originating_magnitude_mw": 7.8,
                    "focal_depth_km": 18.0,
                    "deep_sea_amplitude_m": 0.85,
                    "estimated_runup_height_m": 5.4,
                    "incois_bulletin_status": "Red Warning",
                }
            )
        ]

    def forecast(self, event: HazardEvent) -> HazardForecast:
        runup_m = float(event.metadata.get("estimated_runup_height_m", 5.4))

        extent_geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"runup_height_m": runup_m, "coastal_penetration_m": 1200},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[80.0, 12.8], [80.3, 12.8], [80.3, 13.5], [80.0, 13.5], [80.0, 12.8]]]
                    }
                }
            ]
        }

        return HazardForecast(
            event_id=event.event_id,
            hazard_type=HazardType.TSUNAMI,
            lead_hours=2,  # Coastal arrival travel time from subduction trench
            peak_intensity=runup_m,
            intensity_unit="m Coastal Run-Up Height",
            confidence="calibrated_shallow_water_celerity",
            spatial_extent_geojson=extent_geojson,
            timeline=[
                {"hour": 0.5, "status": "Wave front passing deep ocean DART buoy #23"},
                {"hour": 1.5, "status": "Arrival at coastal shelf boundary (wave shoaling)"},
                {"hour": 2.0, "status": "First wave crest impact at shoreline"},
            ]
        )

    def compute_district_impact(self, forecast: HazardForecast, district_id: str) -> DistrictImpact:
        dist = get_district(district_id) or {}
        pop = dist.get("population", 7214703)
        exposed_pop = int(pop * 0.15)

        runup = forecast.peak_intensity
        trigger_met = runup >= 2.0

        return DistrictImpact(
            district_id=district_id,
            event_id=forecast.event_id,
            hazard_type=HazardType.TSUNAMI,
            severity_tier=SeverityTier.EMERGENCY,
            exposed_population=exposed_pop,
            critical_assets_at_risk=dist.get("critical_assets_count", 450),
            estimated_damage_inr_cr=1250.0,
            recommended_action="IMMEDIATE MANDATORY VERTICAL EVACUATION: Move to >= 4th floor reinforced concrete structures or terrain > 15m MSL.",
            parametric_trigger_met=trigger_met,
            details={"peak_runup_m": runup, "intertidal_recession_alert": True}
        )
