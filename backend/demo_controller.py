"""
backend/demo_controller.py

Scripted demo sequencer — walks through 9 operational steps to demonstrate
the full Cyclone Anticipatory Action digital twin pipeline from pre-landfall
monitoring to rapid intensification, anomaly detection, XAI attribution,
counterfactual simulation, optimization, prescriptive hardening, and evacuation feasibility.

The scenario follows: Sense → Detect → Predict → Explain → Simulate → Optimize
→ Recommend → Protect, which is the core value proposition of the digital twin.

Steps:
  1. NORMAL           — healthy baseline at T-72h, everything nominal
  2. INTENSIFICATION  — inject rapid barometric pressure drop & wind surge at T-48h
  3. DETECT           — multi-layer anomaly detector triggers
  4. EXPLAIN          — XAI attributes risk to Central Pressure Deficit & Continental Shelf Slope
  5. PREDICT          — parametric surge model projects +4.2m inundation & TWI runoff
  6. WHAT-IF          — counterfactual simulation of 35 km track northward shift & high tide
  7. OPTIMIZE         — optimizer finds optimal evacuation dispatch rate & fuel staging
  8. RECOMMEND        — prescriptive action: seal tidal sluices, sandbag dikes, elevate hospital ADGs
  9. MISSION          — compare 54% unassisted vs 91% assisted safe evacuation completion probability
"""

import os
import json
from typing import Dict, Any

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTROL_FILE = os.path.join(ROOT, 'simulator', 'current_profile.json')

DEMO_STEPS = [
    {
        "step": 1, "name": "NORMAL PRE-LANDFALL WATCH",
        "description": "Baseline T-72h: Category 1 cyclonic storm. Infrastructure health >90%, Evacuation feasibility LOW RISK.",
        "action": "clear_faults", "profile": "NORMAL", "speed": 2.0,
        "highlight": "overview",
    },
    {
        "step": 2, "name": "RAPID INTENSIFICATION INJECTION",
        "description": "Injecting rapid barometric intensification fault (delta P = -81 hPa, winds jump to 215 km/h).",
        "action": "inject_fault", "fault": "RAPID_INTENSIFICATION", "profile": "EXTREME", "speed": 2.0,
        "highlight": "fault_injection",
    },
    {
        "step": 3, "name": "ANOMALY DETECTION TRIP",
        "description": "Multi-layer detection: Multivariate envelope + 10 domain hazard rules trigger (BAROMETRIC_ANOMALY, EXTREME_SURGE_RISK).",
        "action": "none", "highlight": "digital_twin",
    },
    {
        "step": 4, "name": "ROOT CAUSE / XAI ATTRIBUTION",
        "description": "XAI engine isolates Pressure Deficit (-81 hPa) and Bathymetric Shelf Amplification as 48% primary risk drivers.",
        "action": "none", "highlight": "ai_rul",
    },
    {
        "step": 5, "name": "PARAMETRIC SURGE & FLOOD FORECAST",
        "description": "Hydrodynamic surge model projects peak water level +4.2m MSL. TWI model flags 8 lowland coastal blocks.",
        "action": "none", "highlight": "ai_rul",
    },
    {
        "step": 6, "name": "WHAT-IF COUNTERFACTUAL SIMULATION",
        "description": "Simulating 35 km northward track shift and high astronomical tide superposition (+0.8m).",
        "action": "none", "highlight": "whatif",
    },
    {
        "step": 7, "name": "RESOURCE & EVACUATION OPTIMIZATION",
        "description": "Optimizer calculates optimal bus fleet dispatch frequency (42 buses/hr) and fuel staging for shelters.",
        "action": "none", "highlight": "whatif",
    },
    {
        "step": 8, "name": "PRESCRIPTIVE HARDENING DIRECTIVE",
        "description": "System issues prioritized work orders: SOP 75-10-01 sea dike sandbagging & SOP 72-10-02 hospital ADG elevation.",
        "action": "none", "highlight": "maintenance",
    },
    {
        "step": 9, "name": "EVACUATION FEASIBILITY DECISION",
        "description": "Without intervention: 54% completion probability. With anticipatory plan: 91% safe population evacuation.",
        "action": "none", "highlight": "mission_risk",
    },
]


class DemoController:
    def __init__(self):
        self.active = False
        self.current_step = 0
        self.whatif_result = None
        self.optimize_result = None

    def start(self):
        self.active = True
        self.current_step = 1
        self._apply_step(1)

    def stop(self):
        self.active = False
        self.current_step = 0
        self._clear_state()

    def advance(self, step: int = None):
        if step is not None:
            self.current_step = max(1, min(len(DEMO_STEPS), step))
        else:
            self.current_step = min(len(DEMO_STEPS), self.current_step + 1)
        self._apply_step(self.current_step)
        return self.get_state()

    def _apply_step(self, step_num: int):
        step = next((s for s in DEMO_STEPS if s["step"] == step_num), None)
        if not step:
            return
        cfg = {"mode": "NORMAL", "speed": 2.0, "paused": False, "injected_faults": []}
        try:
            if os.path.exists(CONTROL_FILE):
                with open(CONTROL_FILE, 'r') as f:
                    cfg = json.load(f)
        except Exception:
            pass
        if "profile" in step:
            cfg["mode"] = step["profile"]
        if "speed" in step:
            cfg["speed"] = step["speed"]
        if step.get("action") == "clear_faults":
            cfg["injected_faults"] = []
        elif step.get("action") == "inject_fault":
            faults = set(cfg.get("injected_faults", []))
            faults.add(step.get("fault", "RAPID_INTENSIFICATION"))
            cfg["injected_faults"] = list(faults)
        try:
            os.makedirs(os.path.dirname(CONTROL_FILE), exist_ok=True)
            with open(CONTROL_FILE, 'w') as f:
                json.dump(cfg, f, indent=2)
        except Exception:
            pass

    def _clear_state(self):
        cfg = {"mode": "NORMAL", "speed": 1.0, "paused": False, "injected_faults": []}
        try:
            os.makedirs(os.path.dirname(CONTROL_FILE), exist_ok=True)
            with open(CONTROL_FILE, 'w') as f:
                json.dump(cfg, f, indent=2)
        except Exception:
            pass

    def get_state(self) -> dict:
        if not self.active:
            return {"active": False, "step": 0, "total_steps": len(DEMO_STEPS)}
        step = next((s for s in DEMO_STEPS if s["step"] == self.current_step), DEMO_STEPS[0])
        return {
            "active": True,
            "step": self.current_step,
            "total_steps": len(DEMO_STEPS),
            "name": step["name"],
            "description": step["description"],
            "highlight": step.get("highlight", "overview"),
            "steps": [{"step": s["step"], "name": s["name"]} for s in DEMO_STEPS],
        }


demo_controller = DemoController()
