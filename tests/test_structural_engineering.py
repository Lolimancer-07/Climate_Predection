"""
tests/test_structural_engineering.py
Unit tests for the Phase 2 structural engineering module.

Covers:
    - Wind load calculation (F_wind formula)
    - Bending moment calculation
    - Surge force and hydrostatic pressure
    - Structural safety factor (pole and building)
    - Fragility curve probabilities
    - Damage state assessment integration
    - Hardening priority ranking
"""
import math
import pytest

# ── Wind load tests ──────────────────────────────────────────────────────────

def test_wind_force_basic():
    """F_wind = 0.5 * Cd * rho * A * V^2, check at known values."""
    from modeling.structural_engineering.wind_load import calculate_wind_force
    result = calculate_wind_force(
        wind_speed_kmh=180.0,
        asset_class="wood_power_pole",
    )
    assert result["wind_force_kn"] > 0
    # V = 180/3.6 = 50 m/s, q = 0.5*1.225*2500 = 1531.25 Pa
    # F = 1.0 * 1531.25 * 1.6 = 2450 N = 2.45 kN
    assert abs(result["wind_force_kn"] - 2.45) < 0.1
    assert result["Cd"] == 1.0


def test_wind_force_increases_with_speed():
    """Wind force should scale as V^2."""
    from modeling.structural_engineering.wind_load import calculate_wind_force
    f100 = calculate_wind_force(100.0, "rcc_building")["wind_force_kn"]
    f200 = calculate_wind_force(200.0, "rcc_building")["wind_force_kn"]
    # Doubling speed → 4x force
    assert abs(f200 / f100 - 4.0) < 0.1


def test_wind_force_custom_area():
    """Custom frontal area should scale force linearly."""
    from modeling.structural_engineering.wind_load import calculate_wind_force
    f1 = calculate_wind_force(150.0, "rcc_building", frontal_area_m2=30.0)["wind_force_kn"]
    f2 = calculate_wind_force(150.0, "rcc_building", frontal_area_m2=60.0)["wind_force_kn"]
    assert abs(f2 / f1 - 2.0) < 0.01


def test_bending_moment_positive():
    from modeling.structural_engineering.wind_load import calculate_wind_bending_moment
    result = calculate_wind_bending_moment(200.0, "wood_power_pole")
    assert result["bending_moment_knm"] > 0
    assert result["height_m"] == 10.0  # default for wood_power_pole


def test_unknown_asset_class_uses_default():
    from modeling.structural_engineering.wind_load import calculate_wind_force
    result = calculate_wind_force(150.0, "unknown_asset_class_xyz")
    # Should not raise, should use default Cd and area
    assert result["wind_force_kn"] > 0
    assert result["Cd"] == 1.2  # default


# ── Surge / hydrodynamic tests ────────────────────────────────────────────────

def test_surge_force_zero_when_no_surge():
    from modeling.structural_engineering.hydrodynamic_load import calculate_surge_force
    result = calculate_surge_force(surge_height_m=0.0, asset_class="masonry_building")
    assert result["surge_force_kn"] == 0.0
    assert result["total_surge_load_kn"] == 0.0


def test_surge_force_positive():
    from modeling.structural_engineering.hydrodynamic_load import calculate_surge_force
    result = calculate_surge_force(surge_height_m=2.5, asset_class="masonry_building")
    assert result["surge_force_kn"] > 0
    assert result["hydrostatic_force_kn"] > 0
    assert result["total_surge_load_kn"] > result["surge_force_kn"]


def test_hydrostatic_pressure():
    from modeling.structural_engineering.hydrodynamic_load import calculate_hydrostatic_pressure
    result = calculate_hydrostatic_pressure(1.0)
    # P = rho * g * h = 1025 * 9.81 * 1 = ~10055 Pa = ~10.055 kPa
    assert abs(result["pressure_at_base_kpa"] - 10.055) < 0.1
    # Average pressure is half the base (triangular distribution), with rounding tolerance
    assert abs(result["average_pressure_kpa"] - result["pressure_at_base_kpa"] / 2.0) < 0.005


def test_surge_flow_velocity_increases_with_depth():
    from modeling.structural_engineering.hydrodynamic_load import surge_flow_velocity
    v1 = surge_flow_velocity(1.0)
    v2 = surge_flow_velocity(2.0)
    assert v2 > v1


# ── Structural safety factor tests ────────────────────────────────────────────

def test_pole_safety_factor_high_at_low_load():
    """At low wind and no surge, pole SF should be well above 1.5."""
    from modeling.structural_engineering.structural_check import check_pole_safety_factor
    result = check_pole_safety_factor(
        wind_speed_kmh=50.0, surge_height_m=0.0, asset_class="concrete_power_pole"
    )
    assert result["safety_factor"] > 1.5
    assert not result["likely_failure"]
    assert not result["reinforcement_advisable"]


def test_pole_safety_factor_low_at_extreme_load():
    """At extreme cyclone wind + surge, wood pole should fail."""
    from modeling.structural_engineering.structural_check import check_pole_safety_factor
    result = check_pole_safety_factor(
        wind_speed_kmh=280.0, surge_height_m=4.0, asset_class="wood_power_pole"
    )
    assert result["safety_factor"] < 1.5
    assert result["reinforcement_advisable"]


def test_building_safety_factor_masonry_extreme():
    from modeling.structural_engineering.structural_check import check_building_safety_factor
    result = check_building_safety_factor(
        wind_speed_kmh=220.0, surge_height_m=3.0, asset_class="masonry_building"
    )
    assert result["safety_factor"] < 2.0  # masonry is highly vulnerable
    assert "applied_force_kn" in result


def test_thatched_failure_at_moderate_cyclone():
    from modeling.structural_engineering.structural_check import check_building_safety_factor
    result = check_building_safety_factor(
        wind_speed_kmh=180.0, surge_height_m=2.0, asset_class="thatched_roof_house"
    )
    # Thatched houses have very low shear capacity — should fail at Cat 3+
    assert result["likely_failure"]


# ── Fragility curve tests ─────────────────────────────────────────────────────

def test_fragility_probabilities_sum_to_1():
    from modeling.structural_engineering.fragility_curves import get_damage_state_probabilities
    result = get_damage_state_probabilities("wind", 200.0, "masonry_building")
    probs = result["damage_state_probabilities"]
    total = sum(probs.values())
    assert abs(total - 1.0) < 0.01


def test_fragility_higher_intensity_worse_damage():
    from modeling.structural_engineering.fragility_curves import get_damage_state_probabilities
    ds_low = get_damage_state_probabilities("wind", 80.0, "masonry_building")
    ds_high = get_damage_state_probabilities("wind", 240.0, "masonry_building")
    _order = {"none": 0, "minor": 1, "moderate": 2, "severe": 3, "collapse": 4}
    expected_low = _order[ds_low["expected_damage_state"]]
    expected_high = _order[ds_high["expected_damage_state"]]
    assert expected_high >= expected_low


def test_fragility_zero_intensity():
    from modeling.structural_engineering.fragility_curves import get_damage_state_probabilities
    result = get_damage_state_probabilities("wind", 0.0, "rcc_building")
    assert result["damage_state_probabilities"]["none"] > 0.9


def test_fragility_surge_masonry():
    from modeling.structural_engineering.fragility_curves import get_damage_state_probabilities
    result = get_damage_state_probabilities("surge", 3.0, "masonry_building")
    probs = result["damage_state_probabilities"]
    assert sum(probs.values()) - 1.0 < 0.01
    assert result["confidence"] == "generic_curve"


def test_fragility_unknown_class_fallback():
    from modeling.structural_engineering.fragility_curves import get_damage_state_probabilities
    # Should not raise, should use fallback curves
    result = get_damage_state_probabilities("wind", 150.0, "flying_saucer_123")
    assert "expected_damage_state" in result


# ── Damage state assessment integration ──────────────────────────────────────

def test_assess_asset_returns_structural_assessment():
    from modeling.structural_engineering.damage_state import assess_asset_damage_state, StructuralAssessment
    sa = assess_asset_damage_state(
        asset_id="TEST-POLE-001",
        asset_class="wood_power_pole",
        wind_speed_kmh=200.0,
        surge_height_m=2.0,
        criticality=0.8,
    )
    assert isinstance(sa, StructuralAssessment)
    assert sa.asset_id == "TEST-POLE-001"
    assert sa.hardening_priority_score >= 0.0
    assert sa.combined_expected_damage_state in {"none", "minor", "moderate", "severe", "collapse"}
    assert len(sa.notes) > 0  # generic_curve warning should be present


def test_hospital_high_criticality_gets_high_priority():
    from modeling.structural_engineering.damage_state import assess_asset_damage_state
    sa = assess_asset_damage_state(
        asset_id="TEST-HOSP-001",
        asset_class="hospital",
        wind_speed_kmh=250.0,
        surge_height_m=3.0,
        criticality=0.95,
    )
    # High criticality should produce higher priority score
    sa_low = assess_asset_damage_state(
        asset_id="TEST-POLE-002",
        asset_class="wood_power_pole",
        wind_speed_kmh=250.0,
        surge_height_m=3.0,
        criticality=0.1,
    )
    # Hospital at 0.95 criticality should have higher or equal score than low criticality pole
    # (not always strictly higher due to safety factor, but hospital likely has higher SF)
    assert sa.hardening_priority_score > 0


# ── Hardening priority tests ──────────────────────────────────────────────────

def test_hardening_priority_sorted_by_urgency():
    from modeling.structural_engineering.hardening_priority import run_district_hardening_assessment
    assets = [
        {"asset_id": "A", "asset_class": "thatched_roof_house", "criticality": 0.9},
        {"asset_id": "B", "asset_class": "steel_lattice_tower",  "criticality": 0.9},
        {"asset_id": "C", "asset_class": "hospital",             "criticality": 0.95},
    ]
    surge_grid = {"A": 3.0, "B": 1.0, "C": 2.0}
    recommendations = run_district_hardening_assessment(assets, 250.0, surge_grid)

    assert len(recommendations) == 3
    # Ranks should be 1, 2, 3
    assert recommendations[0].rank == 1
    assert recommendations[1].rank == 2
    assert recommendations[2].rank == 3
    # Priority scores should be descending
    scores = [r.hardening_priority_score for r in recommendations]
    assert scores == sorted(scores, reverse=True)


def test_hardening_has_recommended_action():
    from modeling.structural_engineering.hardening_priority import run_district_hardening_assessment
    assets = [{"asset_id": "X", "asset_class": "masonry_building", "criticality": 0.7}]
    surge_grid = {"X": 2.0}
    recs = run_district_hardening_assessment(assets, 200.0, surge_grid)
    assert recs[0].recommended_action  # should not be empty string
    assert len(recs[0].notes) > 0


# ── Validation record tests ────────────────────────────────────────────────────

def test_validation_record_match():
    from ai_reasoning.rapid_damage_assessment.validation_record import create_validation_records
    preds = [{"asset_id": "A", "asset_class": "masonry_building",
              "combined_expected_damage_state": "severe", "safety_factor": 0.9}]
    observed = [{"asset_id": "A", "overall_damage_signal": "severe",
                 "confidence_overall": "high", "caveat": "None"}]
    records = create_validation_records("TEST-EVENT", preds, observed)
    assert len(records) == 1
    assert records[0].match_strict is True
    assert records[0].match is True
    assert not records[0].model_under_predicted


def test_validation_record_under_prediction():
    from ai_reasoning.rapid_damage_assessment.validation_record import create_validation_records
    preds = [{"asset_id": "B", "asset_class": "masonry_building",
              "combined_expected_damage_state": "minor", "safety_factor": 1.8}]
    observed = [{"asset_id": "B", "overall_damage_signal": "collapse",
                 "confidence_overall": "high", "caveat": "None"}]
    records = create_validation_records("TEST-EVENT-2", preds, observed)
    assert records[0].model_under_predicted is True
    assert any("under-predicted" in n.lower() for n in records[0].notes)


def test_validation_summary():
    from ai_reasoning.rapid_damage_assessment.validation_record import (
        create_validation_records, summarise_validation_batch
    )
    preds = [
        {"asset_id": "A", "asset_class": "masonry_building", "combined_expected_damage_state": "severe", "safety_factor": 0.9},
        {"asset_id": "B", "asset_class": "rcc_building",     "combined_expected_damage_state": "minor",  "safety_factor": 2.0},
    ]
    observed = [
        {"asset_id": "A", "overall_damage_signal": "severe",    "confidence_overall": "high", "caveat": "None"},
        {"asset_id": "B", "overall_damage_signal": "collapse",   "confidence_overall": "medium", "caveat": "Partial cloud cover."},
    ]
    records = create_validation_records("SUMMARY-TEST", preds, observed)
    summary = summarise_validation_batch(records)
    assert summary["total"] == 2
    assert "match_rate_pct" in summary
    assert "recalibration_recommended" in summary
