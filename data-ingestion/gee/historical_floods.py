"""
data-ingestion/gee/historical_floods.py
Pull historical flood extents from GEE for model calibration.
Uses GLOBAL_FLOOD_DB/MODIS_EVENTS/V1 to backtest surge/runoff models
against real cyclone events (Amphan, Fani, Yaas, Mocha).
"""
import ee
from datetime import date
from typing import Optional


# Historical events used for calibration
CALIBRATION_EVENTS = {
    "FANI-2019": {
        "date_range": ("2019-04-29", "2019-05-07"),
        "bbox": [84.0, 18.0, 88.0, 22.0],
        "landfall_lat": 19.5,
        "landfall_lon": 85.9,
        "peak_surge_survey_m": 3.4,   # post-event survey value
    },
    "AMPHAN-2020": {
        "date_range": ("2020-05-18", "2020-05-25"),
        "bbox": [85.0, 20.0, 90.0, 23.0],
        "landfall_lat": 22.2,
        "landfall_lon": 88.3,
        "peak_surge_survey_m": 5.0,
    },
    "YAAS-2021": {
        "date_range": ("2021-05-25", "2021-06-01"),
        "bbox": [85.0, 19.0, 90.0, 22.5],
        "landfall_lat": 21.1,
        "landfall_lon": 87.1,
        "peak_surge_survey_m": 4.0,
    },
    "MOCHA-2023": {
        "date_range": ("2023-05-12", "2023-05-18"),
        "bbox": [91.0, 19.0, 94.0, 22.0],
        "landfall_lat": 20.5,
        "landfall_lon": 92.8,
        "peak_surge_survey_m": 3.5,
    },
}


def get_flood_extent(
    event_key: str,
    scale: int = 500,
) -> ee.Image:
    """
    Retrieve the MODIS-based flood extent image for a given calibration event.
    Returns a binary flood mask (1=flooded, 0=dry).
    """
    event = CALIBRATION_EVENTS.get(event_key)
    if not event:
        raise ValueError(f"Unknown event key: {event_key}. Available: {list(CALIBRATION_EVENTS)}")

    start, end = event["date_range"]
    bbox = event["bbox"]   # [west, south, east, north]
    aoi = ee.Geometry.BBox(bbox[0], bbox[1], bbox[2], bbox[3])

    flood_db = (
        ee.ImageCollection("GLOBAL_FLOOD_DB/MODIS_EVENTS/V1")
        .filterDate(start, end)
        .filterBounds(aoi)
        .select("flooded")
        .max()   # worst-case extent during the event window
        .clip(aoi)
    )
    return flood_db


def compute_flood_area_km2(flood_mask: ee.Image, aoi: ee.Geometry, scale: int = 500) -> float:
    """
    Compute total flooded area (km²) from a binary flood mask.
    """
    pixel_area = ee.Image.pixelArea().divide(1e6)   # m² → km²
    flooded_area = flood_mask.multiply(pixel_area)

    result = flooded_area.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=aoi,
        scale=scale,
        maxPixels=1e9,
    )
    return result.getInfo().get("flooded", 0.0)


def calibration_summary() -> dict:
    """
    Return all calibration event metadata (without GEE calls).
    Useful for displaying calibration dataset info in docs/notebooks.
    """
    return {k: {
        "date_range":           v["date_range"],
        "peak_surge_survey_m":  v["peak_surge_survey_m"],
        "landfall_lat":         v["landfall_lat"],
        "landfall_lon":         v["landfall_lon"],
    } for k, v in CALIBRATION_EVENTS.items()}
