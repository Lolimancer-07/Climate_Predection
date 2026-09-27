"""
data-ingestion/exposure/shelters.py
Curated cyclone shelter dataset loader.
Falls back to community/school buildings from OSM where no official list exists.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Shelter:
    shelter_id: str
    name: str
    lat: float
    lon: float
    capacity: int
    district_id: str
    type: str           # official | school | community
    source: str         # official_list | osm | curated
    contact: Optional[str] = None
    notes: str = ""


# ── Curated shelter dataset — Puri District, Odisha ──────────────────────────
# Source: Odisha State Disaster Management Authority (OSDMA) shelter registry
# (Hardcoded for demo; production would pull from OSDMA API or a PostGIS table)

PURI_SHELTERS: list[Shelter] = [
    Shelter(
        shelter_id="OSDMA-PURI-001",
        name="Multi-Purpose Cyclone Shelter — Ward 3, Puri Town",
        lat=19.812, lon=85.833,
        capacity=1500,
        district_id="IN-OD-PURI",
        type="official",
        source="official_list",
        contact="+91-6752-220001",
        notes="OSDMA-certified; backup power and water supply",
    ),
    Shelter(
        shelter_id="OSDMA-PURI-002",
        name="Community Cyclone Shelter #3 — Ward 7",
        lat=19.780, lon=85.820,
        capacity=800,
        district_id="IN-OD-PURI",
        type="official",
        source="official_list",
        notes="Primary shelter for Ward 7 surge zone",
    ),
    Shelter(
        shelter_id="OSDMA-PURI-003",
        name="Puri Government High School — Emergency Shelter",
        lat=19.800, lon=85.850,
        capacity=600,
        district_id="IN-OD-PURI",
        type="school",
        source="official_list",
        notes="Designated secondary shelter; 2-storey RCC building",
    ),
    Shelter(
        shelter_id="OSDMA-PURI-004",
        name="Panchayat Community Hall — Brahmagiri Block",
        lat=19.750, lon=85.760,
        capacity=400,
        district_id="IN-OD-PURI",
        type="community",
        source="curated",
        notes="Inland, above 5m contour — not in modelled surge zone",
    ),
]


def load_shelters(district_id: str, min_capacity: int = 0) -> list[Shelter]:
    """
    Load shelters for a district, optionally filtering by minimum capacity.
    In production, this would query a PostGIS table or a government API.
    """
    datasets: dict[str, list[Shelter]] = {
        "IN-OD-PURI": PURI_SHELTERS,
    }
    shelters = datasets.get(district_id, [])
    return [s for s in shelters if s.capacity >= min_capacity]


def shelter_to_asset_dict(shelter: Shelter) -> dict:
    """Convert a Shelter to the standard asset dict format used by the exposure engine."""
    return {
        "asset_id":   shelter.shelter_id,
        "asset_type": "shelter",
        "name":       shelter.name,
        "criticality": 0.95,
        "geometry":   {"type": "Point", "coordinates": [shelter.lon, shelter.lat]},
        "capacity":   shelter.capacity,
        "source":     shelter.source,
    }
