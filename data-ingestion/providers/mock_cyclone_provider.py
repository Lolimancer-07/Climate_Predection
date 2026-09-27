import json
from pathlib import Path
from typing import List
from .base import CycloneDataProvider, StormSummary, TrackFix

class MockCycloneProvider(CycloneDataProvider):
    def __init__(self, data_dir: str = "data-ingestion/mock_data"):
        self.data_dir = Path(data_dir)

    def list_active_storms(self) -> List[StormSummary]:
        active_storms = []
        for file in self.data_dir.glob("active_storm_*.json"):
            with open(file, 'r') as f:
                data = json.load(f)
                if data.get("status") == "active_forecast":
                    active_storms.append(StormSummary(
                        storm_id=data["storm_id"],
                        basin=data["basin"],
                        status=data["status"],
                        name=data["name"],
                        genesis_time=data["genesis_time"]
                    ))
        return active_storms

    def get_track(self, storm_id: str) -> List[TrackFix]:
        # Simple file lookup based on standard mock naming convention
        filename = f"active_storm_{storm_id.replace('-', '_')}.json"
        filepath = self.data_dir / filename
        
        if not filepath.exists():
            return []
            
        with open(filepath, 'r') as f:
            data = json.load(f)
            
        fixes = []
        for fix_data in data.get("observed_fixes", []):
            fixes.append(TrackFix(**fix_data))
            
        return fixes
