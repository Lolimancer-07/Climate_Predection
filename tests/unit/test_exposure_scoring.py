"""
tests/unit/test_exposure_scoring.py
Unit tests for the infrastructure exposure scoring engine.
"""
import pytest
from modeling.exposure_scoring.asset_overlay import compute_exposure, score_all_assets


# ── Fixtures ─────────────────────────────────────────────────────────────────

SURGE_POLYGON = {
    "type": "Feature",
    "properties": {"hazard_type": "surge", "severity_class": "High", "surge_height_m": 2.4},
    "geometry": {
        "type": "Polygon",
        "coordinates": [[
            [85.79, 19.76], [85.89, 19.76], [85.89, 19.82], [85.79, 19.82], [85.79, 19.76]
        ]]
    }
}

ASSET_INSIDE = {
    "asset_id": "SHELTER-INSIDE",
    "asset_type": "shelter",
    "name": "Shelter Inside Hazard Zone",
    "criticality": 0.95,
    "geometry": {"type": "Point", "coordinates": [85.84, 19.79]},
    "event_id": "TEST",
}

ASSET_OUTSIDE = {
    "asset_id": "SHELTER-OUTSIDE",
    "asset_type": "shelter",
    "name": "Shelter Outside Hazard Zone",
    "criticality": 0.95,
    "geometry": {"type": "Point", "coordinates": [85.75, 19.65]},
    "event_id": "TEST",
}

ROAD_PARTIAL = {
    "asset_id": "ROAD-CROSSING",
    "asset_type": "road",
    "name": "Road crossing hazard boundary",
    "criticality": 0.80,
    "geometry": {
        "type": "LineString",
        "coordinates": [[85.78, 19.77], [85.85, 19.78], [85.92, 19.79]],
    },
    "event_id": "TEST",
}


class TestPointExposure:
    def test_point_inside_polygon_fully_exposed(self):
        score = compute_exposure(ASSET_INSIDE, [SURGE_POLYGON])
        assert score.exposure_score == 1.0

    def test_point_outside_polygon_zero_exposure(self):
        score = compute_exposure(ASSET_OUTSIDE, [SURGE_POLYGON])
        assert score.exposure_score == 0.0

    def test_point_inside_flagged(self):
        score = compute_exposure(ASSET_INSIDE, [SURGE_POLYGON])
        assert score.flagged is True
        assert "CRITICAL" in score.flag_reason

    def test_point_outside_not_flagged(self):
        score = compute_exposure(ASSET_OUTSIDE, [SURGE_POLYGON])
        assert score.flagged is False


class TestLineExposure:
    def test_partial_road_exposure_between_0_and_1(self):
        score = compute_exposure(ROAD_PARTIAL, [SURGE_POLYGON])
        assert 0.0 < score.exposure_score < 1.0

    def test_road_flagged_when_partially_exposed(self):
        score = compute_exposure(ROAD_PARTIAL, [SURGE_POLYGON])
        if score.exposure_score > 0.3 / 0.80:
            assert score.flagged is True


class TestPriorityScore:
    def test_priority_is_exposure_times_criticality(self):
        score = compute_exposure(ASSET_INSIDE, [SURGE_POLYGON])
        expected = round(score.exposure_score * ASSET_INSIDE["criticality"], 3)
        assert abs(score.priority_score - expected) < 0.01

    def test_no_hazard_zero_priority(self):
        score = compute_exposure(ASSET_INSIDE, [])
        assert score.priority_score == 0.0


class TestBatchScoring:
    def test_sorts_by_priority_descending(self):
        assets = [ASSET_OUTSIDE, ASSET_INSIDE, ROAD_PARTIAL]
        scores = score_all_assets(assets, [SURGE_POLYGON], "TEST")
        priorities = [s.priority_score for s in scores]
        assert priorities == sorted(priorities, reverse=True)
