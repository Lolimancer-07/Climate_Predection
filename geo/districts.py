"""
geo/districts.py

All-India District Registry across vulnerable hazard zones.
Provides spatial coordinates, population, terrain slope, river basin, and exposure tags.
"""

from typing import Dict, Any, List, Optional

DISTRICTS_REGISTRY: Dict[str, Dict[str, Any]] = {
    # ── Odisha (Bay of Bengal Coast & Mahanadi Basin) ──────────────────
    "IN-OD-PURI": {
        "district_id": "IN-OD-PURI",
        "name": "Puri",
        "state_id": "IN-OD",
        "state_name": "Odisha",
        "center": {"lat": 19.8135, "lon": 85.8312},
        "population": 1698737,
        "coastal_length_km": 150.0,
        "elevation_m": 4.5,
        "hazard_tags": ["cyclone", "storm_surge", "flood", "tsunami"],
        "critical_assets_count": 342,
        "cyclone_shelters_count": 68,
        "substations_count": 14,
        "hospitals_count": 9,
    },
    "IN-OD-JAG": {
        "district_id": "IN-OD-JAG",
        "name": "Jagatsinghpur",
        "state_id": "IN-OD",
        "state_name": "Odisha",
        "center": {"lat": 20.2543, "lon": 86.1706},
        "population": 1136971,
        "coastal_length_km": 67.0,
        "elevation_m": 3.8,
        "hazard_tags": ["cyclone", "storm_surge", "industrial_hazard", "flood"],
        "critical_assets_count": 280,
        "cyclone_shelters_count": 54,
        "substations_count": 12,
        "hospitals_count": 7,
    },
    "IN-OD-KEN": {
        "district_id": "IN-OD-KEN",
        "name": "Kendrapara",
        "state_id": "IN-OD",
        "state_name": "Odisha",
        "center": {"lat": 20.4998, "lon": 86.4216},
        "population": 1440218,
        "coastal_length_km": 48.0,
        "elevation_m": 3.2,
        "hazard_tags": ["cyclone", "storm_surge", "riverine_flood"],
        "critical_assets_count": 210,
        "cyclone_shelters_count": 46,
        "substations_count": 8,
        "hospitals_count": 5,
    },
    "IN-OD-GAN": {
        "district_id": "IN-OD-GAN",
        "name": "Ganjam",
        "state_id": "IN-OD",
        "state_name": "Odisha",
        "center": {"lat": 19.3820, "lon": 85.0560},
        "population": 3529031,
        "coastal_length_km": 60.0,
        "elevation_m": 6.1,
        "hazard_tags": ["cyclone", "storm_surge", "flash_flood"],
        "critical_assets_count": 420,
        "cyclone_shelters_count": 82,
        "substations_count": 22,
        "hospitals_count": 16,
    },
    "IN-OD-BHA": {
        "district_id": "IN-OD-BHA",
        "name": "Bhadrak",
        "state_id": "IN-OD",
        "state_name": "Odisha",
        "center": {"lat": 21.0574, "lon": 86.4957},
        "population": 1506522,
        "coastal_length_km": 52.0,
        "elevation_m": 4.1,
        "hazard_tags": ["cyclone", "storm_surge", "riverine_flood"],
        "critical_assets_count": 195,
        "cyclone_shelters_count": 39,
        "substations_count": 9,
        "hospitals_count": 6,
    },

    # ── West Bengal (Sundarbans & Gangetic Delta) ──────────────────────
    "IN-WB-24S": {
        "district_id": "IN-WB-24S",
        "name": "South 24 Parganas",
        "state_id": "IN-WB",
        "state_name": "West Bengal",
        "center": {"lat": 22.1487, "lon": 88.5492},
        "population": 8161961,
        "coastal_length_km": 110.0,
        "elevation_m": 2.8,
        "hazard_tags": ["cyclone", "storm_surge", "mangrove_erosion", "flood"],
        "critical_assets_count": 510,
        "cyclone_shelters_count": 112,
        "substations_count": 28,
        "hospitals_count": 22,
    },
    "IN-WB-MED": {
        "district_id": "IN-WB-MED",
        "name": "Purba Medinipur (Digha Coast)",
        "state_id": "IN-WB",
        "state_name": "West Bengal",
        "center": {"lat": 21.6266, "lon": 87.5074},
        "population": 5095875,
        "coastal_length_km": 65.0,
        "elevation_m": 3.4,
        "hazard_tags": ["cyclone", "storm_surge", "coastal_erosion"],
        "critical_assets_count": 390,
        "cyclone_shelters_count": 74,
        "substations_count": 19,
        "hospitals_count": 14,
    },

    # ── Andhra Pradesh (Godavari / Krishna Delta) ─────────────────────
    "IN-AP-VIS": {
        "district_id": "IN-AP-VIS",
        "name": "Visakhapatnam",
        "state_id": "IN-AP",
        "state_name": "Andhra Pradesh",
        "center": {"lat": 17.6868, "lon": 83.2185},
        "population": 4290589,
        "coastal_length_km": 132.0,
        "elevation_m": 12.0,
        "hazard_tags": ["cyclone", "urban_flood", "industrial_hazard", "heatwave"],
        "critical_assets_count": 680,
        "cyclone_shelters_count": 95,
        "substations_count": 42,
        "hospitals_count": 35,
    },

    # ── Gujarat (Saurashtra Coast & Seismic Zone V) ────────────────────
    "IN-GJ-KUT": {
        "district_id": "IN-GJ-KUT",
        "name": "Kutch",
        "state_id": "IN-GJ",
        "state_name": "Gujarat",
        "center": {"lat": 23.7337, "lon": 69.8597},
        "population": 2092371,
        "coastal_length_km": 352.0,
        "elevation_m": 15.0,
        "hazard_tags": ["earthquake", "cyclone", "tsunami", "drought"],
        "critical_assets_count": 320,
        "cyclone_shelters_count": 45,
        "substations_count": 26,
        "hospitals_count": 18,
    },

    # ── Assam (Brahmaputra Riverine Flood Basin) ──────────────────────
    "IN-AS-KAM": {
        "district_id": "IN-AS-KAM",
        "name": "Kamrup Metropolitan (Guwahati)",
        "state_id": "IN-AS",
        "state_name": "Assam",
        "center": {"lat": 26.1445, "lon": 91.7362},
        "population": 1253938,
        "coastal_length_km": 0.0,
        "elevation_m": 55.0,
        "hazard_tags": ["riverine_flood", "landslide", "earthquake"],
        "critical_assets_count": 410,
        "cyclone_shelters_count": 0,
        "substations_count": 31,
        "hospitals_count": 28,
    },

    # ── Uttarakhand (Himalayan Landslide & Flash Flood) ───────────────
    "IN-UT-CHA": {
        "district_id": "IN-UT-CHA",
        "name": "Chamoli",
        "state_id": "IN-UT",
        "state_name": "Uttarakhand",
        "center": {"lat": 30.5574, "lon": 79.3468},
        "population": 391605,
        "coastal_length_km": 0.0,
        "elevation_m": 1420.0,
        "hazard_tags": ["landslide", "glacial_lake_outburst", "flash_flood", "earthquake"],
        "critical_assets_count": 145,
        "cyclone_shelters_count": 0,
        "substations_count": 8,
        "hospitals_count": 6,
    }
}


def list_districts(hazard_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    districts = list(DISTRICTS_REGISTRY.values())
    if hazard_filter:
        return [d for d in districts if hazard_filter.lower() in [h.lower() for h in d["hazard_tags"]]]
    return districts


def get_district(district_id: str) -> Optional[Dict[str, Any]]:
    return DISTRICTS_REGISTRY.get(district_id.upper())


def get_districts_by_state(state_id: str) -> List[Dict[str, Any]]:
    return [d for d in DISTRICTS_REGISTRY.values() if d["state_id"].upper() == state_id.upper()]
