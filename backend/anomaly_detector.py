"""
backend/anomaly_detector.py

Multi-Layer Cyclone Meteorological & Sensor Anomaly Detection with Temporal Debouncing (Hysteresis).

Layer 1 — Multivariate Operational Normalcy Envelope.
  Evaluates multi-channel meteorological & hydrodynamic telemetry:
  [central_pressure_hpa, max_wind_kmh, surge_height_m, rainfall_rate_mmh, forward_speed_kmh, tide_height_m].
  Produces a continuous anomaly score: negative indicates anomalous outlier region.

Layer 2 — Deterministic Disaster Domain Rule Classifiers.
  Catches canonical physical cyclone failure modes:
  (BAROMETRIC_ANOMALY, EXTREME_SURGE_RISK, RAPID_INTENSIFICATION, FLASH_FLOOD_EMERGENCY,
   COASTAL_DIKE_OVERTOPPING, AWS_BAROMETER_DRIFT, RAIN_GAUGE_STUCK, ANEMOMETER_SATURATION,
   GRID_VOLTAGE_SAG, EVAC_ROUTE_INUNDATION) parameterized centrally via backend.engine_config.

Hysteresis Filter:
  Debounces discrete sensor spikes (requires N=3 consecutive detections to activate,
  N=5 consecutive clean cycles to deactivate) to prevent alert flicker on the GCS console HUD.
"""

from typing import Tuple, List, Dict, Any
import numpy as np

try:
    from backend.engine_config import get_engine_config
except ImportError:
    try:
        from engine_config import get_engine_config
    except ImportError:
        get_engine_config = lambda: {"fault_thresholds": {
            "pressure_critical_hpa": 940.0, "pressure_warning_hpa": 970.0,
            "wind_critical_kmh": 175.0, "wind_warning_kmh": 120.0,
            "surge_critical_m": 3.5, "surge_warning_m": 2.0,
            "rain_critical_mmh": 45.0, "rain_warning_mmh": 25.0,
            "grid_voltage_min_kv": 28.0, "grid_voltage_low_warn_kv": 30.5,
        }}


class FaultHysteresisFilter:
    """
    Stateful temporal debouncer for disaster hazard rules.
    Prevents single-sample sensor noise spikes from toggling critical GCS alerts.
    """
    def __init__(self, trigger_threshold: int = 3, clear_threshold: int = 5):
        self.trigger_threshold = trigger_threshold
        self.clear_threshold = clear_threshold
        self.active_counts: Dict[str, int] = {}
        self.clear_counts: Dict[str, int] = {}
        self.latched_faults: Dict[str, Dict[str, Any]] = {}

    def filter_faults(self, raw_faults: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        raw_map = {f["name"]: f for f in raw_faults}
        all_fault_names = set(self.active_counts.keys()) | set(raw_map.keys()) | set(self.latched_faults.keys())

        result = []
        for name in all_fault_names:
            if name in raw_map:
                fault_info = raw_map[name]
                self.active_counts[name] = self.active_counts.get(name, 0) + 1
                self.clear_counts[name] = 0

                # Immediate trip for high-severity emergency redlines
                is_immediate = fault_info.get("severity") == "CRITICAL" and self.active_counts[name] >= 2
                if self.active_counts[name] >= self.trigger_threshold or is_immediate:
                    fault_entry = dict(fault_info)
                    fault_entry["consecutive_samples"] = self.active_counts[name]
                    fault_entry["debounced"] = True
                    self.latched_faults[name] = fault_entry
            else:
                self.clear_counts[name] = self.clear_counts.get(name, 0) + 1
                self.active_counts[name] = 0
                if self.clear_counts[name] >= self.clear_threshold:
                    self.latched_faults.pop(name, None)

        return list(self.latched_faults.values())

    def force_clear_all(self):
        """Immediately evict all latched faults — called when the GCS operator
        issues an explicit CLEAR command. Bypasses the normal clear_threshold
        hysteresis so the dashboard responds instantly."""
        self.active_counts.clear()
        self.clear_counts.clear()
        self.latched_faults.clear()


import os
import pickle

class AnomalyDetector:
    """
    Combines learned multivariate normal envelope with
    centralized domain hazard rules and temporal hysteresis.
    """

    def __init__(self, model_path: str = None, enable_hysteresis: bool = True):
        self.enable_hysteresis = enable_hysteresis
        self.hysteresis_filter = FaultHysteresisFilter(trigger_threshold=3, clear_threshold=5)
        self.features = [
            'central_pressure_hpa',
            'max_wind_kmh',
            'surge_height_m',
            'rainfall_rate_mmh',
            'forward_speed_kmh',
            'tide_height_m'
        ]
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), 'anomaly_model.pkl')
        self.model = None
        if os.path.exists(model_path):
            try:
                with open(model_path, 'rb') as f:
                    bundle = pickle.load(f)
                self.model = bundle.get('model')
                self.features = bundle.get('features', self.features)
            except Exception as e:
                self.model = None

    def force_clear(self):
        """Immediately evict all latched/debounced faults from the hysteresis filter."""
        self.hysteresis_filter.force_clear_all()

    def get_fault_rules(self, th: Dict[str, float]) -> Dict[str, Tuple[callable, str]]:
        """
        Returns rule lambdas and severities for coastal cyclone hazards.
        """
        return {
            "BAROMETRIC_ANOMALY": (
                lambda d: (
                    d.get('central_pressure_hpa', 1010.0) < th.get('pressure_critical_hpa', 940.0) or
                    (d.get('central_pressure_hpa', 1010.0) < th.get('pressure_warning_hpa', 970.0) and
                     d.get('max_wind_kmh', 0) > 130.0)
                ),
                "CRITICAL"
            ),
            "EXTREME_SURGE_RISK": (
                lambda d: (
                    d.get('surge_height_m', 0.0) > th.get('surge_critical_m', 3.5) or
                    (d.get('surge_height_m', 0.0) > 2.5 and d.get('tide_height_m', 1.0) > 1.5)
                ),
                "CRITICAL"
            ),
            "RAPID_INTENSIFICATION": (
                lambda d: (
                    d.get('max_wind_kmh', 0.0) > th.get('wind_critical_kmh', 175.0) or
                    d.get('pressure_deficit_hpa', 0.0) > 70.0 or
                    d.get('rapid_intensification_active', False) is True
                ),
                "CRITICAL"
            ),
            "FLASH_FLOOD_EMERGENCY": (
                lambda d: (
                    d.get('rainfall_rate_mmh', 0.0) > th.get('rain_critical_mmh', 45.0) or
                    (d.get('rainfall_rate_mmh', 0.0) > th.get('rain_warning_mmh', 25.0) and
                     d.get('twi_saturation', 0.5) > 0.85)
                ),
                "CRITICAL"
            ),
            "COASTAL_DIKE_OVERTOPPING": (
                lambda d: (
                    d.get('surge_height_m', 0.0) > 3.8 or
                    d.get('dike_freeboard_m', 2.0) < 0.20 or
                    d.get('dike_breach_active', False) is True
                ),
                "CRITICAL"
            ),
            "AWS_BAROMETER_DRIFT": (
                lambda d: (
                    abs(d.get('barometer_residual_hpa', 0.0)) > 8.0 or
                    (d.get('central_pressure_hpa', 1010.0) > 1025.0 and d.get('max_wind_kmh', 0) > 80.0)
                ),
                "WARNING"
            ),
            "RAIN_GAUGE_STUCK": (
                lambda d: (
                    d.get('rain_gauge_stuck', False) is True or
                    (d.get('rainfall_rate_mmh', 0.0) == 0.0 and d.get('radar_reflectivity_dbz', 0.0) > 45.0)
                ),
                "WARNING"
            ),
            "ANEMOMETER_SATURATION": (
                lambda d: (
                    d.get('max_wind_kmh', 0.0) > 240.0 or
                    d.get('anemometer_clipped', False) is True
                ),
                "WARNING"
            ),
            "GRID_VOLTAGE_SAG": (
                lambda d: (
                    d.get('grid_voltage_kv', 33.0) < th.get('grid_voltage_min_kv', 28.0)
                ),
                "WARNING"
            ),
            "EVAC_ROUTE_INUNDATION": (
                lambda d: (
                    d.get('route_flood_depth_m', 0.0) > 0.50 or
                    d.get('blocked_evac_corridors_count', 0) >= 2
                ),
                "WARNING"
            )
        }

    def predict(self, data: dict, use_hysteresis: bool = None) -> Tuple[bool, float, List[dict]]:
        """
        Runs multivariate envelope and domain rules on current meteorological packet.
        Returns (is_anomaly, anomaly_score, fault_events).
        """
        score = 0.0
        ml_anomaly = False

        if self.model is not None:
            try:
                X = np.array([[float(data.get(f, 0.0)) for f in self.features]])
                score = float(self.model.decision_function(X)[0])
                ml_anomaly = bool(self.model.predict(X)[0] == -1)
            except Exception:
                score = 0.0
                ml_anomaly = False
        else:
            p = float(data.get('central_pressure_hpa', 1008.0))
            w = float(data.get('max_wind_kmh', 45.0))
            s = float(data.get('surge_height_m', 0.5))
            r = float(data.get('rainfall_rate_mmh', 2.0))

            z_p = (1013.25 - p) / 15.0
            z_w = max(0.0, w - 50.0) / 30.0
            z_s = max(0.0, s - 0.6) / 0.8
            z_r = max(0.0, r - 5.0) / 10.0

            combined_dev = 0.35 * z_p + 0.30 * z_w + 0.25 * z_s + 0.10 * z_r
            score = float(round(0.20 - (combined_dev * 0.15), 4))
            ml_anomaly = bool(score < -0.05)

        # Load active thresholds from centralized basin config
        th = get_engine_config().get("fault_thresholds", {})
        rules = self.get_fault_rules(th)

        raw_fault_events = []
        for name, (rule_fn, severity) in rules.items():
            try:
                if rule_fn(data):
                    raw_fault_events.append({
                        "name": name,
                        "severity": severity
                    })
            except Exception:
                continue

        apply_hyst = self.enable_hysteresis if use_hysteresis is None else use_hysteresis
        if apply_hyst:
            fault_events = self.hysteresis_filter.filter_faults(raw_fault_events)
        else:
            fault_events = raw_fault_events

        has_critical = any(f["severity"] == "CRITICAL" for f in fault_events)
        is_anomaly = bool(ml_anomaly or has_critical or len(fault_events) > 0)

        return is_anomaly, score, fault_events
