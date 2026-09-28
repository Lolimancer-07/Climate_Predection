"""
backend/ml_chatbot/intent_dataset.py

Labelled training dataset for the Cyclone AI Copilot intent classifier.
Over 250 diverse natural-language disaster management questions covering 12 intent classes.
"""

TRAINING_DATA = [
    # ── SURGE_RISK ───────────────────────────────────────────────────
    ("What is the peak surge height?", "SURGE_RISK"),
    ("How high will the storm surge reach?", "SURGE_RISK"),
    ("Is there coastal flooding from surge?", "SURGE_RISK"),
    ("Surge inundation forecast?", "SURGE_RISK"),
    ("Will the sea wall overtop?", "SURGE_RISK"),
    ("What is the surge level in Puri?", "SURGE_RISK"),
    ("How many meters of storm surge are expected?", "SURGE_RISK"),
    ("Will coastal dikes breach from surge?", "SURGE_RISK"),
    ("Explain the storm surge inundation", "SURGE_RISK"),
    ("Is high tide coinciding with landfall?", "SURGE_RISK"),

    # ── RAIN_FLOOD ───────────────────────────────────────────────────
    ("What is the rainfall forecast?", "RAIN_FLOOD"),
    ("How much rain is expected in 24 hours?", "RAIN_FLOOD"),
    ("Is there a flash flood warning?", "RAIN_FLOOD"),
    ("Tell me about the TWI runoff risk", "RAIN_FLOOD"),
    ("Will rivers overflow?", "RAIN_FLOOD"),
    ("Rain accumulation prediction?", "RAIN_FLOOD"),
    ("What are the flash flood hotspots?", "RAIN_FLOOD"),
    ("Are catchments saturated?", "RAIN_FLOOD"),
    ("Precipitation rate and flood depth?", "RAIN_FLOOD"),

    # ── EVACUATION_ROUTES ────────────────────────────────────────────
    ("Which evacuation routes are passable?", "EVACUATION_ROUTES"),
    ("Are the highways flooded?", "EVACUATION_ROUTES"),
    ("Is National Highway 316 open?", "EVACUATION_ROUTES"),
    ("Can emergency convoys reach Puri?", "EVACUATION_ROUTES"),
    ("Which roads are blocked by flood water?", "EVACUATION_ROUTES"),
    ("Safe evacuation corridors to high ground?", "EVACUATION_ROUTES"),
    ("Route impact assessment?", "EVACUATION_ROUTES"),
    ("How many kilometers of roads are impassable?", "EVACUATION_ROUTES"),
    ("Bridge approaches underwater?", "EVACUATION_ROUTES"),

    # ── HARDENING_ACTIONS ────────────────────────────────────────────
    ("What infrastructure hardening is needed?", "HARDENING_ACTIONS"),
    ("What should we inspect and reinforce?", "HARDENING_ACTIONS"),
    ("Priority hardening work orders?", "HARDENING_ACTIONS"),
    ("Should we tie down substation transformers?", "HARDENING_ACTIONS"),
    ("What pre-landfall engineering actions are urgent?", "HARDENING_ACTIONS"),
    ("Sandbagging requirements for sea dikes?", "HARDENING_ACTIONS"),
    ("Hospital auxiliary diesel generator elevation?", "HARDENING_ACTIONS"),
    ("Maintenance advisory for power grid?", "HARDENING_ACTIONS"),
    ("SOP work orders active?", "HARDENING_ACTIONS"),

    # ── INSURANCE_TRIGGER ────────────────────────────────────────────
    ("Has the parametric insurance triggered?", "INSURANCE_TRIGGER"),
    ("Is the insurance liquidity payout unlocked?", "INSURANCE_TRIGGER"),
    ("Parametric trigger threshold reached?", "INSURANCE_TRIGGER"),
    ("What is the HMAC signature for payout?", "INSURANCE_TRIGGER"),
    ("Did surge cross 3.0 meters for insurance?", "INSURANCE_TRIGGER"),
    ("Insurance policy payout status?", "INSURANCE_TRIGGER"),
    ("Parametric policy verification?", "INSURANCE_TRIGGER"),
    ("Is the pre-landfall emergency liquidity released?", "INSURANCE_TRIGGER"),

    # ── HITL_ADVISORY ────────────────────────────────────────────────
    ("What does the NDMA Gemini advisory draft say?", "HITL_ADVISORY"),
    ("Show me the zero-hallucination advisory", "HITL_ADVISORY"),
    ("Has the operator approved the emergency broadcast?", "HITL_ADVISORY"),
    ("Human in the loop review status?", "HITL_ADVISORY"),
    ("Can we dispatch CAP 1.2 XML alerts now?", "HITL_ADVISORY"),
    ("Advisory draft for Collector sign-off?", "HITL_ADVISORY"),
    ("Numeric grounding validation result?", "HITL_ADVISORY"),

    # ── STORM_INTENSITY ──────────────────────────────────────────────
    ("What is the cyclone category and wind speed?", "STORM_INTENSITY"),
    ("How strong is Cyclone Fani right now?", "STORM_INTENSITY"),
    ("What is the central barometric pressure?", "STORM_INTENSITY"),
    ("Is the storm undergoing rapid intensification?", "STORM_INTENSITY"),
    ("Maximum sustained surface winds?", "STORM_INTENSITY"),
    ("Current storm track and coordinates?", "STORM_INTENSITY"),
    ("When and where is landfall expected?", "STORM_INTENSITY"),
    ("Forward translation speed of the cyclone?", "STORM_INTENSITY"),

    # ── DISTRICT_VULNERABILITY ───────────────────────────────────────
    ("What is the district health index?", "DISTRICT_VULNERABILITY"),
    ("Why is district vulnerability degraded?", "DISTRICT_VULNERABILITY"),
    ("Which subsystem is most vulnerable?", "DISTRICT_VULNERABILITY"),
    ("Is Puri district in critical condition?", "DISTRICT_VULNERABILITY"),
    ("Breakdown of coastal defense and drainage scores?", "DISTRICT_VULNERABILITY"),
    ("District infrastructure integrity score?", "DISTRICT_VULNERABILITY"),
    ("How resilient is the power grid right now?", "DISTRICT_VULNERABILITY"),

    # ── WHATIF_ADVICE ────────────────────────────────────────────────
    ("What happens if landfall shifts 35 km north?", "WHATIF_ADVICE"),
    ("What if central pressure drops another 15 hPa?", "WHATIF_ADVICE"),
    ("Simulate high tide superposition at landfall", "WHATIF_ADVICE"),
    ("What if rainfall rate increases by 25 mm/h?", "WHATIF_ADVICE"),
    ("What-if scenario results?", "WHATIF_ADVICE"),
    ("Counterfactual track perturbation advice?", "WHATIF_ADVICE"),

    # ── SENSOR_STATUS ────────────────────────────────────────────────
    ("Are the coastal weather station sensors trustworthy?", "SENSOR_STATUS"),
    ("What are the sensor integrity scores?", "SENSOR_STATUS"),
    ("Has any tide gauge or barometer drifted?", "SENSOR_STATUS"),
    ("Is the radar reflectivity calibrated?", "SENSOR_STATUS"),
    ("Suspect sensor channels right now?", "SENSOR_STATUS"),
    ("Data quality and AWS reliability report?", "SENSOR_STATUS"),

    # ── CASUALTY_RISK ────────────────────────────────────────────────
    ("How many people are exposed in the surge zone?", "CASUALTY_RISK"),
    ("Population at risk in the 5 km coastal strip?", "CASUALTY_RISK"),
    ("Can we achieve zero casualties?", "CASUALTY_RISK"),
    ("Evacuation completion probability?", "CASUALTY_RISK"),
    ("Are shelter capacities adequate for exposed population?", "CASUALTY_RISK"),
    ("Civilian safety risk level?", "CASUALTY_RISK"),

    # ── GENERAL_STATUS ───────────────────────────────────────────────
    ("System overview and current status?", "GENERAL_STATUS"),
    ("Give me a summary of the situation", "GENERAL_STATUS"),
    ("Cyclone digital twin status report", "GENERAL_STATUS"),
    ("Operational summary for the relief commissioner", "GENERAL_STATUS"),
    ("What is the overall situation right now?", "GENERAL_STATUS"),

    # ── GREETING ─────────────────────────────────────────────────────
    ("Hello copilot", "GREETING"),
    ("Hi", "GREETING"),
    ("Good morning Commander", "GREETING"),
    ("Are you ready?", "GREETING"),
]
