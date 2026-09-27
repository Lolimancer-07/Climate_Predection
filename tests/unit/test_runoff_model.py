"""
tests/unit/test_runoff_model.py
Unit tests for the rainfall-runoff flash flood model.
"""
import pytest
from modeling.rainfall_runoff.flash_flood_model import (
    RunoffInput, run_runoff_model, compute_runoff_risk,
    classify_severity, fani_ward7_runoff,
)


def make_input(**kwargs):
    defaults = dict(
        ward_id="TEST-WARD",
        event_id="TEST-EVENT",
        rainfall_mm_24h=100.0,
        rainfall_mm_48h=180.0,
        avg_twi=10.0,
        land_cover_permeability=0.5,
        district_id="TEST-DISTRICT",
    )
    defaults.update(kwargs)
    return RunoffInput(**defaults)


class TestRunoffRisk:
    def test_score_bounded_0_1(self):
        for rf in [0, 50, 200, 400, 600]:
            inp = make_input(rainfall_mm_48h=rf)
            score = compute_runoff_risk(inp)
            assert 0.0 <= score <= 1.0

    def test_higher_rainfall_higher_score(self):
        s_low = compute_runoff_risk(make_input(rainfall_mm_48h=50))
        s_high = compute_runoff_risk(make_input(rainfall_mm_48h=350))
        assert s_high > s_low

    def test_higher_twi_higher_score(self):
        s_low = compute_runoff_risk(make_input(avg_twi=4))
        s_high = compute_runoff_risk(make_input(avg_twi=18))
        assert s_high > s_low

    def test_impervious_surface_increases_risk(self):
        s_permeable = compute_runoff_risk(make_input(land_cover_permeability=0.05))
        s_impervious = compute_runoff_risk(make_input(land_cover_permeability=0.95))
        assert s_impervious > s_permeable


class TestSeverityClassification:
    def test_low_class(self):
        assert classify_severity(0.1) == "Low"

    def test_medium_class(self):
        assert classify_severity(0.35) == "Medium"

    def test_high_class(self):
        assert classify_severity(0.60) == "High"

    def test_severe_class(self):
        assert classify_severity(0.85) == "Severe"


class TestFaniDemo:
    def test_fani_ward7_is_high_or_severe(self):
        result = fani_ward7_runoff()
        assert result.severity_class in ("High", "Severe"), (
            f"Fani Ward 7 should be High or Severe, got {result.severity_class}"
        )

    def test_result_has_contributing_factors(self):
        result = fani_ward7_runoff()
        assert "rainfall_mm_48h" in result.contributing_factors
        assert result.contributing_factors["rainfall_mm_48h"] == 280.0
