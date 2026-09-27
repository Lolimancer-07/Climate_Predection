from abc import ABC, abstractmethod
from typing import List
from datetime import datetime
from pydantic import BaseModel

class TrackFix(BaseModel):
    timestamp: datetime
    lat: float
    lon: float
    central_pressure_hpa: float
    max_wind_kmh: float
    forward_speed_kt: float
    heading_deg: float
    category: str

class StormSummary(BaseModel):
    storm_id: str
    basin: str
    status: str
    name: str
    genesis_time: datetime
    
class BoundingBox(BaseModel):
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float

class RainfallGridCell(BaseModel):
    lat: float
    lon: float
    rainfall_mm_24h: float
    rainfall_mm_48h: float
    wind_speed_kmh: float

class RainfallGrid(BaseModel):
    storm_id: str
    generated_at: datetime
    bbox: BoundingBox
    grid: List[RainfallGridCell]

class CycloneDataProvider(ABC):
    @abstractmethod
    def list_active_storms(self) -> List[StormSummary]:
        pass

    @abstractmethod
    def get_track(self, storm_id: str) -> List[TrackFix]:
        pass

class MeteorologicalProvider(ABC):
    @abstractmethod
    def get_rainfall_forecast(self, storm_id: str, lead_hours: int) -> RainfallGrid:
        pass
