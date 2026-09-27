"""
data-ingestion/gee/landcover.py
ESA WorldCover land-cover classes and surface permeability mapping.
"""
import ee

# ESA WorldCover v200 class codes → permeability coefficient (0–1)
# Higher value = more runoff (less infiltration)
PERMEABILITY_MAP = {
    10: 0.05,   # Tree cover         — high infiltration
    20: 0.20,   # Shrubland
    30: 0.35,   # Grassland
    40: 0.50,   # Cropland
    50: 0.95,   # Built-up           — near-impervious
    60: 0.40,   # Bare / sparse veg
    70: 0.10,   # Snow and ice
    80: 1.00,   # Permanent water    — no infiltration needed
    90: 0.60,   # Herbaceous wetland
    95: 0.55,   # Mangroves
    100: 0.30,  # Moss and lichen
}


def get_landcover(aoi: ee.Geometry) -> ee.Image:
    """Return ESA WorldCover 2021 land-cover image clipped to AOI."""
    return (
        ee.ImageCollection("ESA/WorldCover/v200")
        .first()
        .clip(aoi)
        .rename("lc_class")
    )


def get_permeability(aoi: ee.Geometry) -> ee.Image:
    """
    Remap ESA WorldCover classes to a permeability coefficient.
    Output band 'permeability' ranges 0 (fully permeable) to 1 (impervious).
    """
    lc = get_landcover(aoi)

    from_list = list(PERMEABILITY_MAP.keys())
    to_list = list(PERMEABILITY_MAP.values())

    permeability = lc.remap(from_list, to_list, defaultValue=0.30).rename(
        "permeability"
    )
    return permeability


def get_surge_roughness(aoi: ee.Geometry) -> ee.Image:
    """
    Manning's roughness coefficient proxy for surge friction.
    Used in the parametric surge bathtub-fill weighting.
    Dense vegetation / urban slows surge propagation.
    """
    lc = get_landcover(aoi)
    # Manning's n proxy values per class
    roughness_from = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]
    roughness_to   = [0.10, 0.05, 0.04, 0.035, 0.015, 0.02, 0.01, 0.00, 0.08, 0.12, 0.04]
    return lc.remap(roughness_from, roughness_to, defaultValue=0.04).rename(
        "roughness"
    )
