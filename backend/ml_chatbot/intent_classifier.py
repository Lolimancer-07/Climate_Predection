"""
backend/ml_chatbot/intent_classifier.py

Loads the trained TF-IDF + Logistic Regression intent classifier and exposes
a single classify() function used by ai_engineer.py and cyclone_nexus_ai.py.

Falls back to keyword scoring if the serialized model file is absent.
"""

import os
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "intent_clf.joblib")
_pipeline = None
_model_loaded = False


def _load_model():
    global _pipeline, _model_loaded
    if _model_loaded:
        return
    if not os.path.exists(MODEL_PATH):
        _pipeline = None
        _model_loaded = True
        return
    try:
        import joblib
        _pipeline = joblib.load(MODEL_PATH)
    except Exception as e:
        logger.error("[ML Chatbot] Failed to load model: %s", e)
        _pipeline = None
    _model_loaded = True


_FALLBACK_RULES = [
    ("GREETING",              ["hello", "hi", "hey", "greetings"]),
    ("SURGE_RISK",            ["surge", "sea wall", "overtop", "dike", "inundation", "wave setup", "coastal flood"]),
    ("RAIN_FLOOD",            ["rain", "precipitation", "twi", "flash flood", "cloudburst", "catchment"]),
    ("EVACUATION_ROUTES",     ["route", "road", "highway", "passable", "nh 316", "transit corridor", "corridor", "bridge"]),
    ("HARDENING_ACTIONS",     ["hardening", "sandbag", "reinforce", "sop", "maintenance", "generator", "tie down", "transformer"]),
    ("INSURANCE_TRIGGER",     ["insurance", "payout", "hmac", "trigger", "liquidity", "policy"]),
    ("HITL_ADVISORY",         ["advisory", "gemini", "hitl", "dispatch", "cap 1.2", "xml", "operator"]),
    ("STORM_INTENSITY",       ["wind", "pressure", "intensity", "category", "barometer", "hpa", "knot", "track"]),
    ("DISTRICT_VULNERABILITY",["health", "vulnerability", "district", "subsystem", "integrity", "resilience"]),
    ("WHATIF_ADVICE",         ["what if", "simulate", "counterfactual", "perturbation", "shift"]),
    ("SENSOR_STATUS",         ["sensor", "aws", "radar", "tide gauge", "anemometer", "drift", "integrity score"]),
    ("CASUALTY_RISK",         ["casualty", "population", "shelter", "exposed", "evacuation probability"]),
    ("GENERAL_STATUS",        ["status", "overview", "summary", "report", "situation"]),
]


def _fallback_classify(question: str) -> Tuple[str, float]:
    q = question.lower()
    scores = {}
    for intent, kws in _FALLBACK_RULES:
        hits = sum(1 for kw in kws if kw in q)
        if hits:
            scores[intent] = hits
    if not scores:
        return "GENERAL_STATUS", 0.4
    best = max(scores, key=lambda k: scores[k])
    return best, min(scores[best] / 3.0, 0.75)


def classify(question: str) -> Tuple[str, float]:
    """
    Classifies natural language question into one of 12 cyclone emergency intents.
    Returns (intent_label, confidence).
    """
    _load_model()
    if _pipeline is None:
        return _fallback_classify(question)
    try:
        intent = _pipeline.predict([question])[0]
        proba = _pipeline.predict_proba([question])[0]
        classes = _pipeline.classes_
        confidence = float(proba[list(classes).index(intent)])
        return intent, round(confidence, 3)
    except Exception:
        return _fallback_classify(question)


def is_model_available() -> bool:
    return os.path.exists(MODEL_PATH)
