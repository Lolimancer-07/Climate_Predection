import json
from pathlib import Path
from .base import MeteorologicalProvider, RainfallGrid

class MockMeteoProvider(MeteorologicalProvider):
    def __init__(self, data_dir: str = "data-ingestion/mock_data"):
        self.data_dir = Path(data_dir)

    def get_rainfall_forecast(self, storm_id: str, lead_hours: int) -> RainfallGrid:
        filename = f"rainfall_grid_{storm_id.replace('-', '_')}.json"
        filepath = self.data_dir / filename
        
        if not filepath.exists():
            raise FileNotFoundError(f"Mock data not found for {storm_id}")
            
        with open(filepath, 'r') as f:
            data = json.load(f)
            
        return RainfallGrid(**data)
