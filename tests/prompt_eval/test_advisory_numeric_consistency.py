"""
tests/prompt_eval/test_advisory_numeric_consistency.py
Validates that Gemini advisory output contains only numbers grounded in the source payload.
A failing test here blocks the advisory from the human-review queue.
"""
import pytest
from ai_reasoning.validate_output import validate_advisory_numerics


SAMPLE_PAYLOAD = {
    "ward_id": "WARD-07",
    "ward_name": "Ward 7, Puri",
    "population": 12000,
    "surge_height_m": 2.4,
    "rainfall_mm_48h": 280.0,
    "wind_speed_kmh": 215.0,
    "severity_tier": "Warning",
    "event_id": "CYCLONE-FANI-2019",
}


class TestGroundedAdvisory:
    def test_all_payload_numbers_pass(self):
        """Advisory text that only uses numbers from the payload passes."""
        advisory = (
            "WARNING — Ward 7, Puri District. Surge height 2.4m expected. "
            "Rainfall forecast: 280.0mm over 48h. Wind speed: 215.0 km/h. "
            "Population in affected zone: 12000."
        )
        passed, warnings = validate_advisory_numerics(advisory, SAMPLE_PAYLOAD)
        assert passed, f"Validation failed unexpectedly: {warnings}"

    def test_hallucinated_number_fails(self):
        """Advisory text with a number not in the payload fails validation."""
        advisory = (
            "WARNING — Ward 7. Surge height 4.7m expected. Population: 12000."
        )
        passed, warnings = validate_advisory_numerics(advisory, SAMPLE_PAYLOAD)
        assert not passed
        assert any("4.7" in w for w in warnings)

    def test_rounding_is_allowed(self):
        """Numbers rounded to nearest whole unit should not fail."""
        advisory = "Surge height approximately 2m. Rainfall 280mm."
        passed, warnings = validate_advisory_numerics(advisory, SAMPLE_PAYLOAD)
        assert passed, f"Rounding should be allowed: {warnings}"

    def test_year_numbers_allowed(self):
        """Year references like 2019 should not fail as always-allowed."""
        advisory = "Cyclone Fani in 2019. Population: 12000."
        passed, warnings = validate_advisory_numerics(advisory, SAMPLE_PAYLOAD)
        assert passed

    def test_empty_advisory_passes(self):
        passed, warnings = validate_advisory_numerics("", SAMPLE_PAYLOAD)
        assert passed
        assert warnings == []

    def test_multiple_hallucinations_all_reported(self):
        advisory = "Surge 9.9m, rainfall 999mm, population 12000."
        passed, warnings = validate_advisory_numerics(advisory, SAMPLE_PAYLOAD)
        assert not passed
        assert len(warnings) >= 1
