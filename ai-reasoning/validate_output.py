"""
ai-reasoning/validate_output.py
Post-generation numeric consistency validator.

Every Gemini-generated advisory must pass this check before entering
the human-review queue. Any numeric value in the advisory text must
be traceable to the source risk payload.
"""
import re
from typing import Any


def extract_numbers_from_text(text: str) -> list[float]:
    """Extract all numeric values from advisory text."""
    # Match decimals before integers to avoid splitting e.g. '4.7' into '4' and '7'
    pattern = r"\b\d+\.\d+|\b\d+\b"
    return [float(m) for m in re.findall(pattern, text)]


def extract_source_numbers(payload: dict[str, Any], depth: int = 0) -> set[float]:
    """Recursively extract all numeric values from the source JSON payload."""
    numbers: set[float] = set()
    if depth > 5:
        return numbers
    if isinstance(payload, dict):
        for v in payload.values():
            numbers |= extract_source_numbers(v, depth + 1)
    elif isinstance(payload, (list, tuple)):
        for item in payload:
            numbers |= extract_source_numbers(item, depth + 1)
    elif isinstance(payload, (int, float)):
        numbers.add(float(payload))
    return numbers


def is_number_grounded(n: float, source_numbers: set[float], tolerance: float = 0.05) -> bool:
    """
    Check if n is within tolerance of any number in source_numbers,
    OR is a plausible derived value (rounding, unit conversion).
    """
    for s in source_numbers:
        if abs(n - s) <= tolerance * max(abs(s), 1.0):
            return True
        # Allow population in thousands (e.g., "12,000" → 12.0)
        if abs(n * 1000 - s) <= tolerance * max(abs(s), 1.0):
            return True
        if abs(n / 1000 - s) <= tolerance * max(abs(s), 1.0):
            return True
    return False


# Numbers that are always allowed (page numbers, years, common ordinals, hours)
ALWAYS_ALLOWED = {
    1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0,
    12.0, 24.0, 36.0, 48.0, 72.0, 96.0, 100.0,
    2019.0, 2020.0, 2021.0, 2022.0, 2023.0, 2024.0, 2025.0, 2026.0,
}


def validate_advisory_numerics(
    advisory_text: str,
    source_payload: dict[str, Any],
    tolerance: float = 0.05,
) -> tuple[bool, list[str]]:
    """
    Validate that all numeric values in advisory_text are present in source_payload.

    Returns:
        (passed: bool, warnings: list[str])
        warnings is empty if all numbers are grounded.
    """
    source_numbers = extract_source_numbers(source_payload)
    advisory_numbers = extract_numbers_from_text(advisory_text)
    warnings = []

    for n in advisory_numbers:
        if n in ALWAYS_ALLOWED:
            continue
        if not is_number_grounded(n, source_numbers, tolerance):
            warnings.append(
                f"Ungrounded number detected: {n} — not found in source payload. "
                f"This may be a hallucinated value."
            )

    passed = len(warnings) == 0
    return passed, warnings
