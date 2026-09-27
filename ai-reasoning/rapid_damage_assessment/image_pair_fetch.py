"""
ai-reasoning/rapid_damage_assessment/image_pair_fetch.py
Pre-event and post-event satellite image tile retrieval via Google Earth Engine.

Retrieves Sentinel-2 or Landsat imagery for:
    - Pre-event: 7-day window ending 5 days before landfall_date
    - Post-event: 10-day window starting 1 day after landfall_date

When GEE is unavailable (demo mode), returns synthetic placeholder PNG bytes.
"""
from __future__ import annotations

import base64
import io
import logging
import struct
import zlib
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ImagePair:
    """
    Container for a pre/post-event image pair for one spatial area.

    Attributes:
        asset_id: Infrastructure asset identifier.
        district_id: District being assessed.
        center_lat: Center latitude of the tile.
        center_lon: Center longitude of the tile.
        pre_event_date: Date of pre-event image.
        post_event_date: Date of post-event image.
        pre_event_bytes: Raw PNG/GeoTIFF bytes of pre-event image.
        post_event_bytes: Raw PNG/GeoTIFF bytes of post-event image.
        source: Image source identifier (e.g., "sentinel2", "landsat8", "demo_synthetic").
        cloud_cover_pct: Maximum cloud cover filter applied.
    """
    asset_id: str
    district_id: str
    center_lat: float
    center_lon: float
    pre_event_date: date
    post_event_date: date
    pre_event_bytes: bytes
    post_event_bytes: bytes
    source: str
    cloud_cover_pct: float


def _make_demo_png(label: str, width: int = 64, height: int = 64) -> bytes:
    """Generate a minimal valid PNG placeholder for demo mode."""
    # A very small solid-color PNG
    def _chunk(chunk_type: bytes, data: bytes) -> bytes:
        length = struct.pack(">I", len(data))
        crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return length + chunk_type + data + crc

    # Color: greenish for pre-event, brownish for post-event
    color = (60, 120, 60) if "pre" in label.lower() else (120, 80, 40)

    raw_rows = b""
    for _ in range(height):
        row = b"\x00" + bytes([color[0], color[1], color[2]] * width)
        raw_rows += row

    compressed = zlib.compress(raw_rows)

    png_signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = _chunk(b"IHDR", ihdr_data)
    idat = _chunk(b"IDAT", compressed)
    iend = _chunk(b"IEND", b"")

    return png_signature + ihdr + idat + iend


def _try_gee_fetch(
    lat: float,
    lon: float,
    pre_start: date,
    pre_end: date,
    post_start: date,
    post_end: date,
    cloud_cover_pct: float,
) -> tuple[bytes | None, bytes | None, str]:
    """
    Attempt to fetch Sentinel-2 image pair from Google Earth Engine.

    Returns:
        (pre_bytes, post_bytes, source_name) or (None, None, "") on failure.
    """
    try:
        import ee  # type: ignore

        try:
            ee.Initialize(opt_url="https://earthengine.googleapis.com")
        except Exception:
            ee.Initialize()

        roi = ee.Geometry.Point([lon, lat]).buffer(1000)

        def _best_sentinel2(start: date, end: date) -> bytes | None:
            collection = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(roi)
                .filterDate(start.isoformat(), end.isoformat())
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", cloud_cover_pct))
                .select(["B4", "B3", "B2"])  # RGB
                .sort("CLOUDY_PIXEL_PERCENTAGE")
            )
            image = collection.first()
            if image is None:
                return None

            url = image.getThumbURL(
                {"min": 0, "max": 3000, "region": roi, "dimensions": 256, "format": "png"}
            )
            import urllib.request
            with urllib.request.urlopen(url, timeout=30) as resp:
                return resp.read()

        pre_bytes = _best_sentinel2(pre_start, pre_end)
        post_bytes = _best_sentinel2(post_start, post_end)
        if pre_bytes and post_bytes:
            return pre_bytes, post_bytes, "sentinel2"
        return None, None, ""

    except Exception as exc:  # noqa: BLE001
        logger.warning("GEE image fetch failed (%s). Falling back to demo mode.", exc)
        return None, None, ""


def fetch_image_pair(
    asset_id: str,
    district_id: str,
    lat: float,
    lon: float,
    landfall_date: date,
    cloud_cover_pct: float = 20.0,
) -> ImagePair:
    """
    Retrieve pre- and post-event satellite image pair for an asset location.

    Args:
        asset_id: Infrastructure asset identifier.
        district_id: District string (e.g., "IN-OD-PURI").
        lat: Asset latitude.
        lon: Asset longitude.
        landfall_date: Expected or actual cyclone landfall date.
        cloud_cover_pct: Maximum cloud cover percentage filter for GEE.

    Returns:
        ImagePair with pre- and post-event image bytes.
    """
    pre_start = landfall_date - timedelta(days=12)
    pre_end = landfall_date - timedelta(days=5)
    post_start = landfall_date + timedelta(days=1)
    post_end = landfall_date + timedelta(days=10)

    pre_bytes, post_bytes, source = _try_gee_fetch(
        lat, lon, pre_start, pre_end, post_start, post_end, cloud_cover_pct
    )

    if pre_bytes is None or post_bytes is None:
        logger.info("Using synthetic demo images for asset %s.", asset_id)
        pre_bytes = _make_demo_png("pre-event")
        post_bytes = _make_demo_png("post-event")
        source = "demo_synthetic"

    return ImagePair(
        asset_id=asset_id,
        district_id=district_id,
        center_lat=lat,
        center_lon=lon,
        pre_event_date=pre_start + timedelta(days=6),
        post_event_date=post_start + timedelta(days=4),
        pre_event_bytes=pre_bytes,
        post_event_bytes=post_bytes,
        source=source,
        cloud_cover_pct=cloud_cover_pct,
    )
