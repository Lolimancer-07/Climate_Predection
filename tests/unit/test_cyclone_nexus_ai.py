"""
tests/unit/test_cyclone_nexus_ai.py
Unit tests for Cyclone Nexus AI Copilot intelligence core.
"""
import pytest
from backend.cyclone_nexus_ai import classify_intent, answer_copilot_query, CATEGORIES


def test_intent_classification():
    intent, conf = classify_intent("Why is Ward 7 at highest inundation risk?")
    assert intent == "SURGE_RISK"
    assert conf > 0.8

    intent, conf = classify_intent("What is the 72h rainfall and TWI runoff?")
    assert intent == "RAIN_FLOOD"

    intent, conf = classify_intent("Which evacuation routes are cut off by floodwater?")
    assert intent == "EVACUATION_ROUTES"

    intent, conf = classify_intent("What structural hardening is required for the power grid?")
    assert intent == "HARDENING_ACTIONS"

    intent, conf = classify_intent("Does central pressure meet the parametric insurance trigger?")
    assert intent == "INSURANCE_TRIGGER"

    intent, conf = classify_intent("What is the CAP XML advisory status?")
    assert intent == "HITL_ADVISORY"

    intent, conf = classify_intent("What is the sustained wind speed and landfall ETA?")
    assert intent == "STORM_INTENSITY"

    intent, conf = classify_intent("Give me a situational overview.")
    assert intent == "GENERAL_STATUS"


def test_answer_copilot_query():
    state = {
        "storm_name": "Cyclone BOB07",
        "district": "Puri (IN-OD-PURI)",
        "central_pressure": 932,
        "max_wind_kmh": 215,
        "peak_surge_m": 4.2,
        "lead_time_h": 36,
    }
    resp = answer_copilot_query("Why is Ward 7 at highest inundation risk?", state)
    assert resp["category"] == "SURGE_RISK"
    assert "4.2 m" in resp["answer"]
    assert "Puri Ward 7" in resp["answer"]
    assert len(resp["follow_ups"]) > 0
    assert "timestamp" in resp


def test_insurance_trigger_copilot_query():
    state = {
        "storm_name": "Cyclone BOB07",
        "district": "Puri",
        "central_pressure": 930,
        "max_wind_kmh": 200,
    }
    resp = answer_copilot_query("Is the parametric insurance policy triggered?", state)
    assert resp["category"] == "INSURANCE_TRIGGER"
    assert "TRIGGERED (100% VERIFIED)" in resp["answer"]
    assert "HMAC-SHA256" in resp["answer"]
