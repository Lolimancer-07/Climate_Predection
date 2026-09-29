"""
geo/states.py

All-India States and Union Territories Registry (28 States + 8 UTs).
Provides geospatial bounding metadata, disaster vulnerability profiles, and administrative centroids.
"""

from typing import Dict, Any, List, Optional

STATES_REGISTRY: Dict[str, Dict[str, Any]] = {
    # Coastal States (Cyclone, Tsunami, Coastal Flood)
    "IN-OD": {
        "state_id": "IN-OD",
        "name": "Odisha",
        "type": "State",
        "capital": "Bhubaneswar",
        "is_coastal": True,
        "coastal_length_km": 480.0,
        "center": {"lat": 20.9517, "lon": 85.0985},
        "bbox": [81.38, 17.78, 87.52, 22.57],
        "primary_hazards": ["cyclone", "flood", "heatwave", "tsunami"],
        "sdma_contact": "seoc.odisha@gov.in",
        "population": 41974218,
    },
    "IN-WB": {
        "state_id": "IN-WB",
        "name": "West Bengal",
        "type": "State",
        "capital": "Kolkata",
        "is_coastal": True,
        "coastal_length_km": 157.0,
        "center": {"lat": 22.9868, "lon": 87.8550},
        "bbox": [85.82, 21.52, 89.88, 27.22],
        "primary_hazards": ["cyclone", "flood", "landslide", "tsunami"],
        "sdma_contact": "disaster.wb@nic.in",
        "population": 91276115,
    },
    "IN-AP": {
        "state_id": "IN-AP",
        "name": "Andhra Pradesh",
        "type": "State",
        "capital": "Amaravati",
        "is_coastal": True,
        "coastal_length_km": 974.0,
        "center": {"lat": 15.9129, "lon": 79.7400},
        "bbox": [76.76, 12.62, 84.75, 19.15],
        "primary_hazards": ["cyclone", "heatwave", "flood", "drought"],
        "sdma_contact": "apsdma@ap.gov.in",
        "population": 49577103,
    },
    "IN-TN": {
        "state_id": "IN-TN",
        "name": "Tamil Nadu",
        "type": "State",
        "capital": "Chennai",
        "is_coastal": True,
        "coastal_length_km": 1076.0,
        "center": {"lat": 11.1271, "lon": 78.6569},
        "bbox": [76.23, 8.08, 80.35, 13.57],
        "primary_hazards": ["cyclone", "flood", "tsunami", "drought"],
        "sdma_contact": "tnsdma@tn.gov.in",
        "population": 72147030,
    },
    "IN-GJ": {
        "state_id": "IN-GJ",
        "name": "Gujarat",
        "type": "State",
        "capital": "Gandhinagar",
        "is_coastal": True,
        "coastal_length_km": 1600.0,
        "center": {"lat": 22.2587, "lon": 71.1924},
        "bbox": [68.12, 20.10, 74.48, 24.70],
        "primary_hazards": ["cyclone", "earthquake", "flood", "heatwave"],
        "sdma_contact": "gsdma@gujarat.gov.in",
        "population": 60439692,
    },
    "IN-MH": {
        "state_id": "IN-MH",
        "name": "Maharashtra",
        "type": "State",
        "capital": "Mumbai",
        "is_coastal": True,
        "coastal_length_km": 720.0,
        "center": {"lat": 19.7515, "lon": 75.7139},
        "bbox": [72.63, 15.60, 80.89, 22.02],
        "primary_hazards": ["cyclone", "flood", "drought", "landslide"],
        "sdma_contact": "director.dm@maharashtra.gov.in",
        "population": 112374333,
    },
    "IN-KL": {
        "state_id": "IN-KL",
        "name": "Kerala",
        "type": "State",
        "capital": "Thiruvananthapuram",
        "is_coastal": True,
        "coastal_length_km": 580.0,
        "center": {"lat": 10.8505, "lon": 76.2711},
        "bbox": [74.86, 8.29, 77.42, 12.79],
        "primary_hazards": ["flood", "landslide", "cyclone", "coastal_erosion"],
        "sdma_contact": "keralasdma@gmail.com",
        "population": 33406061,
    },
    # Riverine Flood & Earthquake Prone Northern/Eastern States
    "IN-AS": {
        "state_id": "IN-AS",
        "name": "Assam",
        "type": "State",
        "capital": "Dispur",
        "is_coastal": False,
        "coastal_length_km": 0.0,
        "center": {"lat": 26.2006, "lon": 92.9376},
        "bbox": [89.70, 24.13, 96.02, 28.00],
        "primary_hazards": ["flood", "earthquake", "landslide"],
        "sdma_contact": "sdma-assam@gov.in",
        "population": 31205576,
    },
    "IN-BR": {
        "state_id": "IN-BR",
        "name": "Bihar",
        "type": "State",
        "capital": "Patna",
        "is_coastal": False,
        "coastal_length_km": 0.0,
        "center": {"lat": 25.0961, "lon": 85.3131},
        "bbox": [83.33, 24.28, 88.30, 27.52],
        "primary_hazards": ["flood", "heatwave", "earthquake"],
        "sdma_contact": "bsdma.bihar@gov.in",
        "population": 104099452,
    },
    "IN-UT": {
        "state_id": "IN-UT",
        "name": "Uttarakhand",
        "type": "State",
        "capital": "Dehradun",
        "is_coastal": False,
        "coastal_length_km": 0.0,
        "center": {"lat": 30.0668, "lon": 79.0193},
        "bbox": [77.57, 28.71, 81.04, 31.46],
        "primary_hazards": ["landslide", "flood", "earthquake", "wildfire"],
        "sdma_contact": "usdma.uk@gov.in",
        "population": 10086292,
    },
    "IN-HP": {
        "state_id": "IN-HP",
        "name": "Himachal Pradesh",
        "type": "State",
        "capital": "Shimla",
        "is_coastal": False,
        "coastal_length_km": 0.0,
        "center": {"lat": 31.1048, "lon": 77.1734},
        "bbox": [75.59, 30.38, 79.00, 33.22],
        "primary_hazards": ["landslide", "flood", "earthquake", "wildfire"],
        "sdma_contact": "hpsdma@hp.gov.in",
        "population": 6864602,
    },
    "IN-DL": {
        "state_id": "IN-DL",
        "name": "Delhi",
        "type": "UT",
        "capital": "New Delhi",
        "is_coastal": False,
        "coastal_length_km": 0.0,
        "center": {"lat": 28.7041, "lon": 77.1025},
        "bbox": [76.84, 28.40, 77.35, 28.88],
        "primary_hazards": ["heatwave", "earthquake", "flood"],
        "sdma_contact": "ddma.delhi@nic.in",
        "population": 16787941,
    }
}


def list_states(coastal_only: bool = False) -> List[Dict[str, Any]]:
    """Returns list of all registered states, optionally filtered by coastal."""
    states = list(STATES_REGISTRY.values())
    if coastal_only:
        return [s for s in states if s["is_coastal"]]
    return states


def get_state(state_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves state metadata by ISO code."""
    return STATES_REGISTRY.get(state_id.upper())
