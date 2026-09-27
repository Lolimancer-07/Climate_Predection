"""
data-ingestion/weather/cyclone_track.py
Fetch and parse cyclone track/intensity from IMD, JTWC, and GDACS.
"""
import re
import csv
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel


class TrackPoint(BaseModel):
    timestamp: datetime
    lat: float
    lon: float
    wind_speed_kt: float        # max sustained 1-min wind, knots
    central_pressure_hpa: float
    radius_max_wind_nm: float   # radius of maximum winds, nautical miles
    forward_speed_kt: float     # cyclone translation speed, knots
    category: str               # RSMC category string or SAFFIR-SIMPSON


class CycloneTrack(BaseModel):
    event_id: str
    name: str
    source: str                 # IMD | JTWC | GDACS
    basin: str                  # BoB | AS | NIO
    track_points: list[TrackPoint]
    landfall_point: Optional[TrackPoint] = None
    landfall_district: Optional[str] = None


# ── GDACS feed parser ────────────────────────────────────────────────────────

GDACS_FEED = "https://www.gdacs.org/xml/rss.xml"
GDACS_NS = {"gdacs": "http://www.gdacs.org"}


def fetch_gdacs_active_cyclones(timeout: int = 10) -> list[dict]:
    """
    Parse GDACS RSS for active tropical cyclone events.
    Returns a list of dicts with event metadata.
    """
    resp = httpx.get(GDACS_FEED, timeout=timeout)
    resp.raise_for_status()
    root = ET.fromstring(resp.text)
    channel = root.find("channel")
    events = []
    for item in channel.findall("item"):
        event_type = item.findtext("gdacs:eventtype", namespaces=GDACS_NS, default="")
        if event_type.upper() != "TC":
            continue
        events.append({
            "event_id": item.findtext("gdacs:eventid", namespaces=GDACS_NS),
            "name": item.findtext("title", default=""),
            "severity": item.findtext("gdacs:severity", namespaces=GDACS_NS),
            "lat": float(item.findtext("gdacs:lat", namespaces=GDACS_NS, default="0")),
            "lon": float(item.findtext("gdacs:lon", namespaces=GDACS_NS, default="0")),
            "link": item.findtext("link", default=""),
        })
    return events


# ── JTWC best-track parser ───────────────────────────────────────────────────

JTWC_BASE = "https://www.metoc.navy.mil/jtwc/products"


def fetch_jtwc_track(storm_id: str, timeout: int = 15) -> CycloneTrack:
    """
    Fetch a JTWC best-track (b-deck) file for a given storm ID (e.g., 'IO012019').
    Returns a CycloneTrack parsed from the ATCF fixed-width format.
    """
    url = f"{JTWC_BASE}/best_tracks/b{storm_id.lower()}.dat"
    resp = httpx.get(url, timeout=timeout)
    resp.raise_for_status()

    track_points = []
    for line in resp.text.splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 12:
            continue
        dt_str = parts[2]   # YYYYMMDDHH
        try:
            ts = datetime.strptime(dt_str, "%Y%m%d%H").replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        lat_raw = parts[6]
        lon_raw = parts[7]
        lat = float(lat_raw[:-1]) / 10 * (-1 if lat_raw.endswith("S") else 1)
        lon = float(lon_raw[:-1]) / 10 * (-1 if lon_raw.endswith("W") else 1)

        track_points.append(TrackPoint(
            timestamp=ts,
            lat=lat,
            lon=lon,
            wind_speed_kt=float(parts[8]) if parts[8] else 0,
            central_pressure_hpa=float(parts[9]) if parts[9] else 1005,
            radius_max_wind_nm=float(parts[11]) if len(parts) > 11 and parts[11] else 30,
            forward_speed_kt=0,   # not directly in b-deck; compute from consecutive points
            category=parts[10] if len(parts) > 10 else "TD",
        ))

    return CycloneTrack(
        event_id=storm_id.upper(),
        name=storm_id,
        source="JTWC",
        basin="BoB",
        track_points=track_points,
    )


# ── Hardcoded historical tracks for demo ────────────────────────────────────

def load_historical_track(cyclone_name: str) -> CycloneTrack:
    """
    Load a hardcoded historical track for demo purposes.
    In production, replace with IBTrACS API call.
    """
    # Cyclone Fani 2019 — key track points only (landfall ~2019-05-03 08:00 UTC)
    FANI_TRACK = [
        TrackPoint(timestamp=datetime(2019, 4, 30, 0, tzinfo=timezone.utc),
                   lat=10.5, lon=87.5, wind_speed_kt=50, central_pressure_hpa=985,
                   radius_max_wind_nm=40, forward_speed_kt=8, category="CS"),
        TrackPoint(timestamp=datetime(2019, 5, 1, 0, tzinfo=timezone.utc),
                   lat=12.0, lon=86.0, wind_speed_kt=100, central_pressure_hpa=952,
                   radius_max_wind_nm=50, forward_speed_kt=10, category="ESCS"),
        TrackPoint(timestamp=datetime(2019, 5, 2, 0, tzinfo=timezone.utc),
                   lat=14.5, lon=85.2, wind_speed_kt=130, central_pressure_hpa=932,
                   radius_max_wind_nm=55, forward_speed_kt=13, category="ESCS"),
        TrackPoint(timestamp=datetime(2019, 5, 3, 8, tzinfo=timezone.utc),  # landfall
                   lat=19.5, lon=85.9, wind_speed_kt=130, central_pressure_hpa=932,
                   radius_max_wind_nm=55, forward_speed_kt=15, category="ESCS"),
    ]

    tracks = {
        "FANI-2019": CycloneTrack(
            event_id="CYCLONE-FANI-2019",
            name="Fani",
            source="IMD",
            basin="BoB",
            track_points=FANI_TRACK,
            landfall_point=FANI_TRACK[-1],
            landfall_district="IN-OD-PURI",
        ),
        "MOCHA-2023": CycloneTrack(
            event_id="CYCLONE-MOCHA-2023",
            name="Mocha",
            source="IMD",
            basin="BoB",
            track_points=[
                TrackPoint(timestamp=datetime(2023, 5, 12, 0, tzinfo=timezone.utc),
                           lat=11.0, lon=88.0, wind_speed_kt=55, central_pressure_hpa=980,
                           radius_max_wind_nm=35, forward_speed_kt=7, category="CS"),
                TrackPoint(timestamp=datetime(2023, 5, 14, 14, tzinfo=timezone.utc),  # landfall
                           lat=20.5, lon=92.8, wind_speed_kt=155, central_pressure_hpa=920,
                           radius_max_wind_nm=60, forward_speed_kt=12, category="SuCS"),
            ],
        ),
    }

    key = cyclone_name.upper()
    if key not in tracks:
        raise ValueError(f"Unknown historical cyclone: {cyclone_name}. Available: {list(tracks)}")
    return tracks[key]
