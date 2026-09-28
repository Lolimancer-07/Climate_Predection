"""
backend/xai_engine.py

Explainable AI (XAI) Diagnostic Attribution Engine.

Identifies which meteorological, hydrodynamic, or infrastructure parameters are
primarily responsible for triggering anomaly alerts, high surge risk, or district vulnerability degradation.
Computes percentage attributions ranked by contribution magnitude.
"""

from typing import Dict, List, Any

NOMINAL_BASELINES = {
    "central_pressure_hpa": {
        "mean": 1008.0, "std": 14.0, "unit": " hPa", "label": "Central Barometric Pressure",
        "description": "Pressure deficit drives inverted barometer sea rise and cyclostrophic winds."
    },
    "max_wind_kmh": {
        "mean": 45.0, "std": 25.0, "unit": " km/h", "label": "Sustained Surface Wind",
        "description": "Wind stress exerts square-law drag forcing sea water onto the shallow shelf."
    },
    "surge_height_m": {
        "mean": 0.5, "std": 0.4, "unit": " m", "label": "Hydrodynamic Surge Crest",
        "description": "Coastal water elevation above astronomical high-water spring datum."
    },
    "rainfall_rate_mmh": {
        "mean": 2.0, "std": 6.0, "unit": " mm/h", "label": "Precipitation Intensity",
        "description": "Extreme convective rainfall saturates drainage catchments and induces flash flooding."
    },
    "forward_speed_kmh": {
        "mean": 18.0, "std": 6.0, "unit": " km/h", "label": "Forward Translation Velocity",
        "description": "Slower translation speed prolongs wave setup and rain accumulation duration."
    },
    "tide_height_m": {
        "mean": 0.8, "std": 0.5, "unit": " m", "label": "Astronomical Tide Phase",
        "description": "Superposition of astronomical high spring tide magnifies flood crest."
    },
    "grid_voltage_kv": {
        "mean": 33.0, "std": 2.0, "unit": " kV", "label": "33kV Power Grid Substation Bus",
        "description": "Transmission tower wind loading causes insulator flashover or conductor galloping."
    },
}


class XAIDiagnosticEngine:
    @classmethod
    def explain_anomaly(
        cls,
        telemetry: Dict[str, Any],
        is_anomaly: bool,
        anomaly_score: float,
        active_faults: List[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        active_faults = active_faults or []
        attributions = []
        raw_deviations = {}

        for feat, meta in NOMINAL_BASELINES.items():
            if feat in telemetry:
                val = float(telemetry[feat])
                mean = meta["mean"]
                std = meta["std"]

                # For pressure, drop below nominal is hazardous; for others, rise above is hazardous
                if feat == "central_pressure_hpa":
                    dev_sigma = max(0.0, (mean - val) / std)
                elif feat == "grid_voltage_kv":
                    dev_sigma = max(0.0, (mean - val) / std)
                else:
                    dev_sigma = max(0.0, (val - mean) / std)

                raw_deviations[feat] = dev_sigma

        total_dev = sum(raw_deviations.values())

        if total_dev > 0:
            for feat, dev in raw_deviations.items():
                pct = (dev / total_dev) * 100.0
                meta = NOMINAL_BASELINES[feat]
                attributions.append({
                    "feature": feat,
                    "label": meta["label"],
                    "attribution": round(pct, 1),
                    "value": round(float(telemetry[feat]), 2),
                    "nominal": meta["mean"],
                    "unit": meta["unit"],
                    "description": meta["description"],
                })

        attributions.sort(key=lambda x: x["attribution"], reverse=True)
        top_driver = attributions[0]["label"] if attributions else "Nominal Atmospheric State"

        return {
            "is_anomaly": bool(is_anomaly),
            "anomaly_score": round(anomaly_score, 4),
            "top_driver": top_driver,
            "attributions": attributions[:6],
            "active_faults_count": len(active_faults),
        }
