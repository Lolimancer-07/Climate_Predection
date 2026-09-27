"""
data-ingestion/exposure/osm_extract.py
Extract roads, hospitals, power lines, and substations from OSM via Overpass API.
"""
import json
import httpx
from typing import Literal
from shapely.geometry import shape, mapping, Point, LineString

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

AssetType = Literal["hospital", "shelter", "road", "power_line", "substation"]


def overpass_query(query: str, timeout: int = 30) -> dict:
    """Execute an Overpass QL query and return parsed JSON."""
    resp = httpx.post(
        OVERPASS_URL,
        data={"data": query},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def build_bbox_query(bbox: tuple[float, float, float, float], filters: str) -> str:
    """
    Build an Overpass query for a bounding box.
    bbox = (south, west, north, east)
    """
    s, w, n, e = bbox
    return f"""
[out:json][timeout:60];
(
  node{filters}({s},{w},{n},{e});
  way{filters}({s},{w},{n},{e});
  relation{filters}({s},{w},{n},{e});
);
out geom;
"""


def extract_hospitals(bbox: tuple[float, float, float, float]) -> list[dict]:
    """Return hospital/clinic features as GeoJSON-like dicts."""
    query = build_bbox_query(bbox, '[amenity~"hospital|clinic|health_centre"]')
    data = overpass_query(query)
    features = []
    for el in data.get("elements", []):
        geom = _element_to_geometry(el)
        if geom is None:
            continue
        features.append({
            "asset_id": f"OSM-{el['type']}-{el['id']}",
            "asset_type": "hospital",
            "name": el.get("tags", {}).get("name", "Unknown Hospital"),
            "criticality": 1.0,   # hospitals always maximum criticality
            "geometry": mapping(geom),
            "osm_tags": el.get("tags", {}),
        })
    return features


def extract_roads(bbox: tuple[float, float, float, float]) -> list[dict]:
    """Return major road features."""
    query = build_bbox_query(bbox, '[highway~"primary|trunk|secondary|tertiary"]')
    data = overpass_query(query)
    features = []
    for el in data.get("elements", []):
        geom = _element_to_geometry(el)
        if geom is None:
            continue
        highway = el.get("tags", {}).get("highway", "secondary")
        criticality = {"trunk": 0.9, "primary": 0.8, "secondary": 0.6, "tertiary": 0.4}.get(highway, 0.5)
        features.append({
            "asset_id": f"OSM-{el['type']}-{el['id']}",
            "asset_type": "road",
            "name": el.get("tags", {}).get("name", f"Road-{el['id']}"),
            "criticality": criticality,
            "geometry": mapping(geom),
            "osm_tags": el.get("tags", {}),
        })
    return features


def extract_power_assets(bbox: tuple[float, float, float, float]) -> list[dict]:
    """Return power line and substation features."""
    query = build_bbox_query(bbox, '[power~"line|substation|tower"]')
    data = overpass_query(query)
    features = []
    for el in data.get("elements", []):
        geom = _element_to_geometry(el)
        if geom is None:
            continue
        power_type = el.get("tags", {}).get("power", "line")
        asset_type = "substation" if power_type == "substation" else "power_line"
        features.append({
            "asset_id": f"OSM-{el['type']}-{el['id']}",
            "asset_type": asset_type,
            "name": el.get("tags", {}).get("name", f"{asset_type}-{el['id']}"),
            "criticality": 0.9 if asset_type == "substation" else 0.6,
            "geometry": mapping(geom),
            "osm_tags": el.get("tags", {}),
        })
    return features


def extract_all_assets(bbox: tuple[float, float, float, float]) -> list[dict]:
    """Convenience: extract all asset types for an AOI bounding box."""
    assets = []
    assets.extend(extract_hospitals(bbox))
    assets.extend(extract_roads(bbox))
    assets.extend(extract_power_assets(bbox))
    return assets


def _element_to_geometry(el: dict):
    """Convert an Overpass element to a Shapely geometry."""
    try:
        if el["type"] == "node":
            return Point(el["lon"], el["lat"])
        elif el["type"] == "way" and "geometry" in el:
            coords = [(p["lon"], p["lat"]) for p in el["geometry"]]
            return LineString(coords) if len(coords) >= 2 else None
        else:
            return None
    except (KeyError, TypeError):
        return None


# ── Hardcoded demo assets for Puri district (Fani scenario) ─────────────────

PURI_DEMO_ASSETS = [
    {
        "asset_id": "SHELTER-03",
        "asset_type": "shelter",
        "name": "Community Cyclone Shelter #3, Ward 7",
        "criticality": 0.95,
        "geometry": {"type": "Point", "coordinates": [85.82, 19.78]},
    },
    {
        "asset_id": "SHELTER-07",
        "asset_type": "shelter",
        "name": "Puri Government High School Shelter",
        "criticality": 0.90,
        "geometry": {"type": "Point", "coordinates": [85.85, 19.80]},
    },
    {
        "asset_id": "HOSPITAL-01",
        "asset_type": "hospital",
        "name": "District Headquarters Hospital, Puri",
        "criticality": 1.0,
        "geometry": {"type": "Point", "coordinates": [85.83, 19.81]},
    },
    {
        "asset_id": "ROAD-12",
        "asset_type": "road",
        "name": "NH316 — Puri-Konark Road (Ward 7 access)",
        "criticality": 0.85,
        "geometry": {
            "type": "LineString",
            "coordinates": [[85.80, 19.77], [85.84, 19.78], [85.88, 19.79]],
        },
    },
    {
        "asset_id": "SUBST-01",
        "asset_type": "substation",
        "name": "TPCODL Puri 33/11kV Substation",
        "criticality": 0.90,
        "geometry": {"type": "Point", "coordinates": [85.81, 19.79]},
    },
]
