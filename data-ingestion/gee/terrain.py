"""
data-ingestion/gee/terrain.py
Extract DEM, slope, and Topographic Wetness Index (TWI) for a given AOI.
"""
import ee
import math
from typing import Any


def get_dem(aoi: ee.Geometry) -> ee.Image:
    """Return SRTM/MERIT DEM clipped to AOI, in metres."""
    srtm = ee.Image("USGS/SRTMGL1_003").clip(aoi)
    merit = ee.Image("MERIT/DEM/v1_0_3").clip(aoi)
    # Prefer MERIT where available (better coastal resolution)
    return ee.Image(ee.Algorithms.If(
        merit.bandNames().size().gt(0), merit, srtm
    ))


def get_slope(dem: ee.Image) -> ee.Image:
    """Return slope (degrees) from DEM."""
    return ee.Terrain.slope(dem)


def get_twi(dem: ee.Image, scale: int = 90) -> ee.Image:
    """
    Compute a proxy Topographic Wetness Index (TWI).
    TWI = ln(a / tan(beta))
    where a = specific catchment area (approx. from flow accumulation)
    and beta = slope angle.

    For hackathon speed we use slope only and approximate flow accumulation
    using the GEE terrain products rather than running a full D-infinity solver.
    """
    slope_rad = ee.Terrain.slope(dem).multiply(math.pi / 180)
    tan_slope = slope_rad.tan().max(ee.Image(0.001))   # avoid div-by-zero

    # Proxy catchment area using GEE's built-in accumulation (relative)
    flow_acc = ee.Image("MERIT/Hydro/v1_0_1").select("upa").clip(dem.geometry())

    # Specific contributing area — normalised to keep values comparable across AOIs
    sca = flow_acc.add(1).log()

    twi = sca.divide(tan_slope).log().rename("TWI")
    return twi


def get_coastal_shelf_slope(aoi: ee.Geometry) -> ee.Number:
    """
    Compute average near-shore DEM slope within 20 km of the coast.
    Used by the surge model as a shelf amplification factor.
    """
    dem = get_dem(aoi)
    buffered_coast = aoi.buffer(20_000)   # 20 km inland from AOI edge
    mean_slope = (
        ee.Terrain.slope(dem)
        .reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=buffered_coast,
            scale=500,
            maxPixels=1e8,
        )
    )
    return ee.Number(mean_slope.get("slope"))


def export_terrain_to_drive(
    aoi: ee.Geometry,
    description: str,
    folder: str = "cyclone_platform_exports",
    scale: int = 90,
) -> dict[str, Any]:
    """
    Submit GEE export tasks for DEM and TWI layers to Google Drive.
    Returns task IDs for monitoring.
    """
    dem = get_dem(aoi)
    twi = get_twi(dem, scale)

    task_dem = ee.batch.Export.image.toDrive(
        image=dem,
        description=f"{description}_DEM",
        folder=folder,
        scale=scale,
        region=aoi,
        fileFormat="GeoTIFF",
        maxPixels=1e9,
    )
    task_twi = ee.batch.Export.image.toDrive(
        image=twi,
        description=f"{description}_TWI",
        folder=folder,
        scale=scale,
        region=aoi,
        fileFormat="GeoTIFF",
        maxPixels=1e9,
    )

    task_dem.start()
    task_twi.start()

    return {
        "dem_task_id": task_dem.id,
        "twi_task_id": task_twi.id,
    }
