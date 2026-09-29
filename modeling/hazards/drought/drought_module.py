"""
modeling/hazards/drought/drought_module.py

Agricultural & Meteorological Drought Risk Module.
Tracks Standardized Precipitation Index (SPI-3 / SPI-6) and satellite-derived
root-zone soil moisture deficit for early anticipatory agricultural liquidity.
"""

from typing import List, Dict, Any
from modeling.hazards.base import HazardModule, HazardType, HazardEvent, HazardForecast, DistrictImpact, SeverityTier
from geo.districts import get_district


class DroughtHazardModule(HazardModule):
    hazard_type = HazardType.DROUGHT

    def detect_active_events(self) -> List[HazardEvent]:
        return [
            HazardEvent(
                event_id="DROUGHT-MARATH-2026",
                hazard_type=HazardType.DROUGHT,
                name="Marathwada-Vidarbha Monsoon Soil Moisture Deficit",
                status="forecast",
                severity=SeverityTier.WARNING,
                coordinates={"lat": 19.85, "lon": 75.80},
                affected_states=["IN-MH", "IN-AP"],
                metadata={
                    "spi_3_month": -1.85,
                    "soil_moisture_percentile": 12.0,
                    "reservoir_live_storage_pct": 24.5,
                }
            )
        ]

    def forecast(self, event: HazardEvent) -> HazardForecast:
        spi = float(event.metadata.get("spi_3_month", -1.85))

        extent_geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"spi_3m": spi, "stress_category": "Severe Agricultural Drought"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[74.5, 18.5], [77.2, 18.5], [77.2, 21.0], [74.5, 21.0], [74.5, 18.5]]]
                    }
                }
            ]
        }

        return HazardForecast(
            event_id=event.event_id,
            hazard_type=HazardType.DROUGHT,
            lead_hours=336,  # 14 days forward trend
            peak_intensity=abs(spi),
            intensity_unit="SPI (Negative Deficit Index)",
            confidence="satellite_soil_moisture_trend",
            spatial_extent_geojson=extent_geojson,
            timeline=[
                {"week": 1, "spi": -1.65},
                {"week": 2, "spi": -1.85},
                {"week": 3, "spi": -2.10},
            ]
        )

    def compute_district_impact(self, forecast: HazardForecast, district_id: str) -> DistrictImpact:
        dist = get_district(district_id) or {}
        pop = dist.get("population", 2500000)
        exposed_pop = int(pop * 0.35)

        spi_deficit = forecast.peak_intensity
        trigger_met = spi_deficit >= 1.75  # Parametric crop drought trigger

        return DistrictImpact(
            district_id=district_id,
            event_id=forecast.event_id,
            hazard_type=HazardType.DROUGHT,
            severity_tier=SeverityTier.SEVERE if spi_deficit >= 2.0 else SeverityTier.WARNING,
            exposed_population=exposed_pop,
            critical_assets_at_risk=85,
            estimated_damage_inr_cr=340.0,
            recommended_action="Release early parametric agri-credit liquidity, preposition fodder banks, and ration non-drinking reservoir release.",
            parametric_trigger_met=trigger_met,
            details={"spi_deficit": spi_deficit, "sown_area_stress_pct": 68.0}
        )
