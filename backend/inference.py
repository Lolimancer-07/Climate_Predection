"""
backend/inference.py

This is the main digital twin engine — connecting all intelligence modules,
processing incoming meteorological & coastal sensor packets, and pushing real-time
state payloads out to the GCS dashboard via WebSocket.

Pipeline stages (in order they run per telemetry packet):
  1.  Sensor ingestion     — Multi-channel coastal AWS & oceanographic telemetry
  2.  Telemetry integrity  — Packet loss, jitter, replays, sequence validation
  3.  Physics engine       — Inverted barometer, bathymetric shelf setup, Holland winds
  4.  Sensor integrity     — Gauge stuck readings, out-of-bounds, physics residuals
  5.  Anomaly detector     — Multivariate envelope + 10 domain hazard rules with hysteresis
  6.  Health index         — Weighted composite district integrity (EWMA smoothed)
  7.  Twin consistency     — Cross-validate AI hazard vs Hydrodynamic physics (Cases A–D)
  8.  XAI engine           — Attribute top risk driver (pressure deficit, shelf slope, etc.)
  9.  Mission risk         — Evacuation feasibility probability & safe transit window
  10. What-If cache        — Counterfactual scenario results triggered by GCS command
  11. Optimizer            — Optimal evacuation bus dispatch frequency & fuel allocation
  12. Prescriptive         — Actionable pre-landfall directives for civil defense & grid
  13. Maintenance advisor  — SOP-compliant infrastructure hardening work orders
  14. AI Engineer          — Answers natural-language operator questions (ML intent clf)
  15. Fleet manager        — Tracks all 5 coastal districts simultaneously
  16. Federated learning   — Local edge gradient accumulation & FedAvg coordination
  17. Edge profile         — State EOC (Float32) vs District Mobile Unit (INT8)
  18. Demo controller      — 9-step scripted pre-landfall demo sequencer
  19. Mission command      — Evacuation recovery corridors, shelter staging, audit timeline
  20. WebSocket server     — Real-time streaming link at ws://127.0.0.1:8765
"""

import os
import sys
import json
import asyncio
from threading import Thread
from collections import deque
from typing import Dict, Any

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import numpy as np

# Core digital twin intelligence modules
from physics_engine        import physics_model
from anomaly_detector      import AnomalyDetector
from health_index          import compute_health_index, reset_health_state
from xai_engine            import XAIDiagnosticEngine
from maintenance_advisor   import AutonomousMaintenanceAdvisor
from sensor_integrity      import sensor_integrity_monitor
from twin_consistency      import compute_twin_consistency
from mission_risk          import compute_mission_risk, compute_failure_probability
from whatif_engine         import simulate_whatif
from optimizer             import find_optimal_operating_point
from prescriptive          import generate_prescriptive_recommendations
from ai_engineer           import answer as ai_engineer_answer
from fleet_manager         import fleet_manager
from federated_coordinator import federated_coordinator
from edge_profile          import edge_profile_manager
from telemetry_integrity   import telemetry_integrity_monitor
from demo_controller       import demo_controller
from mission_command       import (
    MissionCommandController,
    build_mission_command_state,
    build_recovery_plan,
    build_simulation_summary,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTROL_FILE = os.path.join(ROOT, 'simulator', 'current_profile.json')

is_simulation_paused = False
anomaly_detector = AnomalyDetector()
mission_command_controller = MissionCommandController()

latest_state: Dict[str, Any] = {}
latest_payload = json.dumps({"status": "INITIALIZING", "message": "Cyclone Digital Twin Core starting up..."})

WS_HOST = os.environ.get("UAV_TWIN_WS_HOST", "127.0.0.1")
WS_PORT = int(os.environ.get("UAV_TWIN_WS_PORT", "8765"))
WS_AUTH_TOKEN = os.environ.get("UAV_TWIN_AUTH_TOKEN", "").strip()


def generate_baseline_telemetry(cycle: int, mode: str = "NORMAL", injected_faults: list = None) -> dict:
    """Generates synthetic meteorological packet for digital twin testing/streaming."""
    injected_faults = injected_faults or []
    lead_time_h = max(1.0, 48.0 - (cycle % 96) * 0.5)

    # Base parameters
    pressure = 932.0 if "RAPID_INTENSIFICATION" in injected_faults or mode == "EXTREME" else 975.0
    wind = 215.0 if "RAPID_INTENSIFICATION" in injected_faults or mode == "EXTREME" else 135.0
    surge = 4.2 if "RAPID_INTENSIFICATION" in injected_faults or mode == "EXTREME" else 1.8
    rain = 38.0 if "FLASH_FLOOD_EMERGENCY" in injected_faults else 12.0

    return {
        "cycle": cycle,
        "district_id": fleet_manager.active_district_id,
        "storm_name": "FANI-2019",
        "lead_time_h": lead_time_h,
        "central_pressure_hpa": pressure,
        "max_wind_kmh": wind,
        "surge_height_m": surge,
        "rainfall_rate_mmh": rain,
        "forward_speed_kmh": 18.0,
        "tide_height_m": 0.8,
        "grid_voltage_kv": 27.5 if "GRID_VOLTAGE_SAG" in injected_faults else 33.0,
        "route_flood_depth_m": 0.55 if "EVAC_ROUTE_INUNDATION" in injected_faults else 0.05,
        "shelter_occupancy_pct": 55.0,
        "population_at_risk": 240000,
        "latitude": 19.813,
        "longitude": 85.831,
        "heading_deg": 340.0,
        "ground_speed_kts": 32.0,
        "mission_progress_pct": round((cycle % 100) * 1.0, 1),
        "active_faults": injected_faults,
    }


def process_telemetry_packet(data: dict):
    global latest_payload, latest_state

    # 1. Telemetry stream integrity
    tel_integrity = telemetry_integrity_monitor.evaluate(data)

    # 2. Hydrodynamic surge physics & residuals
    physics_results = physics_model.evaluate_performance(data)

    # 3. Sensor integrity
    sensor_integrity = sensor_integrity_monitor.evaluate(
        data, physics_residuals=physics_results.get("residuals", {})
    )

    # 4. Anomaly detection with hysteresis
    is_anomaly, anomaly_score, fault_events = anomaly_detector.predict(data)
    fault_names = [f["name"] for f in fault_events]

    # 5. District infrastructure integrity index
    lead_time_h = float(data.get("lead_time_h", 48.0))
    health_results = compute_health_index(data, lead_time_h, anomaly_score, fault_names)
    health_index = health_results["health_index"]

    # 6. Failure probability
    failure_probability = compute_failure_probability(
        lead_time_h, is_anomaly, anomaly_score, len(fault_events), health_index
    )

    # 7. Twin consistency
    twin_consistency = compute_twin_consistency(
        is_anomaly=is_anomaly,
        anomaly_score=anomaly_score,
        physics_residuals=physics_results.get("residuals", {}),
        sensor_integrity_score=sensor_integrity["integrity_score"],
    )

    # 8. XAI attribution
    xai_results = XAIDiagnosticEngine.explain_anomaly(
        telemetry=data,
        is_anomaly=is_anomaly,
        anomaly_score=anomaly_score,
        active_faults=fault_events
    )

    # 9. Evacuation feasibility / Mission risk
    mission_risk = compute_mission_risk(
        data=data,
        health_index=health_index,
        lead_time_h=lead_time_h,
        failure_probability=failure_probability,
        fault_events=fault_events,
    )

    # 10. Prescriptive action recommendations
    prescriptive = generate_prescriptive_recommendations(
        fault_events=fault_events,
        lead_time_h=lead_time_h,
        health_index=health_index,
        twin_consistency=twin_consistency,
        mission_risk=mission_risk,
    )

    # 11. SOP-compliant hardening advisories
    advisories = AutonomousMaintenanceAdvisor.generate_advisories(
        telemetry=data,
        fault_events=fault_events,
        lead_time_h=lead_time_h,
        health_index=health_index
    )

    has_critical = any(f["severity"] == "CRITICAL" for f in fault_events)
    has_warning  = any(f["severity"] == "WARNING"  for f in fault_events)
    alert_status = "CRITICAL" if has_critical else ("WARNING" if (has_warning or is_anomaly) else "NOMINAL")

    active_district = data.get("district_id", fleet_manager.active_district_id)

    payload = {
        # Raw / Ingested storm metrics
        "cycle":                  data.get("cycle", 0),
        "district_id":            active_district,
        "uav_id":                 active_district,
        "storm_name":             data.get("storm_name", "FANI-2019"),
        "lead_time_h":            lead_time_h,
        "central_pressure_hpa":   data.get("central_pressure_hpa", 932.0),
        "max_wind_kmh":           data.get("max_wind_kmh", 215.0),
        "surge_height_m":         data.get("surge_height_m", 4.2),
        "rainfall_rate_mmh":      data.get("rainfall_rate_mmh", 28.0),
        "forward_speed_kmh":      data.get("forward_speed_kmh", 18.0),
        "tide_height_m":          data.get("tide_height_m", 0.8),
        "grid_voltage_kv":        data.get("grid_voltage_kv", 33.0),
        "route_flood_depth_m":    data.get("route_flood_depth_m", 0.0),
        "population_at_risk":     data.get("population_at_risk", 240000),

        # Compatibility aliases for UAV console components
        "rpm":                    round(data.get("max_wind_kmh", 215.0) * 10, 1),
        "cht":                    round(data.get("central_pressure_hpa", 932.0) * 0.42, 1),
        "egt":                    round(data.get("surge_height_m", 4.2) * 360, 1),
        "oil_pressure":           round(data.get("grid_voltage_kv", 33.0) * 1.7, 1),
        "predicted_rul":          round(lead_time_h, 1),
        "rul_ci_lower":           round(max(0.0, lead_time_h - 4.5), 1),
        "rul_ci_upper":           round(lead_time_h + 4.5, 1),

        # Anomaly & Hazard status
        "is_anomaly":             bool(is_anomaly),
        "anomaly_score":          round(anomaly_score, 4),
        "fault_events":           fault_events,
        "active_faults":          data.get("active_faults", []),
        "alert":                  alert_status,
        "paused":                 is_simulation_paused,
        "failure_probability":    round(failure_probability, 3),

        # Core subsystem models
        "physics":                physics_results,
        "health":                 health_results,
        "xai":                    xai_results,
        "advisories":             advisories,
        "sensor_integrity":       sensor_integrity,
        "twin_consistency":       twin_consistency,
        "mission_risk":           mission_risk,
        "prescriptive":           prescriptive,
        "telemetry_integrity":    tel_integrity,
        "fleet_status":           fleet_manager.get_fleet_status(),
        "demo_state":             demo_controller.get_state(),

        # Dynamic simulation caches
        "whatif_result":          latest_state.get("whatif_result"),
        "optimize_result":        latest_state.get("optimize_result"),
        "ai_engineer_response":   latest_state.get("ai_engineer_response"),

        # Federated & Edge deployment
        "federated_round":        federated_coordinator.get_status(),
        "edge_profile":           edge_profile_manager.get_active_profile(),
        "security_status": {
            "ws_host":            WS_HOST,
            "ws_port":            WS_PORT,
            "auth_required":      bool(WS_AUTH_TOKEN),
            "is_localhost_only":  WS_HOST in ("127.0.0.1", "localhost"),
            "transport":          "WS_DISASTER_GCS",
            "replay_guard":       "ACTIVE_SEQ_COUNTER",
        },
    }

    fleet_manager.update_uav(active_district, payload)
    federated_coordinator.record_local_observation(active_district, data)

    cycle = data.get("cycle", 0)
    if cycle > 0 and cycle % 30 == 0:
        federated_coordinator.execute_round()
        payload["federated_round"] = federated_coordinator.get_status()

    mission_command_controller.observe(
        cycle=data.get("cycle", 0),
        alert=alert_status,
        mission_risk=mission_risk,
        twin_consistency=twin_consistency,
        fault_events=fault_events,
    )

    latest_state.update(payload)

    latest_state["mission_command"] = build_mission_command_state(
        data=latest_state,
        mission_risk=latest_state.get("mission_risk", {}),
        health=latest_state.get("health", {}),
        twin_consistency=latest_state.get("twin_consistency", {}),
        sensor_integrity=latest_state.get("sensor_integrity", {}),
        telemetry_integrity=latest_state.get("telemetry_integrity", {}),
        fault_events=latest_state.get("fault_events", []),
        fleet_status=latest_state.get("fleet_status", []),
        is_anomaly=bool(latest_state.get("is_anomaly", False)),
        optimize_result=latest_state.get("optimize_result"),
        action_state=latest_state.get("mission_command_action"),
        timeline=mission_command_controller.events(),
    )

    latest_payload = json.dumps(latest_state)


def process_gcs_command(cmd: Dict[str, Any]):
    """Handles operator commands sent from GCS console."""
    global latest_state, latest_payload, is_simulation_paused
    action = cmd.get("command") or cmd.get("action")

    if action == "set_paused":
        is_simulation_paused = bool(cmd.get("paused", False))
        if latest_state:
            latest_state["paused"] = is_simulation_paused

    elif action == "inject_fault":
        fault = cmd.get("fault", "RAPID_INTENSIFICATION")
        if latest_state:
            faults = set(latest_state.get("active_faults", []))
            faults.add(fault)
            latest_state["active_faults"] = list(faults)
            process_telemetry_packet(generate_baseline_telemetry(
                cycle=latest_state.get("cycle", 1) + 1,
                mode="EXTREME",
                injected_faults=list(faults)
            ))

    elif action == "clear_faults":
        anomaly_detector.force_clear()
        if latest_state:
            latest_state["active_faults"] = []
            reset_health_state(95.0)
            process_telemetry_packet(generate_baseline_telemetry(
                cycle=latest_state.get("cycle", 1) + 1,
                mode="NORMAL",
                injected_faults=[]
            ))

    elif action == "whatif":
        params = cmd.get("params", {})
        if latest_state:
            try:
                res = simulate_whatif(
                    current_state=latest_state,
                    overrides=params,
                    current_lead_time=latest_state.get("lead_time_h", 48.0),
                    current_health=latest_state.get("health", {}).get("health_index", 85.0),
                    physics_model=physics_model,
                    health_fn=compute_health_index,
                    anomaly_score=latest_state.get("anomaly_score", 0.0),
                    fault_names=[f["name"] for f in latest_state.get("fault_events", [])],
                )
                latest_state["whatif_result"] = res
            except Exception as e:
                print(f"[WHATIF ERROR] {e}")

    elif action == "optimize":
        constraints = cmd.get("constraints", {})
        if latest_state:
            try:
                res = find_optimal_operating_point(
                    current_state=latest_state,
                    current_lead_time=latest_state.get("lead_time_h", 48.0),
                    current_health=latest_state.get("health", {}).get("health_index", 85.0),
                    failure_probability=latest_state.get("failure_probability", 0.1),
                    constraints=constraints,
                )
                latest_state["optimize_result"] = res
            except Exception as e:
                print(f"[OPTIMIZE ERROR] {e}")

    elif action == "ai_engineer_query":
        q = cmd.get("question", "")
        if q and latest_state:
            try:
                res = ai_engineer_answer(q, latest_state)
                latest_state["ai_engineer_response"] = {
                    "question": q,
                    "answer": res.get("answer", ""),
                    "category": res.get("category", "GENERAL_STATUS"),
                    "confidence": res.get("confidence", 0.5),
                    "follow_ups": res.get("follow_ups", []),
                    "timestamp": latest_state.get("cycle", 0),
                }
            except Exception as e:
                print(f"[AI ENGINEER ERROR] {e}")

    elif action == "select_uav":
        did = cmd.get("uav_id") or cmd.get("district_id", "IN-OD-PURI")
        fleet_manager.select_uav(did)
        if latest_state:
            latest_state["district_id"] = did
            latest_state["uav_id"] = did
            latest_state["fleet_status"] = fleet_manager.get_fleet_status()

    elif action == "demo_start":
        demo_controller.start()
        if latest_state:
            latest_state["demo_state"] = demo_controller.get_state()

    elif action == "demo_step":
        step = cmd.get("step")
        demo_controller.advance(step)
        if latest_state:
            latest_state["demo_state"] = demo_controller.get_state()

    elif action == "demo_stop":
        demo_controller.stop()
        if latest_state:
            latest_state["demo_state"] = demo_controller.get_state()

    elif action == "trigger_federated_round":
        round_res = federated_coordinator.execute_round(cmd.get("participating_uavs"))
        if latest_state:
            latest_state["federated_round"] = federated_coordinator.get_status()

    elif action == "set_edge_mode":
        prof = edge_profile_manager.set_mode(cmd.get("mode", "GCS_FLOAT32"))
        if latest_state:
            latest_state["edge_profile"] = prof

    if latest_state:
        latest_payload = json.dumps(latest_state)


async def telemetry_loop():
    """Generates 10 Hz continuous digital twin stream."""
    cycle = 1
    while True:
        if not is_simulation_paused:
            packet = generate_baseline_telemetry(
                cycle=cycle,
                mode=latest_state.get("mission_mode", "NORMAL"),
                injected_faults=latest_state.get("active_faults", [])
            )
            process_telemetry_packet(packet)
            cycle += 1
        await asyncio.sleep(0.1)


async def ws_server_handler(websocket):
    async def sender():
        while True:
            try:
                await websocket.send(latest_payload)
            except Exception:
                break
            await asyncio.sleep(0.1)

    async def receiver():
        try:
            async for raw in websocket:
                try:
                    cmd = json.loads(raw)
                    process_gcs_command(cmd)
                except Exception as e:
                    print(f"[WS RECEIVE ERROR] {e}")
        except Exception:
            pass

    await asyncio.gather(sender(), receiver())


async def run_server():
    import websockets
    server = await websockets.serve(ws_server_handler, WS_HOST, WS_PORT)
    print(f"[WS] Cyclone Digital Twin WebSocket Active -> ws://{WS_HOST}:{WS_PORT}")
    await asyncio.gather(server.wait_closed(), telemetry_loop())


if __name__ == "__main__":
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        print("[WS] Shutting down digital twin core.")
