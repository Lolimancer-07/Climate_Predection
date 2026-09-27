"""
ai-reasoning/map_render.py
Server-side map image renderer for Gemini multimodal input.

Generates a PNG showing the hazard overlay + infrastructure assets
over a base terrain background (using matplotlib + contextily or
a static tile fallback when contextily is unavailable).
"""
from __future__ import annotations
import io
import json
import math
from typing import Optional


def render_hazard_map(
    hazard_geojson_features: list[dict],
    assets: list[dict],
    center_lat: float,
    center_lon: float,
    title: str = "Hazard Map",
    zoom_km: float = 20.0,
    dpi: int = 120,
) -> bytes:
    """
    Render a hazard map as PNG bytes for Gemini multimodal input.

    Returns PNG bytes. Raises RuntimeError if matplotlib is unavailable.
    In demo mode, returns a minimal synthetic image when tiles are unavailable.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")   # non-interactive backend
        import matplotlib.pyplot as plt
        import matplotlib.patches as mpatches
        from matplotlib.patches import Polygon as MplPolygon
        from matplotlib.collections import PatchCollection
        import numpy as np
    except ImportError as e:
        raise RuntimeError(f"matplotlib is required for map rendering: {e}")

    fig, ax = plt.subplots(figsize=(8, 8), dpi=dpi)
    fig.patch.set_facecolor("#0d1528")
    ax.set_facecolor("#0d1528")

    # ── Degrees per km at this latitude ───────────────────────
    deg_per_km_lat = 1 / 111.0
    deg_per_km_lon = 1 / (111.0 * math.cos(math.radians(center_lat)))

    lat_r = zoom_km * deg_per_km_lat
    lon_r = zoom_km * deg_per_km_lon

    ax.set_xlim(center_lon - lon_r, center_lon + lon_r)
    ax.set_ylim(center_lat - lat_r, center_lat + lat_r)

    # ── Draw hazard polygons ───────────────────────────────────
    COLOR_MAP = {
        "surge":          ("#ef4444", 0.35),
        "rainfall_flood": ("#f97316", 0.30),
        "composite":      ("#a855f7", 0.30),
    }

    for feat in hazard_geojson_features:
        geom = feat.get("geometry", {})
        props = feat.get("properties", {})
        h_type = props.get("hazard_type", "surge")
        color, alpha = COLOR_MAP.get(h_type, ("#ef4444", 0.3))

        if geom.get("type") == "Polygon":
            ring = geom["coordinates"][0]
            xs = [c[0] for c in ring]
            ys = [c[1] for c in ring]
            ax.fill(xs, ys, color=color, alpha=alpha, zorder=3)
            ax.plot(xs, ys, color=color, linewidth=1.5, linestyle="--", alpha=0.8, zorder=4)

    # ── Draw infrastructure assets ────────────────────────────
    ASSET_COLORS = {
        "hospital":    "#22c55e",
        "shelter":     "#38bdf8",
        "road":        "#94a3b8",
        "power_line":  "#f59e0b",
        "substation":  "#f59e0b",
    }
    ASSET_MARKERS = {
        "hospital": "P",   # plus-filled
        "shelter":  "^",   # triangle
        "road":     "_",   # h-line
        "substation":"s",  # square
        "power_line":"x",
    }

    for asset in assets:
        geom = asset.get("geometry", {})
        a_type = asset.get("asset_type", "road")
        color = ASSET_COLORS.get(a_type, "#94a3b8")
        marker = ASSET_MARKERS.get(a_type, "o")

        if geom.get("type") == "Point":
            lon, lat = geom["coordinates"]
            ax.plot(lon, lat, marker=marker, color=color, markersize=10,
                    markeredgecolor="white", markeredgewidth=0.8, zorder=6)
        elif geom.get("type") == "LineString":
            coords = geom["coordinates"]
            xs = [c[0] for c in coords]
            ys = [c[1] for c in coords]
            ax.plot(xs, ys, color=color, linewidth=2.5, zorder=5, alpha=0.85)

    # ── Labels and styling ─────────────────────────────────────
    ax.set_title(title, color="#e2e8f0", fontsize=12, fontweight="bold", pad=10)
    ax.tick_params(colors="#64748b", labelsize=7)
    for spine in ax.spines.values():
        spine.set_edgecolor("#1e293b")

    ax.set_xlabel("Longitude", color="#64748b", fontsize=8)
    ax.set_ylabel("Latitude", color="#64748b", fontsize=8)

    # Legend
    legend_items = [
        mpatches.Patch(color="#ef4444", alpha=0.5, label="Storm Surge Zone"),
        mpatches.Patch(color="#f97316", alpha=0.5, label="Rainfall Flood Risk"),
        mpatches.Patch(color="#38bdf8", alpha=0.9, label="Shelter"),
        mpatches.Patch(color="#22c55e", alpha=0.9, label="Hospital"),
        mpatches.Patch(color="#f59e0b", alpha=0.9, label="Power Asset"),
    ]
    ax.legend(
        handles=legend_items, loc="lower left", framealpha=0.3,
        facecolor="#0d1528", edgecolor="#334155", labelcolor="#e2e8f0", fontsize=7,
    )

    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def render_ward_map(
    ward_id: str,
    surge_geojson: dict,
    assets: list[dict],
    center_lat: float = 19.78,
    center_lon: float = 85.83,
) -> bytes:
    """Convenience wrapper for a single ward map."""
    return render_hazard_map(
        hazard_geojson_features=[surge_geojson] if surge_geojson else [],
        assets=assets,
        center_lat=center_lat,
        center_lon=center_lon,
        title=f"Hazard Map — {ward_id}",
        zoom_km=15.0,
    )
