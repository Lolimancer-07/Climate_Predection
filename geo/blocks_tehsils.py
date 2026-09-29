"""
geo/blocks_tehsils.py

Sub-district Administrative Units (Blocks / Tehsils / Mandals).
Enables ward and block-level granular spatial exposure modeling.
"""

from typing import Dict, Any, List

BLOCKS_REGISTRY: Dict[str, List[Dict[str, Any]]] = {
    "IN-OD-PURI": [
        {"block_id": "PURI-BLK-01", "name": "Puri Sadar", "population": 215000, "coastal": True, "elevation_m": 3.8},
        {"block_id": "PURI-BLK-02", "name": "Brahmagiri", "population": 182000, "coastal": True, "elevation_m": 2.6},
        {"block_id": "PURI-BLK-03", "name": "Krushnaprasad", "population": 98000, "coastal": True, "elevation_m": 2.1},
        {"block_id": "PURI-BLK-04", "name": "Satyabadi", "population": 165000, "coastal": False, "elevation_m": 6.5},
        {"block_id": "PURI-BLK-05", "name": "Pipili", "population": 195000, "coastal": False, "elevation_m": 8.2},
        {"block_id": "PURI-BLK-06", "name": "Gop", "population": 178000, "coastal": True, "elevation_m": 4.1},
        {"block_id": "PURI-BLK-07", "name": "Kakatpur", "population": 134000, "coastal": True, "elevation_m": 3.4},
        {"block_id": "PURI-BLK-08", "name": "Astaranga", "population": 112000, "coastal": True, "elevation_m": 2.9},
    ],
    "IN-OD-JAG": [
        {"block_id": "JAG-BLK-01", "name": "Erasama", "population": 145000, "coastal": True, "elevation_m": 2.4},
        {"block_id": "JAG-BLK-02", "name": "Kujang (Paradip)", "population": 195000, "coastal": True, "elevation_m": 3.0},
        {"block_id": "JAG-BLK-03", "name": "Balikuda", "population": 162000, "coastal": True, "elevation_m": 3.5},
    ],
    "IN-WB-24S": [
        {"block_id": "24S-BLK-01", "name": "Gosaba (Sundarbans)", "population": 246000, "coastal": True, "elevation_m": 1.9},
        {"block_id": "24S-BLK-02", "name": "Basanti", "population": 336000, "coastal": True, "elevation_m": 2.2},
        {"block_id": "24S-BLK-03", "name": "Kakdwip", "population": 281000, "coastal": True, "elevation_m": 2.8},
    ]
}


def get_blocks_for_district(district_id: str) -> List[Dict[str, Any]]:
    return BLOCKS_REGISTRY.get(district_id.upper(), [
        {"block_id": f"{district_id}-BLK-01", "name": f"{district_id} Central Block", "population": 150000, "coastal": True, "elevation_m": 5.0}
    ])
