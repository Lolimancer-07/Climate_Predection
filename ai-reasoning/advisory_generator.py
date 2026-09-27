"""
ai-reasoning/advisory_generator.py
Orchestrates: structured risk data → Gemini → advisory object.
"""
import json
from dataclasses import dataclass
from typing import Optional
from ai_reasoning.gemini_client import generate_text, generate_multimodal, load_prompt_template
from ai_reasoning.validate_output import validate_advisory_numerics


@dataclass
class AdvisoryDraft:
    ward_id: str
    event_id: str
    severity_tier: str          # Watch | Warning | Evacuation Order
    content_en: str
    content_local: str
    consistency_check_notes: str
    validation_passed: bool
    validation_warnings: list[str]
    generated_by: str = "gemini-2.0-flash"
    risk_payload_hash: str = ""


def generate_advisory(
    risk_payload: dict,
    severity_tier: str,
    local_language: str = "Odia",
    map_image_bytes: Optional[bytes] = None,
) -> AdvisoryDraft:
    """
    Full pipeline:
    1. (Optional) Multimodal consistency check if map image provided
    2. Risk narrative + advisory drafting
    3. Numeric consistency validation
    """
    ward_id = risk_payload.get("ward_id", "UNKNOWN")
    event_id = risk_payload.get("event_id", "UNKNOWN")

    # ── Step 1: Consistency check (multimodal if image available) ────────────
    consistency_notes = ""
    if map_image_bytes:
        sys_prompt = load_prompt_template("consistency_check")
        user_content = f"Structured hazard payload:\n```json\n{json.dumps(risk_payload, indent=2)}\n```"
        consistency_notes = generate_multimodal(
            system_prompt=sys_prompt,
            user_text=user_content,
            image_bytes=map_image_bytes,
        )
    else:
        consistency_notes = "No map image provided; visual consistency check skipped."

    # ── Step 2: Advisory draft (English) ────────────────────────────────────
    adv_sys = load_prompt_template("advisory_draft")
    adv_user = (
        f"Risk payload:\n```json\n{json.dumps(risk_payload, indent=2)}\n```\n\n"
        f"severity_tier: \"{severity_tier}\"\n"
        f"Output language: English and {local_language}."
    )
    full_advisory = generate_text(adv_sys, adv_user)

    # Split English / local sections (expect model to use markers)
    content_en, content_local = _split_bilingual(full_advisory, local_language)

    # ── Step 3: Numeric validation ───────────────────────────────────────────
    validation_ok, warnings = validate_advisory_numerics(content_en, risk_payload)

    return AdvisoryDraft(
        ward_id=ward_id,
        event_id=event_id,
        severity_tier=severity_tier,
        content_en=content_en,
        content_local=content_local,
        consistency_check_notes=consistency_notes,
        validation_passed=validation_ok,
        validation_warnings=warnings,
    )


def generate_trigger_notice(trigger_payload: dict) -> str:
    """Generate a plain-language parametric trigger notification via Gemini."""
    sys_prompt = load_prompt_template("insurance_trigger_notice")
    user_content = f"Trigger record:\n```json\n{json.dumps(trigger_payload, indent=2)}\n```"
    return generate_text(sys_prompt, user_content)


def _split_bilingual(text: str, local_lang: str) -> tuple[str, str]:
    """
    Split Gemini output into English and local-language sections.
    Expects sections marked with '--- ENGLISH ---' and '--- {LANG} ---' headers.
    Falls back gracefully if markers are absent.
    """
    upper = text.upper()
    lang_marker = f"--- {local_lang.upper()} ---"
    en_marker = "--- ENGLISH ---"

    if en_marker in upper and lang_marker in upper:
        parts = text.split(lang_marker, 1)
        en_part = parts[0].replace(en_marker, "").strip()
        local_part = parts[1].strip()
        return en_part, local_part

    # Fallback: return full text as English, empty as local
    return text.strip(), f"[{local_lang} translation pending — full pipeline requires bilingual Gemini output]"
