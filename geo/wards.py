"""
geo/wards.py

Urban Local Body & Municipal Ward Registry.
Provides micro-scale vulnerability and evacuation shelter assignment.
"""

from typing import Dict, Any, List

WARDS_REGISTRY: Dict[str, List[Dict[str, Any]]] = {
    "IN-OD-PURI": [
        {"ward_id": "WARD-01", "name": "Baliapanda Coastal Ward", "population": 9800, "elevation_m": 2.2, "shelter_id": "CS-01", "hospital_nearby": "HOSP-01"},
        {"ward_id": "WARD-02", "name": "Chakratirtha Beach Ward", "population": 11200, "elevation_m": 2.5, "shelter_id": "CS-02", "hospital_nearby": "HOSP-01"},
        {"ward_id": "WARD-07", "name": "Sipasarubali Inundation Zone", "population": 12400, "elevation_m": 1.4, "shelter_id": "CS-04", "hospital_nearby": "HOSP-02"},
        {"ward_id": "WARD-12", "name": "Grand Road Central", "population": 18500, "elevation_m": 6.8, "shelter_id": "CS-07", "hospital_nearby": "HOSP-03"},
        {"ward_id": "WARD-15", "name": "Mangalaghat Inland Ward", "population": 14200, "elevation_m": 5.9, "shelter_id": "CS-09", "hospital_nearby": "HOSP-03"},
    ]
}


def get_wards_for_district(district_id: str) -> List[Dict[str, Any]]:
    return WARDS_REGISTRY.get(district_id.upper(), [
        {"ward_id": f"{district_id}-W01", "name": f"{district_id} Ward 1", "population": 10000, "elevation_m": 4.5, "shelter_id": "CS-01", "hospital_nearby": "HOSP-01"},
        {"ward_id": f"{district_id}-W02", "name": f"{district_id} Ward 2", "population": 12000, "elevation_m": 5.2, "shelter_id": "CS-02", "hospital_nearby": "HOSP-01"},
    ])
