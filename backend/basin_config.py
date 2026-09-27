import yaml
from pathlib import Path

def get_basin_config(basin_id: str) -> dict:
    """Load basin-specific configuration from YAML"""
    # Assuming run from project root
    config_path = Path("backend/basin_data") / f"{basin_id}.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration for basin '{basin_id}' not found.")
        
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)
