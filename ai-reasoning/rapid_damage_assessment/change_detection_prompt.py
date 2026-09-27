"""
ai-reasoning/rapid_damage_assessment/change_detection_prompt.py
Gemini Vision prompt builder and result parser for post-event damage detection.

Design constraints (strict zero-hallucination grounding):
    - Gemini is asked to describe ONLY visually apparent changes.
    - It MUST NOT invent severity numbers or damage percentages.
    - Every observation must be tied to a visible feature in the imagery.
    - Output is structured JSON only.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Literal

logger = logging.getLogger(__name__)


CHANGE_DETECTION_SYSTEM_PROMPT = """You are a remote-sensing analysis assistant supporting a disaster damage assessment system.
You will be shown TWO satellite imagery tiles of the same location:
    Image 1: PRE-EVENT (before cyclone landfall)
    Image 2: POST-EVENT (after cyclone landfall)

Your task is to identify visually apparent changes between the two images that are consistent with cyclone-induced damage.

STRICT RULES — you MUST follow all of them:
1. Describe ONLY changes that are clearly visible in the imagery. Do NOT infer, extrapolate, or guess.
2. Do NOT fabricate damage statistics, percentages, or severity numbers.
3. If you cannot see a clear change, say "no visible change detected" for that category.
4. Do NOT reference anything outside of what the images show.
5. Respond ONLY with a valid JSON object matching the schema below. No prose, no explanations outside the JSON.

OUTPUT SCHEMA (respond ONLY with this JSON, no other text):
{
  "visible_change_detected": true | false,
  "damage_observations": [
    {
      "category": "roof_loss" | "flooding_extent" | "road_blockage" | "vegetation_debris" | "structural_collapse" | "other",
      "description": "<one sentence describing what is visually different>",
      "spatial_extent": "localized" | "widespread",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "overall_damage_signal": "none" | "minor" | "moderate" | "severe" | "collapse",
  "confidence_overall": "high" | "medium" | "low",
  "caveat": "<one sentence noting any image quality issues that limit analysis, or 'None'>"
}
"""


@dataclass
class DamageObservation:
    """Single observed change category from satellite imagery."""
    category: str
    description: str
    spatial_extent: Literal["localized", "widespread"]
    confidence: Literal["high", "medium", "low"]


@dataclass
class ChangeDetectionResult:
    """
    Parsed output from Gemini Vision change-detection analysis.

    Attributes:
        visible_change_detected: Whether any change was seen.
        damage_observations: List of specific observed changes.
        overall_damage_signal: Gemini's overall visual damage estimate.
        confidence_overall: Confidence in the overall estimate.
        caveat: Any image quality or analysis caveats.
        raw_response: Raw Gemini API response text for audit trail.
    """
    visible_change_detected: bool
    damage_observations: list[DamageObservation]
    overall_damage_signal: str
    confidence_overall: str
    caveat: str
    raw_response: str


def build_change_detection_prompt(asset_class: str, district_id: str) -> str:
    """
    Build the user-turn prompt for Gemini, with context about the asset being assessed.

    Args:
        asset_class: Asset type (e.g., "wood_power_pole").
        district_id: District identifier for geographic context.

    Returns:
        User-turn prompt string.
    """
    return (
        f"District: {district_id}\n"
        f"Asset class: {asset_class}\n\n"
        "Image 1 (provided first) = PRE-EVENT satellite tile.\n"
        "Image 2 (provided second) = POST-EVENT satellite tile.\n\n"
        "Perform a change detection analysis following the schema in your instructions. "
        "Focus on changes relevant to this asset class. "
        "Respond ONLY with the JSON schema — no additional text."
    )


def parse_change_detection_response(raw_text: str) -> ChangeDetectionResult:
    """
    Parse Gemini's JSON response into a ChangeDetectionResult.

    Handles partial JSON or markdown-fenced JSON gracefully.

    Args:
        raw_text: Raw text output from Gemini.

    Returns:
        ChangeDetectionResult. Falls back to a safe 'unknown' result on parse failure.
    """
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?", "", raw_text).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract the first {...} block
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                data = {}
        else:
            data = {}

    observations = []
    for obs in data.get("damage_observations", []):
        if isinstance(obs, dict):
            observations.append(
                DamageObservation(
                    category=obs.get("category", "other"),
                    description=obs.get("description", "No description."),
                    spatial_extent=obs.get("spatial_extent", "localized"),
                    confidence=obs.get("confidence", "low"),
                )
            )

    return ChangeDetectionResult(
        visible_change_detected=bool(data.get("visible_change_detected", False)),
        damage_observations=observations,
        overall_damage_signal=data.get("overall_damage_signal", "none"),
        confidence_overall=data.get("confidence_overall", "low"),
        caveat=data.get("caveat", "Could not parse response from model."),
        raw_response=raw_text,
    )


def run_change_detection(
    image_pair: "image_pair_fetch.ImagePair",  # type: ignore[name-defined]  # noqa: F821
    gemini_client: Any,  # google.generativeai.GenerativeModel
) -> ChangeDetectionResult:
    """
    Execute Gemini Vision change detection on a pre/post image pair.

    Args:
        image_pair: ImagePair instance with pre/post PNG bytes.
        gemini_client: Configured google.generativeai.GenerativeModel instance.

    Returns:
        ChangeDetectionResult with parsed damage observations.
    """
    from typing import Any  # noqa: PLC0415 (local import)
    import google.generativeai as genai  # type: ignore

    user_prompt = build_change_detection_prompt(
        asset_class="infrastructure_asset",
        district_id=image_pair.district_id,
    )

    # Construct multimodal message parts
    pre_image_part = {
        "inline_data": {
            "mime_type": "image/png",
            "data": __import__("base64").b64encode(image_pair.pre_event_bytes).decode(),
        }
    }
    post_image_part = {
        "inline_data": {
            "mime_type": "image/png",
            "data": __import__("base64").b64encode(image_pair.post_event_bytes).decode(),
        }
    }

    try:
        response = gemini_client.generate_content(
            [pre_image_part, post_image_part, user_prompt],
            generation_config={"temperature": 0.0},
        )
        raw_text = response.text
    except Exception as exc:
        logger.error("Gemini change detection API call failed: %s", exc)
        raw_text = json.dumps({
            "visible_change_detected": False,
            "damage_observations": [],
            "overall_damage_signal": "none",
            "confidence_overall": "low",
            "caveat": f"Gemini API unavailable: {exc}",
        })

    result = parse_change_detection_response(raw_text)
    logger.info(
        "Change detection complete for district=%s. "
        "Damage signal: %s (confidence: %s).",
        image_pair.district_id,
        result.overall_damage_signal,
        result.confidence_overall,
    )
    return result
