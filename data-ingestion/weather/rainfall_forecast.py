"""
data-ingestion/weather/rainfall_forecast.py
Fetch rainfall and wind field forecasts from Open-Meteo (GFS backend).
"""
import httpx
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel


class GridCell(BaseModel):
    lat: float
    lon: float
    rainfall_mm_24h: float
    rainfall_mm_48h: float
    rainfall_mm_72h: float
    wind_speed_10m_kmh: float   # max gust in forecast window


class RainfallForecast(BaseModel):
    district_id: str
    fetched_at: datetime
    grid_cells: list[GridCell]
    max_rainfall_mm_24h: float
    max_rainfall_mm_48h: float
    max_rainfall_mm_72h: float
    max_wind_speed_kmh: float


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def fetch_rainfall_forecast(
    lat: float,
    lon: float,
    district_id: str,
    timeout: int = 15,
) -> RainfallForecast:
    """
    Fetch 72-hour rainfall and wind forecast from Open-Meteo for a single point.
    For multi-point gridded fetches, call this in a loop over a grid.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation,wind_speed_10m,wind_gusts_10m",
        "forecast_days": 3,
        "timezone": "UTC",
    }
    resp = httpx.get(OPEN_METEO_URL, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    precip = hourly.get("precipitation", [])
    wind_gusts = hourly.get("wind_gusts_10m", [])

    # Accumulate rainfall over 24/48/72 h windows
    rain_24 = sum(precip[:24]) if len(precip) >= 24 else sum(precip)
    rain_48 = sum(precip[:48]) if len(precip) >= 48 else sum(precip)
    rain_72 = sum(precip[:72]) if len(precip) >= 72 else sum(precip)
    max_gust = max(wind_gusts) if wind_gusts else 0.0

    cell = GridCell(
        lat=lat,
        lon=lon,
        rainfall_mm_24h=round(rain_24, 1),
        rainfall_mm_48h=round(rain_48, 1),
        rainfall_mm_72h=round(rain_72, 1),
        wind_speed_10m_kmh=round(max_gust, 1),
    )

    return RainfallForecast(
        district_id=district_id,
        fetched_at=datetime.now(timezone.utc),
        grid_cells=[cell],
        max_rainfall_mm_24h=rain_24,
        max_rainfall_mm_48h=rain_48,
        max_rainfall_mm_72h=rain_72,
        max_wind_speed_kmh=max_gust,
    )


# ── Hardcoded historical data for Fani demo ──────────────────────────────────

def load_historical_rainfall(cyclone_name: str, district_id: str) -> RainfallForecast:
    """Return representative forecast values for the historical demo cyclone."""
    presets = {
        "FANI-2019": {
            "max_rainfall_mm_24h": 180.0,
            "max_rainfall_mm_48h": 280.0,
            "max_rainfall_mm_72h": 320.0,
            "max_wind_speed_kmh": 215.0,
        },
        "MOCHA-2023": {
            "max_rainfall_mm_24h": 120.0,
            "max_rainfall_mm_48h": 200.0,
            "max_rainfall_mm_72h": 240.0,
            "max_wind_speed_kmh": 285.0,
        },
    }
    p = presets.get(cyclone_name.upper(), presets["FANI-2019"])
    cell = GridCell(
        lat=19.8,
        lon=85.8,
        rainfall_mm_24h=p["max_rainfall_mm_24h"],
        rainfall_mm_48h=p["max_rainfall_mm_48h"],
        rainfall_mm_72h=p["max_rainfall_mm_72h"],
        wind_speed_10m_kmh=p["max_wind_speed_kmh"],
    )
    return RainfallForecast(
        district_id=district_id,
        fetched_at=datetime.now(timezone.utc),
        grid_cells=[cell],
        **p,
    )
