from typing import List
from .base import CycloneDataProvider, StormSummary, TrackFix

class GDACSProvider(CycloneDataProvider):
    def list_active_storms(self) -> List[StormSummary]:
        raise NotImplementedError("GDACS provider not yet implemented")

    def get_track(self, storm_id: str) -> List[TrackFix]:
        raise NotImplementedError("GDACS provider not yet implemented")
