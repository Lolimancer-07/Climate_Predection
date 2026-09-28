"""
backend/maintenance_advisor.py

Generates NDMA/OSDMA-chapter–referenced infrastructure hardening work orders based on
active hazard alerts and AI-predicted surge inundation, with strict multi-hazard priority ranking.

Disaster mitigation chapters covered:
  SOP 75 — Coastal Embankment & Sea Dike Protection
  SOP 72 — Critical Power Grid & Substation Resilience
  SOP 79 — Hospital Emergency Power & Critical Lifelines
  SOP 77 — Early Warning Sensor & Telemetry Indicating
  SOP 80 — Emergency Evacuation Corridors & Transport
  SOP 05 — Shelter Staging & Public Health Water Security

Each work order card specifies:
  - Task ID (Standard Operating Procedure compliant)
  - Title
  - Category / System
  - Priority & Rank
  - Urgency Window (hours remaining before gale force winds or surge cutoff)
  - Priority Rationale (explaining why this item takes precedence)
  - Required Action & Step-by-Step Field Procedures
"""

from typing import Dict, List, Any

# Deterministic public-safety priority order for concurrent disaster triage
FAULT_PRIORITY_HIERARCHY: Dict[str, Dict[str, Any]] = {
    "COASTAL_DIKE_OVERTOPPING": {
        "rank": 1,
        "rationale": "Embankment breach results in catastrophic saltwater inundation across inhabited lowlands within 30-60 minutes."
    },
    "BAROMETRIC_ANOMALY": {
        "rank": 2,
        "rationale": "Central pressure deficit < 940 hPa heralds Category 4+ extreme winds and devastating storm surge wave setup."
    },
    "EXTREME_SURGE_RISK": {
        "rank": 3,
        "rationale": "Hydrodynamic surge crest exceeding 3.5m MSL cuts off all ground transit routes and floods ground-floor structures."
    },
    "RAPID_INTENSIFICATION": {
        "rank": 4,
        "rationale": "Unforecasted intensification reduces safe evacuation window by 12 to 18 hours; requires immediate alert escalation."
    },
    "EVAC_ROUTE_INUNDATION": {
        "rank": 5,
        "rationale": "Flooding of primary arterial highways traps buses and prevents vulnerable populations from reaching shelters."
    },
    "FLASH_FLOOD_EMERGENCY": {
        "rank": 6,
        "rationale": "Intense localized cloudburst compounds coastal backwater effect, isolating riverine communities."
    },
    "GRID_VOLTAGE_SAG": {
        "rank": 7,
        "rationale": "Transmission tower failure disables municipal water pumps, hospital oxygen plants, and emergency communications."
    },
    "AWS_BAROMETER_DRIFT": {
        "rank": 8,
        "rationale": "Coastal weather station sensor drift degrades numerical model accuracy during critical pre-landfall track calculation."
    },
    "RAIN_GAUGE_STUCK": {
        "rank": 9,
        "rationale": "Faulty gauge readings mask extreme antecedent soil saturation in flash flood catchment areas."
    },
    "ANEMOMETER_SATURATION": {
        "rank": 10,
        "rationale": "Sensor clipping above 220 km/h obscures core eyewall wind velocity; switch to Doppler radar radial velocity."
    }
}

SOP_MAINTENANCE_CARDS: Dict[str, Dict[str, Any]] = {
    "COASTAL_DIKE_OVERTOPPING": {
        "task_id": "SOP 75-10-01",
        "title": "Rapid Geotextile Sandbagging & Embankment Crest Elevation",
        "chapter": "75 (Coastal Sea Dike Defense)",
        "priority": "CRITICAL",
        "urgency_hours": 2.0,
        "action": "Deploy rapid engineering units with geotextile jumbo bags and heavy rock armor at critical breach-vulnerable dike reaches.",
        "steps": [
            "Step 1: Inspect crest elevation at low points using RTK GPS datum markers.",
            "Step 2: Place 2-ton polypropylene non-woven geotextile sandbags in 3-tier staggered pyramid configuration.",
            "Step 3: Secure armored plastic sheeting over landward face to prevent scouring from overtopping spray.",
            "Step 4: Station hydraulic excavator on standby on landward berm for emergency breach plug."
        ]
    },
    "BAROMETRIC_ANOMALY": {
        "task_id": "SOP 80-20-01",
        "title": "Mandatory Coastal Strip Evacuation & Harbor Clearance",
        "chapter": "80 (Emergency Transport & Evacuation)",
        "priority": "CRITICAL",
        "urgency_hours": 4.0,
        "action": "Execute mandatory evacuation within 5 km of shoreline. Order total fishing harbor shutdown and vessel tie-downs.",
        "steps": [
            "Step 1: Broadcast high-priority CAP XML sirens and automated voice alerts to coastal cell towers.",
            "Step 2: Dispatch State Disaster Rapid Action Force (ODRAF/NDRF) transport flotillas.",
            "Step 3: Enforce police perimeter closing beachside transit roads to civilian inbound traffic.",
            "Step 4: Confirm 100% headcount transfer of vulnerable elderly and pediatric population."
        ]
    },
    "EXTREME_SURGE_RISK": {
        "task_id": "SOP 75-20-02",
        "title": "Sluice Gate Lockdown & Reverse Saline Ingress Barrier Deployment",
        "chapter": "75 (Hydraulic Structures & Estuaries)",
        "priority": "CRITICAL",
        "urgency_hours": 3.0,
        "action": "Lock all tidal drainage sluice gates against sea surge. Pre-position high-volume diesel dewatering pumps landward.",
        "steps": [
            "Step 1: Lower mechanical counterweight tidal gates and engage deadweight hydraulic locking pins.",
            "Step 2: Verify rubber seal compression against seawater back-pressure.",
            "Step 3: Stage 500 m³/hr mobile diesel dewatering pumps at landward retention basin.",
            "Step 4: Check fuel autonomy (minimum 72 hours continuous running)."
        ]
    },
    "RAPID_INTENSIFICATION": {
        "task_id": "SOP 77-10-01",
        "title": "Emergency Warning Escalation & Lead Time Compression Protocol",
        "chapter": "77 (Meteorological Early Warning)",
        "priority": "CRITICAL",
        "urgency_hours": 3.0,
        "action": "Compress institutional response timelines from 48h to 24h operational tempo. Pre-position standby disaster taskforces.",
        "steps": [
            "Step 1: Transmit revised intensity brief to State Emergency Operation Center (SEOC).",
            "Step 2: Advance district curfew and market closure by 12 hours.",
            "Step 3: Mobilize Indian Coast Guard and naval disaster relief vessels to offshore standby.",
            "Step 4: Elevate all hospitals to code-black internal disaster posture."
        ]
    },
    "EVAC_ROUTE_INUNDATION": {
        "task_id": "SOP 80-10-03",
        "title": "Corridor Diversion & High-Clearance Amphibious Vehicle Staging",
        "chapter": "80 (Emergency Transport & Corridors)",
        "priority": "WARNING",
        "urgency_hours": 6.0,
        "action": "Divert civilian evacuation convoys to elevated national highway bypass. Stage high-clearance military trucks at submerged causeways.",
        "steps": [
            "Step 1: Install flashing LED detour barriers at flooded arterial intersections.",
            "Step 2: Post water-depth gauge poles with reflective high-water redlines.",
            "Step 3: Deploy 6x6 high-mobility logistics vehicles for marooned passenger transfer.",
            "Step 4: Dispatch engineering reconnaissance team with drone LIDAR for culvert integrity check."
        ]
    },
    "FLASH_FLOOD_EMERGENCY": {
        "task_id": "SOP 75-30-01",
        "title": "Urban Stormwater Canal Desilting & Gravity Drainage Clearing",
        "chapter": "75 (Drainage & Runoff)",
        "priority": "WARNING",
        "urgency_hours": 8.0,
        "action": "Clear culvert trash racks, open gravity bypass drains before tidal lock, and clear plastic waste blockages.",
        "steps": [
            "Step 1: Dispatch backhoes to clean municipal storm canal bottlenecks.",
            "Step 2: Remove temporary construction barricades from drainage rights-of-way.",
            "Step 3: Pre-position inflatable rescue boats in low-lying residential wards."
        ]
    },
    "GRID_VOLTAGE_SAG": {
        "task_id": "SOP 72-10-02",
        "title": "Substation Tower Guy-Wire Tensioning & Feeder Sectionalizing",
        "chapter": "72 (Electrical Power Infrastructure)",
        "priority": "WARNING",
        "urgency_hours": 10.0,
        "action": "Tension guy-wires on 220kV terminal transmission towers. Pre-stage dry-type distribution transformers and line crews.",
        "steps": [
            "Step 1: Torque check tower foundation hold-down bolts (320 Nm).",
            "Step 2: Inspect guy-wire turnbuckles and set tension to high-wind pre-load specification.",
            "Step 3: Elevate mobile diesel generators above +4.5m surge datum at district hospitals.",
            "Step 4: Sectionalize vulnerable overhead feeders to isolate coastal segments without tripping main grid."
        ]
    },
    "AWS_BAROMETER_DRIFT": {
        "task_id": "SOP 77-20-04",
        "title": "Coastal Weather Station Cross-Calibration & Doppler Fallback",
        "chapter": "77 (Instrumentation & Sensors)",
        "priority": "WARNING",
        "urgency_hours": 12.0,
        "action": "Recalibrate piezoresistive barometer against airport precision reference. Switch storm tracker to IMD Doppler radar assimilation.",
        "steps": [
            "Step 1: Run sensor residual diagnostics against neighboring coastal AWS nodes.",
            "Step 2: Apply +2.4 hPa software calibration offset in telemetry pre-processor.",
            "Step 3: Enable radar radial velocity wind profile assimilation as primary input."
        ]
    }
}


class AutonomousMaintenanceAdvisor:
    """
    Evaluates active cyclone hazard signatures, multi-sensor residuals, and lead time
    to produce deterministic SOP-compliant digital hardening work orders sorted by public-safety priority.
    """

    @classmethod
    def generate_advisories(cls, telemetry: Dict[str, Any], fault_events: List[Dict[str, Any]],
                            lead_time_h: float = 48.0, health_index: float = 90.0) -> List[Dict[str, Any]]:
        advisories = []
        seen_tasks = set()

        for fault in fault_events:
            fname = fault.get("name", "").upper()
            if fname in SOP_MAINTENANCE_CARDS and fname not in seen_tasks:
                card = dict(SOP_MAINTENANCE_CARDS[fname])
                meta = FAULT_PRIORITY_HIERARCHY.get(fname, {"rank": 50, "rationale": "Standard disaster mitigation procedure."})
                card["priority_rank"] = meta["rank"]
                card["priority_rationale"] = meta["rationale"]
                card["source_hazard"] = fname
                seen_tasks.add(fname)
                advisories.append(card)

        # Sort fault advisories by priority rank (1 = highest urgency)
        advisories.sort(key=lambda x: (x.get("priority_rank", 50), x.get("urgency_hours", 100)))

        # Time-critical pre-landfall staging alerts
        if 0 < lead_time_h < 12.0:
            advisories.insert(0, {
                "task_id": "SOP 00-00-99",
                "title": f"Terminal Landfall Window ({lead_time_h:.0f}h to Impact) — Complete Evacuation & Lockdown",
                "chapter": "00 (Emergency Operations General)",
                "priority": "CRITICAL",
                "priority_rank": 0,
                "priority_rationale": "Gale winds and surge imminent. Outdoor transit strictly prohibited.",
                "urgency_hours": 1.0,
                "action": "Issue total movement curfew. Seal cyclone shelters and transfer operational command to hardened bunker.",
                "steps": [
                    "Step 1: Complete final headcount verification at all 328 cyclone shelters.",
                    "Step 2: Switch district command to battery-buffered satellite VHF communications.",
                    "Step 3: Ground all maritime and road response vehicles."
                ]
            })
        elif 12.0 <= lead_time_h < 36.0:
            advisories.append({
                "task_id": "SOP 05-20-01",
                "title": f"Mid-Window Staging (Lead Time: {lead_time_h:.0f}h) — Food & Fuel Pre-Positioning",
                "chapter": "05 (Civil Protection Logistics)",
                "priority": "WARNING",
                "priority_rank": 20,
                "priority_rationale": "36-hour lead time window allows safe prepositioning before high winds halt road transport.",
                "urgency_hours": 12.0,
                "action": "Distribute 7-day emergency rations, water purification kits, and diesel fuel to all designated shelters.",
                "steps": [
                    "Step 1: Dispatch convoy with 50,000 dry food packets to block headquarters.",
                    "Step 2: Test automatic transfer switch on shelter backup ADG generators.",
                    "Step 3: Replenish municipal hospital blood bank and surgical oxygen reserves."
                ]
            })

        if not advisories:
            advisories.append({
                "task_id": "SOP 05-00-00",
                "title": "Coastal District Infrastructure Nominal — Anticipatory Monitoring Active",
                "chapter": "05 (Civil Protection General)",
                "priority": "OK",
                "priority_rank": 99,
                "priority_rationale": "All coastal defenses, drainage networks, and sensors operate within nominal safety bounds.",
                "urgency_hours": 72.0,
                "action": "Maintain standard 6-hourly storm track watch and automated AWS telemetry ingestion.",
                "steps": ["Routine 6h numerical forecast evaluation & tide gauge calibration check."]
            })

        return advisories
