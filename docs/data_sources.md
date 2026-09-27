# Data Sources & Ingestion Catalog

The platform ingests from satellite observations, numerical weather prediction systems, and open geospatial registries.

---

## 1. Google Earth Engine (GEE) Datasets

| Dataset ID | Provider | Resolution | Platform Usage |
|---|---|---|---|
| `USGS/SRTMGL1_003` | NASA / USGS | 30m | Digital Elevation Model (DEM) and slope calculation for surge inundation |
| `MERIT/DEM/v1_0_3` | University of Tokyo | 90m | Topographic Wetness Index (TWI) baseline for rainfall-runoff modeling |
| `GOOGLE/DYNAMICWORLD/V1` | Google / WRI | 10m | Real-time land cover classification (built-up, water, vegetation, bare) |
| `GLOBAL_FLOOD_DB/MODIS_EVENTS/V1` | Cloud to Street / NASA | 250m | Historical cyclone flood footprints used for surge calibration (Fani, Amphan, Mocha) |
| `GOOGLE/Research/open-buildings/v3/polygons` | Google Research | Building polygon | Critical asset proxy when official building footprints are absent |

---

## 2. Meteorological & Storm Track Feeds

| Source | Protocol | Cadence | Key Parameters Ingested |
|---|---|---|---|
| **India Meteorological Department (IMD)** | RSMC Bulletins / HTTP | 3–6 hours | Track points, sustained wind speed (kt), central pressure (hPa), RMW, forecast track |
| **Joint Typhoon Warning Center (JTWC)** | Automated Best Track / RSS | 6 hours | Track forecasts, wind radii (34kt, 50kt, 64kt quadrants) |
| **GDACS (Global Disaster Alert & Coordination System)** | RSS / GeoJSON Feed | Real-time | Multi-hazard alerts, population exposure estimates, cyclone event IDs |
| **Open-Meteo (GFS / ECMWF Backend)** | REST API | Hourly / 3-hourly | 72-hour precipitation forecast grids, 10m wind gusts, surface air pressure |

---

## 3. Exposure & Infrastructure Basemaps

| Source | Layer | Description |
|---|---|---|
| **OpenStreetMap (Overpass API)** | Highways / Roads | Arterial roads, motorways, primary and secondary evacuation corridors |
| **OpenStreetMap (Overpass API)** | Healthcare & Power | Hospitals, clinics, electrical substations, transmission lines |
| **Odisha State Disaster Management Authority (OSDMA)** | Cyclone Shelters | Multi-purpose cyclone shelters in coastal districts (Puri, Ganjam, Jagatsinghpur) |
| **Census of India / GADM** | Administrative Units | District, taluk/block, and ward boundary polygons with aggregated population numbers |
