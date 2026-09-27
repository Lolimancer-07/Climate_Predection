"""
data-ingestion/weather/schemas.py
Pydantic models for all weather and meteorological payloads.
"""
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


Basin = Literal["BoB", "AS", "NIO", "WPac", "EPac", "ATL"]

IMD_CATEGORY_LABELS = {
    "D":    "Depression",
    "DD":   "Deep Depression",
    "CS":   "Cyclonic Storm",
    "SCS":  "Severe Cyclonic Storm",
    "VSCS": "Very Severe Cyclonic Storm",
    "ESCS": "Extremely Severe Cyclonic Storm",
    "SuCS": "Super Cyclonic Storm",
}


class TrackPointSchema(BaseModel):
    timestamp: datetime
    lat: float                      = Field(..., ge=-90, le=90)
    lon: float                      = Field(..., ge=-180, le=180)
    wind_speed_kt: float            = Field(..., ge=0, description="Max sustained 1-min wind in knots")
    central_pressure_hpa: float     = Field(..., ge=800, le=1020)
    radius_max_wind_nm: float       = Field(..., ge=0, description="Radius of maximum winds, nautical miles")
    forward_speed_kt: float         = Field(default=10.0, ge=0)
    category: str                   = Field(default="CS")

    @property
    def wind_speed_kmh(self) -> float:
        return round(self.wind_speed_kt * 1.852, 1)

    @property
    def category_label(self) -> str:
        return IMD_CATEGORY_LABELS.get(self.category, self.category)


class CycloneTrackSchema(BaseModel):
    event_id: str
    name: str
    source: str                     = Field(..., description="IMD | JTWC | GDACS | BMD | DMH")
    basin: Basin                    = "BoB"
    track_points: list[TrackPointSchema]
    landfall_point: Optional[TrackPointSchema] = None
    landfall_district: Optional[str]           = None

    @property
    def current_intensity(self) -> TrackPointSchema:
        """Return the most recent track point."""
        return self.track_points[-1]

    @property
    def hours_to_landfall(self) -> Optional[float]:
        """Hours from last track point to landfall, or None."""
        if self.landfall_point is None:
            return None
        delta = self.landfall_point.timestamp - self.current_intensity.timestamp
        return round(delta.total_seconds() / 3600, 1)


class GridCellSchema(BaseModel):
    lat: float
    lon: float
    rainfall_mm_24h: float
    rainfall_mm_48h: float
    rainfall_mm_72h: float
    wind_speed_10m_kmh: float


class RainfallForecastSchema(BaseModel):
    district_id: str
    fetched_at: datetime
    grid_cells: list[GridCellSchema]
    max_rainfall_mm_24h: float
    max_rainfall_mm_48h: float
    max_rainfall_mm_72h: float
    max_wind_speed_kmh: float


class GDACSEventSchema(BaseModel):
    event_id: str
    name: str
    severity: str
    lat: float
    lon: float
    link: str
