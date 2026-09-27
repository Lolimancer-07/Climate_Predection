"""
tests/unit/test_surge_model.py
Unit tests for the parametric surge model.
"""
import pytest
from modeling.surge.parametric_surge import (
    SurgeInput, run_surge_model, estimate_surge_height,
    _shelf_amplification, estimate_inundation_radius, fani_demo_surge,
)


def make_input(**kwargs):
    defaults = dict(
        central_pressure_hpa=950,
        radius_max_wind_nm=50,
        forward_speed_kt=12,
        shelf_slope_deg=0.4,
        landfall_lat=19.5,
        landfall_lon=85.9,
        district_id="IN-OD-TEST",
        event_id="TEST-EVENT",
    )
    defaults.update(kwargs)
    return SurgeInput(**defaults)


class TestSurgeHeight:
    def test_positive_surge(self):
        h = estimate_surge_height(make_input())
        assert h > 0

    def test_deeper_pressure_deficit_increases_surge(self):
        h_low = estimate_surge_height(make_input(central_pressure_hpa=980))
        h_high = estimate_surge_height(make_input(central_pressure_hpa=920))
        assert h_high > h_low

    def test_larger_rmw_increases_surge(self):
        h_small = estimate_surge_height(make_input(radius_max_wind_nm=30))
        h_large = estimate_surge_height(make_input(radius_max_wind_nm=80))
        assert h_large > h_small

    def test_surge_non_negative(self):
        # Very weak storm should still produce non-negative surge
        h = estimate_surge_height(make_input(
            central_pressure_hpa=1012,
            radius_max_wind_nm=10,
            forward_speed_kt=2,
        ))
        assert h >= 0.0


class TestShelfAmplification:
    def test_gentle_slope_amplifies_more(self):
        saf_flat = _shelf_amplification(0.1)
        saf_steep = _shelf_amplification(1.5)
        assert saf_flat > saf_steep

    def test_amplification_bounded(self):
        assert _shelf_amplification(0.0) <= 2.5
        assert _shelf_amplification(10.0) >= 1.0


class TestInundationRadius:
    def test_higher_surge_larger_radius(self):
        r_small = estimate_inundation_radius(0.5, 0.5)
        r_large = estimate_inundation_radius(3.0, 0.5)
        assert r_large > r_small

    def test_flat_terrain_larger_radius(self):
        r_steep = estimate_inundation_radius(2.0, 1.5)
        r_flat = estimate_inundation_radius(2.0, 0.1)
        assert r_flat > r_steep


class TestFullPipeline:
    def test_fani_demo_runs(self):
        result = fani_demo_surge()
        assert result.surge_height_m > 0
        assert result.inundation_radius_km > 0
        assert result.inundation_geojson["geometry"]["type"] == "Polygon"
        assert result.model_version.startswith("parametric-surge")

    def test_fani_surge_plausible(self):
        """
        Fani produced ~3.4m surge at Puri in reality.
        Our parametric proxy is a screening-speed model; it underestimates
        because it lacks shelf bathymetry correction.
        We accept a wider range (0.5–5.0m) for the hackathon proxy.
        """
        result = fani_demo_surge()
        assert 0.5 <= result.surge_height_m <= 5.0, (
            f"Fani surge height {result.surge_height_m}m outside expected range 0.5–5.0m"
        )

    def test_result_has_geojson_polygon(self):
        result = fani_demo_surge()
        coords = result.inundation_geojson["geometry"]["coordinates"][0]
        # Ring should be closed
        assert coords[0] == coords[-1]
        assert len(coords) >= 4
