"""
ai-reasoning/rapid_damage_assessment/__init__.py
Rapid Post-Event Damage Assessment using Gemini Vision.

Compares pre/post-event satellite imagery to detect infrastructure damage
and cross-references against pre-landfall structural predictions.
"""
from .image_pair_fetch import fetch_image_pair, ImagePair
from .change_detection_prompt import build_change_detection_prompt, ChangeDetectionResult
from .validation_record import ValidationRecord, create_validation_records

__all__ = [
    "fetch_image_pair",
    "ImagePair",
    "build_change_detection_prompt",
    "ChangeDetectionResult",
    "ValidationRecord",
    "create_validation_records",
]
