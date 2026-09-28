"""
tests/unit/test_cyclone_digital_twin_modules.py

Comprehensive unit tests for the Cyclone Digital Twin core backend modules:
  - anomaly_detector & FaultHysteresisFilter
  - physics_engine (hydrodynamic surge & wind setup)
  - health_index (district vulnerability & EWMA smoothing)
  - mission_risk (evacuation feasibility probability)
  - maintenance_advisor (SOP hardening work orders)
  - demo_controller (9-step scripted demo sequencer)
  - drift_detector (telemetry distribution shift)
  - edge_profile (State EOC vs District Mobile Edge)
  - fleet_manager (coastal district manager)
  - federated_coordinator (FedAvg multi-district aggregation)
  - sensor_integrity (AWS & tide gauge trust scores)
  - telemetry_integrity (sequence & jitter monitoring)
  - twin_consistency (Cases A-D)
  - whatif_engine (counterfactual simulation)
  - optimizer (evacuation dispatch rate optimization)
  - xai_engine (hazard root cause attribution)
  - ai_engineer (plain English grounded Q&A)
"""

import pytest
import numpy as np

from backend.anomaly_detector import AnomalyDetector, FaultHysteresisFilter
from backend.physics_engine import physics_model
from backend.health_index import compute_health_index, reset_health_state
from backend.mission_risk import compute_mission_risk, compute_failure_probability
from backend.maintenance_advisor import AutonomousMaintenanceAdvisor
from backend.demo_controller import demo_controller
from backend.drift_detector import TelemetryDriftDetector
from backend.edge_profile import edge_profile_manager
from backend.fleet_manager import fleet_manager
from backend.federated_coordinator import federated_coordinator, federated_average
from backend.sensor_integrity import sensor_integrity_monitor
from backend.telemetry_integrity import telemetry_integrity_monitor
from backend.twin_consistency import compute_twin_consistency
from backend.whatif_engine import simulate_whatif
from backend.optimizer import find_optimal_operating_point
from backend.xai_engine import XAIDiagnosticEngine
from backend.ai_engineer import answer as ai_engineer_answer


def test_hysteresis_filter_debouncing():
    filt = FaultHysteresisFilter(trigger_threshold=3, clear_threshold=5)
    raw = [{"name": "BAROMETRIC_ANOMALY", "severity": "CRITICAL"}]

    # Sample 1: not latched yet (requires 2 for critical or 3 for standard)
    res1 = filt.filter_faults(raw)
    assert len(res1) == 0

    # Sample 2: critical trips on sample 2
    res2 = filt.filter_faults(raw)
    assert len(res2) == 1
    assert res2[0]["name"] == "BAROMETRIC_ANOMALY"

    # Force clear
    filt.force_clear_all()
    assert len(filt.latched_faults) == 0


def test_anomaly_detector_rules():
    ad = AnomalyDetector(enable_hysteresis=False)
    # Severe Category 4 parameters
    packet = {
        "central_pressure_hpa": 928.0,
        "max_wind_kmh": 220.0,
        "surge_height_m": 4.5,
        "rainfall_rate_mmh": 35.0,
        "forward_speed_kmh": 18.0,
        "tide_height_m": 1.2,
    }
    is_anomaly, score, faults = ad.predict(packet)
    assert is_anomaly is True
    assert score < 0.0
    fault_names = [f["name"] for f in faults]
    assert "BAROMETRIC_ANOMALY" in fault_names
    assert "EXTREME_SURGE_RISK" in fault_names


def test_physics_engine_hydrodynamics():
    packet = {
        "central_pressure_hpa": 932.0,
        "max_wind_kmh": 215.0,
        "surge_height_m": 4.2,
        "rainfall_rate_mmh": 28.0,
        "tide_height_m": 0.8,
    }
    res = physics_model.evaluate_performance(packet)
    assert res["model_surge_m"] > 2.0
    assert res["surge_ib_m"] > 0.7  # Inverted barometer rise
    assert res["total_water_level_m"] > res["model_surge_m"]
    assert "delta_surge_m" in res["residuals"]


def test_health_index_composite_and_smoothing():
    reset_health_state(95.0)
    packet = {
        "surge_height_m": 4.2,
        "tide_height_m": 0.8,
        "max_wind_kmh": 215.0,
        "rainfall_rate_mmh": 30.0,
        "route_flood_depth_m": 0.6,
        "grid_voltage_kv": 27.0,
    }
    res = compute_health_index(packet, lead_time_h=24.0, anomaly_score=-0.2, fault_names=["EXTREME_SURGE_RISK"])
    assert res["health_index"] < 95.0
    assert "coastal_defense" in res["sub_scores"]
    assert "drainage" in res["sub_scores"]
    assert res["condition"] in ["DEGRADED", "POOR", "CRITICAL", "NOMINAL"]


def test_mission_risk_feasibility():
    packet = {
        "surge_height_m": 3.8,
        "max_wind_kmh": 190.0,
        "route_flood_depth_m": 0.45,
        "shelter_occupancy_pct": 80.0,
    }
    risk = compute_mission_risk(packet, health_index=65.0, lead_time_h=24.0, failure_probability=0.25)
    assert 0.0 <= risk["mission_completion_probability"] <= 100.0
    assert risk["risk_level"] in ["LOW", "MODERATE", "HIGH", "CRITICAL"]
    assert risk["safe_operating_time_h"] >= 0.0


def test_maintenance_advisor_work_orders():
    faults = [{"name": "COASTAL_DIKE_OVERTOPPING", "severity": "CRITICAL"}]
    advisories = AutonomousMaintenanceAdvisor.generate_advisories(
        telemetry={}, fault_events=faults, lead_time_h=18.0, health_index=60.0
    )
    assert len(advisories) > 0
    top = advisories[0]
    assert top["priority"] == "CRITICAL"
    assert "steps" in top


def test_demo_controller_sequencer():
    demo_controller.start()
    st1 = demo_controller.get_state()
    assert st1["active"] is True
    assert st1["step"] == 1

    st2 = demo_controller.advance(2)
    assert st2["step"] == 2
    assert "INTENSIFICATION" in st2["name"]

    demo_controller.stop()
    st_stop = demo_controller.get_state()
    assert st_stop["active"] is False


def test_drift_detector():
    dd = TelemetryDriftDetector(window_size=30)
    for i in range(15):
        dd.ingest_sample({"central_pressure_hpa": 930.0 + (i % 2), "max_wind_kmh": 210.0})
    res = dd.ingest_sample({"central_pressure_hpa": 925.0, "max_wind_kmh": 225.0})
    assert res["samples_accumulated"] >= 15
    assert "channel_drift" in res


def test_edge_profile_manager():
    prof_gcs = edge_profile_manager.set_mode("GCS_FLOAT32")
    assert prof_gcs["mode_id"] == "GCS_FLOAT32"

    prof_edge = edge_profile_manager.set_mode("EDGE_INT8")
    assert prof_edge["mode_id"] == "EDGE_INT8"
    assert prof_edge["quantization_active"] is True

    # Quantization test
    feats = np.array([0.15, -0.42, 0.88])
    q_feats = edge_profile_manager.apply_quantization(feats)
    assert q_feats.shape == feats.shape
    # Revert to GCS
    edge_profile_manager.set_mode("GCS_FLOAT32")


def test_fleet_manager_districts():
    status = fleet_manager.get_fleet_status()
    assert len(status) == 5
    assert any(d["district_id"] == "IN-OD-PURI" for d in status)
    assert fleet_manager.select_uav("IN-OD-JAG") is True
    assert fleet_manager.active_district_id == "IN-OD-JAG"
    fleet_manager.select_uav("IN-OD-PURI")


def test_federated_coordinator():
    deltas = {
        "IN-OD-PURI": np.array([0.1, -0.2, 0.3]),
        "IN-OD-JAG":  np.array([0.2, -0.1, 0.4]),
    }
    weights = {"IN-OD-PURI": 20, "IN-OD-JAG": 30}
    agg = federated_average(deltas, weights)
    assert agg.shape == (3,)

    res = federated_coordinator.execute_round(["IN-OD-PURI", "IN-OD-JAG"])
    assert res["round"] > 0
    assert "global_weights" in res


def test_sensor_and_telemetry_integrity():
    sensor_res = sensor_integrity_monitor.evaluate({
        "central_pressure_hpa": 932.0,
        "max_wind_kmh": 215.0,
        "surge_height_m": 4.2,
    })
    assert sensor_res["integrity_score"] > 50.0

    tel_res = telemetry_integrity_monitor.evaluate({"cycle": 1})
    assert tel_res["integrity_score"] == 100.0


def test_twin_consistency_cases():
    res_a = compute_twin_consistency(
        is_anomaly=True,
        anomaly_score=-0.3,
        physics_residuals={"delta_surge_m": 0.85, "delta_wind_kmh": 25.0},
    )
    assert res_a["case"] == "A"
    assert res_a["case_label"] == "CONFIRMED_SEVERE_HAZARD"

    res_d = compute_twin_consistency(
        is_anomaly=False,
        anomaly_score=0.15,
        physics_residuals={"delta_surge_m": 0.05, "delta_wind_kmh": 2.0},
    )
    assert res_d["case"] == "D"
    assert res_d["case_label"] == "NOMINAL_ANTICIPATORY_STATE"


def test_whatif_engine_simulation():
    current = {
        "central_pressure_hpa": 950.0,
        "max_wind_kmh": 160.0,
        "surge_height_m": 2.5,
        "tide_height_m": 0.8,
        "rainfall_rate_mmh": 15.0,
    }
    overrides = {"central_pressure_hpa": 930.0, "max_wind_kmh": 215.0}
    res = simulate_whatif(
        current_state=current,
        overrides=overrides,
        current_lead_time=36.0,
        current_health=80.0,
        physics_model=physics_model,
        health_fn=compute_health_index,
    )
    assert res["status"] == "COMPLETED"
    assert res["counterfactual"]["central_pressure_hpa"] == 930.0
    assert "delta" in res


def test_optimizer():
    state = {
        "population_at_risk": 180000,
        "surge_height_m": 2.8,
        "max_wind_kmh": 160.0,
        "mission_probability": 58.0,
    }
    res = find_optimal_operating_point(state, current_lead_time=36.0)
    assert res["status"] == "OPTIMAL_SOLUTION_FOUND"
    assert res["optimal_dispatch_rate_bph"] > 0
    assert res["optimized_completion_probability"] >= res["baseline_completion_probability"]


def test_xai_attribution():
    telemetry = {
        "central_pressure_hpa": 932.0,
        "max_wind_kmh": 215.0,
        "surge_height_m": 4.2,
        "rainfall_rate_mmh": 28.0,
    }
    xai = XAIDiagnosticEngine.explain_anomaly(telemetry, is_anomaly=True, anomaly_score=-0.25)
    assert xai["is_anomaly"] is True
    assert len(xai["attributions"]) > 0
    assert xai["top_driver"] != ""


def test_ai_engineer_answering():
    state = {
        "storm_name": "FANI-2019",
        "surge_height_m": 4.2,
        "central_pressure_hpa": 932.0,
        "max_wind_kmh": 215.0,
        "lead_time_h": 48.0,
        "health": {"health_index": 72.0, "condition": "DEGRADED", "sub_scores": {}},
        "mission_risk": {"mission_completion_probability": 85.0},
    }
    ans = ai_engineer_answer("What is the peak surge height?", state)
    assert ans["category"] == "SURGE_RISK"
    assert "4.2" in ans["answer"]
    assert len(ans["follow_ups"]) > 0
