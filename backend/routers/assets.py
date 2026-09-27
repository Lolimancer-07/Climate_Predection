"""
backend/routers/assets.py
GET /assets/{district_id} — List infrastructure assets and criticality scores.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from data_ingestion.exposure.osm_extract import PURI_DEMO_ASSETS

router = APIRouter()


class AssetOut(BaseModel):
    asset_id: str
    asset_type: str
    name: str
    criticality: float
    geometry: dict


@router.get("/{district_id}", response_model=list[AssetOut])
async def list_assets(district_id: str, asset_type: Optional[str] = None):
    """
    List infrastructure assets for a district.
    Optionally filter by asset_type (hospital|shelter|road|power_line|substation).
    """
    if district_id != "IN-OD-PURI":
        raise HTTPException(status_code=404, detail=f"District {district_id} not in demo dataset.")

    assets = PURI_DEMO_ASSETS
    if asset_type:
        assets = [a for a in assets if a["asset_type"] == asset_type]

    return [
        AssetOut(
            asset_id=a["asset_id"],
            asset_type=a["asset_type"],
            name=a["name"],
            criticality=a["criticality"],
            geometry=a["geometry"],
        )
        for a in assets
    ]
