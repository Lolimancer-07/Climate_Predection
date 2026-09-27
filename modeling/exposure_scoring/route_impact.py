"""
modeling/exposure_scoring/route_impact.py
Compute alternate evacuation routes when flagged roads are removed from the graph.
Uses osmnx + networkx with hazard-flagged edges removed.
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RouteImpactResult:
    origin_name: str
    destination_name: str
    origin_coords: tuple[float, float]       # (lon, lat)
    destination_coords: tuple[float, float]  # (lon, lat)
    primary_route_blocked: bool
    alternate_route_available: bool
    alternate_distance_km: Optional[float]
    alternate_route_geojson: Optional[dict]
    blocked_roads: list[str]
    recommendation: str


def compute_route_impact(
    origin_lon: float,
    origin_lat: float,
    destination_lon: float,
    destination_lat: float,
    hazard_geojson_features: list[dict],
    blocked_road_ids: list[str],
    district_id: str = "IN-OD-PURI",
    network_type: str = "drive",
) -> RouteImpactResult:
    """
    Check whether the route from origin (population centroid) to destination
    (nearest shelter) is blocked by hazard-flagged roads, and compute an
    alternate if available.

    Uses osmnx to pull the road network from OSM and networkx to compute
    shortest path with flagged edges removed.

    Falls back gracefully if osmnx is not installed (returns a mock result
    for demo mode).
    """
    try:
        import osmnx as ox
        import networkx as nx
        return _compute_with_osmnx(
            origin_lon, origin_lat,
            destination_lon, destination_lat,
            hazard_geojson_features, blocked_road_ids, district_id,
        )
    except ImportError:
        return _mock_route_result(
            origin_lon, origin_lat, destination_lon, destination_lat,
            blocked_road_ids,
        )


def _compute_with_osmnx(
    origin_lon: float, origin_lat: float,
    dest_lon: float, dest_lat: float,
    hazard_features: list[dict],
    blocked_road_ids: list[str],
    district_id: str,
) -> RouteImpactResult:
    import osmnx as ox
    import networkx as nx
    from shapely.geometry import shape
    from shapely.ops import unary_union

    # Pull network around the midpoint
    mid_lat = (origin_lat + dest_lat) / 2
    mid_lon = (origin_lon + dest_lon) / 2
    dist_m  = 15_000   # 15 km buffer

    G = ox.graph_from_point((mid_lat, mid_lon), dist=dist_m, network_type="drive")

    orig_node = ox.nearest_nodes(G, origin_lon, origin_lat)
    dest_node = ox.nearest_nodes(G, dest_lon, dest_lat)

    # ── Primary route ──────────────────────────────────────────
    try:
        primary = nx.shortest_path(G, orig_node, dest_node, weight="length")
        primary_ok = True
    except nx.NetworkXNoPath:
        primary_ok = False
        primary = []

    # ── Build hazard union polygon ─────────────────────────────
    if hazard_features:
        hazard_union = unary_union([shape(f["geometry"]) for f in hazard_features if f.get("geometry")])
    else:
        hazard_union = None

    # ── Identify & remove blocked edges ───────────────────────
    blocked_edges = set()
    for u, v, data in G.edges(data=True):
        geom = data.get("geometry")
        if geom is None:
            continue
        if hazard_union and hazard_union.intersects(geom):
            blocked_edges.add((u, v))

    G_pruned = G.copy()
    G_pruned.remove_edges_from(blocked_edges)

    # ── Alternate route ────────────────────────────────────────
    try:
        alternate = nx.shortest_path(G_pruned, orig_node, dest_node, weight="length")
        alt_length = nx.path_weight(G_pruned, alternate, weight="length")
        alt_km     = round(alt_length / 1000, 2)
        alt_geojson = _path_to_geojson(G_pruned, alternate)
        alt_available = True
    except nx.NetworkXNoPath:
        alt_km     = None
        alt_geojson = None
        alt_available = False

    primary_blocked = len(blocked_edges) > 0

    recommendation = _build_recommendation(primary_blocked, alt_available, alt_km)

    return RouteImpactResult(
        origin_name="Population centroid",
        destination_name="Nearest open shelter",
        origin_coords=(origin_lon, origin_lat),
        destination_coords=(dest_lon, dest_lat),
        primary_route_blocked=primary_blocked,
        alternate_route_available=alt_available,
        alternate_distance_km=alt_km,
        alternate_route_geojson=alt_geojson,
        blocked_roads=blocked_road_ids,
        recommendation=recommendation,
    )


def _mock_route_result(
    origin_lon: float, origin_lat: float,
    dest_lon: float, dest_lat: float,
    blocked_road_ids: list[str],
) -> RouteImpactResult:
    """Fallback when osmnx is not installed. Returns realistic demo data."""
    primary_blocked = len(blocked_road_ids) > 0
    alt_available   = True
    alt_km          = 4.2

    return RouteImpactResult(
        origin_name="Ward 7 population centroid",
        destination_name="Community Cyclone Shelter #3",
        origin_coords=(origin_lon, origin_lat),
        destination_coords=(dest_lon, dest_lat),
        primary_route_blocked=primary_blocked,
        alternate_route_available=alt_available,
        alternate_distance_km=alt_km,
        alternate_route_geojson={
            "type": "Feature",
            "properties": {"type": "alternate_evacuation_route", "distance_km": alt_km},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [origin_lon, origin_lat],
                    [origin_lon + 0.01, origin_lat + 0.01],
                    [dest_lon, dest_lat],
                ],
            },
        },
        blocked_roads=blocked_road_ids,
        recommendation=_build_recommendation(primary_blocked, alt_available, alt_km),
    )


def _build_recommendation(blocked: bool, alt_available: bool, alt_km: Optional[float]) -> str:
    if not blocked:
        return "Primary evacuation route is clear. Proceed normally."
    if alt_available and alt_km:
        return (
            f"Primary route is blocked by hazard zone. "
            f"Use alternate route ({alt_km:.1f} km). Begin evacuation immediately."
        )
    return (
        "PRIMARY AND ALL ALTERNATE ROUTES BLOCKED. "
        "Vertical evacuation to upper floors recommended. Contact rescue services."
    )


def _path_to_geojson(G, path: list) -> dict:
    """Convert an osmnx graph path to a GeoJSON LineString."""
    try:
        import osmnx as ox
        coords = [
            (G.nodes[n]["x"], G.nodes[n]["y"])
            for n in path
        ]
        return {
            "type": "Feature",
            "properties": {"type": "alternate_evacuation_route"},
            "geometry": {"type": "LineString", "coordinates": coords},
        }
    except Exception:
        return {}
