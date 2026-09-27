"""
data-ingestion/gee/exports.py
Export GEE layers as GeoTIFF or GeoJSON to Google Drive or Cloud Storage.
"""
import ee
from typing import Literal

ExportDest = Literal["drive", "cloud"]


def export_image(
    image: ee.Image,
    description: str,
    region: ee.Geometry,
    dest: ExportDest = "drive",
    folder: str = "cyclone_platform",
    scale: int = 90,
    file_format: str = "GeoTIFF",
    bucket: str = "",
) -> ee.batch.Task:
    """
    Submit a GEE image export task.
    Returns the task object so callers can monitor status.
    """
    if dest == "drive":
        task = ee.batch.Export.image.toDrive(
            image=image,
            description=description,
            folder=folder,
            scale=scale,
            region=region,
            fileFormat=file_format,
            maxPixels=1e9,
        )
    else:
        if not bucket:
            raise ValueError("bucket must be specified for Cloud Storage exports")
        task = ee.batch.Export.image.toCloudStorage(
            image=image,
            description=description,
            bucket=bucket,
            fileNamePrefix=f"{folder}/{description}",
            scale=scale,
            region=region,
            fileFormat=file_format,
            maxPixels=1e9,
        )
    task.start()
    return task


def export_surge_dem_package(
    district_id: str,
    aoi: ee.Geometry,
    dest: ExportDest = "drive",
    folder: str = "cyclone_platform",
) -> dict[str, str]:
    """
    Export the full terrain package needed for the surge model:
    DEM, slope, TWI, land cover, permeability.
    Returns a dict of {layer_name: task_id}.
    """
    from data_ingestion.gee.terrain import get_dem, get_slope, get_twi
    from data_ingestion.gee.landcover import get_permeability

    dem   = get_dem(aoi)
    slope = get_slope(dem)
    twi   = get_twi(dem)
    perm  = get_permeability(aoi)

    tasks = {}
    for name, img in [("DEM", dem), ("slope", slope), ("TWI", twi), ("permeability", perm)]:
        t = export_image(img, f"{district_id}_{name}", aoi, dest, folder)
        tasks[name] = t.id

    return tasks


def monitor_task(task: ee.batch.Task) -> dict:
    """Poll and return task status."""
    status = task.status()
    return {
        "task_id":    status.get("id"),
        "state":      status.get("state"),
        "description":status.get("description"),
        "error":      status.get("error_message", ""),
    }
