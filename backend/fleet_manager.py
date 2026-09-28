"""
backend/fleet_manager.py

Tracks state for all 5 high-risk coastal districts simultaneously.

Each district represents a distinct coastal sector with different bathymetric shelf slope,
mangrove damping coefficient, population density, and infrastructure exposure offset,
so the GCS operator gets a realistic spread of vulnerability states across the regional panel.

The GCS operator can switch the active district and the rest of the digital twin pipeline follows.
"""

from typing import Dict, Any

DISTRICT_CONFIG = [
    {"district_id": "IN-OD-PURI", "district_num": 1, "name": "Puri",           "zone": "GROUND-ZERO",   "population": 1700000},
    {"district_id": "IN-OD-JAG",  "district_num": 2, "name": "Jagatsinghpur",  "zone": "PORT-REFINERY", "population": 1137000},
    {"district_id": "IN-OD-KEN",  "district_num": 3, "name": "Kendrapara",     "zone": "MANGROVE-DELTA","population": 1440000},
    {"district_id": "IN-OD-GAN",  "district_num": 4, "name": "Ganjam",         "zone": "SOUTH-CORRIDOR","population": 3530000},
    {"district_id": "IN-OD-BHA",  "district_num": 5, "name": "Bhadrak",        "zone": "ESTUARY-PORT",  "population": 1507000},
]

DISTRICT_VULNERABILITY_OFFSETS = {
    "IN-OD-PURI":  0,     # Primary landfall focus
    "IN-OD-JAG":  -15,    # High port & industrial vulnerability
    "IN-OD-KEN":   10,    # Mangrove buffer provides attenuation
    "IN-OD-GAN":  -25,    # Steeper surge amplification
    "IN-OD-BHA":   5,     # Riverine flatland
}


class DistrictFleetManager:
    """Manages multi-district coastal twin state and active sector selection."""

    def __init__(self):
        self.fleet_state: Dict[str, dict] = {
            cfg["district_id"]: {
                "district_id": cfg["district_id"],
                "district_num": cfg["district_num"],
                "name": cfg["name"],
                "zone": cfg["zone"],
                "population": cfg["population"],
                "health": min(100.0, max(20.0, 88.0 + DISTRICT_VULNERABILITY_OFFSETS[cfg["district_id"]] * 0.4)),
                "surge_height_m": max(0.5, 3.8 - DISTRICT_VULNERABILITY_OFFSETS[cfg["district_id"]] * 0.04),
                "condition": "NOMINAL",
                "fault_count": 0,
                "alert": "NOMINAL",
                "evacuation_probability": min(100.0, max(30.0, 85.0 + DISTRICT_VULNERABILITY_OFFSETS[cfg["district_id"]] * 0.5)),
                "lead_time_h": 48.0,
                "last_update": None,
            }
            for cfg in DISTRICT_CONFIG
        }
        self.active_district_id = "IN-OD-PURI"

    @property
    def active_uav_id(self) -> str:
        """Alias for active district ID to maintain compatibility with reference interfaces."""
        return self.active_district_id

    def update_uav(self, district_id: str, payload: dict):
        """Refreshes state for one coastal district from its latest digital twin payload."""
        if district_id not in self.fleet_state:
            return
        s = self.fleet_state[district_id]
        health = payload.get("health", {})
        mission_risk = payload.get("mission_risk", {})
        s["health"] = health.get("health_index", s["health"])
        s["condition"] = health.get("condition", s["condition"])
        s["surge_height_m"] = payload.get("surge_height_m", s["surge_height_m"])
        s["fault_count"] = len(payload.get("fault_events", []))
        s["alert"] = payload.get("alert", "NOMINAL")
        s["evacuation_probability"] = mission_risk.get("mission_completion_probability", s["evacuation_probability"])
        s["last_update"] = payload.get("cycle", 0)

    def get_fleet_status(self) -> list:
        """Returns the full coastal district list for the overview panel with status indicators."""
        result = []
        for did, s in self.fleet_state.items():
            hi = s["health"]
            if hi >= 80:
                status_color = "ok"
                status_dot = "🟢"
            elif hi >= 50:
                status_color = "warn"
                status_dot = "🟡"
            else:
                status_color = "crit"
                status_dot = "🔴"
            result.append({
                "uav_id":                 s["district_id"],
                "district_id":            s["district_id"],
                "call_sign":              s["name"].upper(),
                "name":                   s["name"],
                "mission":                s["zone"],
                "population":             s["population"],
                "health":                 round(s["health"], 1),
                "rul":                    round(s.get("surge_height_m", 0.0), 2),
                "surge_height_m":         round(s.get("surge_height_m", 0.0), 2),
                "condition":              s["condition"],
                "fault_count":            s["fault_count"],
                "alert":                  s["alert"],
                "status_color":           status_color,
                "status_dot":             status_dot,
                "is_active":              did == self.active_district_id,
                "mission_probability":    round(s["evacuation_probability"], 1),
                "evacuation_probability": round(s["evacuation_probability"], 1),
            })
        return result

    def select_uav(self, district_id: str) -> bool:
        """Selects active district."""
        if district_id in self.fleet_state:
            self.active_district_id = district_id
            return True
        return False

    def get_active_engine_id(self) -> int:
        s = self.fleet_state.get(self.active_district_id, {})
        return s.get("district_num", 1)


fleet_manager = DistrictFleetManager()
