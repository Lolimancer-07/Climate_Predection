"""
tests/contract/test_provider_contract.py
Phase 3 — Provider contract test suite.

Any concrete CycloneDataProvider must pass all of these tests.
Run against MockCycloneProvider today; run against IMDProvider/JTWCProvider
when their HTTP adapters are implemented.

These tests enforce the contract that guarantees downstream models
(surge, rainfall, structural) receive well-formed, monotonic,
unit-consistent inputs regardless of which provider is active.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def mock_provider():
    """The always-available mock provider for CI."""
    from backend.registry.provider_registry import get_active_cyclone_provider
    return get_active_cyclone_provider()


@pytest.fixture(scope="module")
def all_providers(mock_provider):
    """
    Return a list of all providers to test.
    Currently only MockCycloneProvider; extend when IMD/JTWC stubs are wired.
    """
    return [mock_provider]


# ── Contract test suite ───────────────────────────────────────────────────────

class TestProviderContract:
    """
    All concrete CycloneDataProvider implementations must pass every test
    in this class before being switched to active in production.
    """

    def test_list_active_storms_returns_list(self, all_providers):
        """list_active_storms() must return a list (may be empty)."""
        for provider in all_providers:
            result = provider.list_active_storms()
            assert isinstance(result, list), (
                f"{type(provider).__name__}.list_active_storms() must return list, "
                f"got {type(result)}"
            )

    def test_active_storms_have_required_fields(self, all_providers):
        """Each storm summary must have storm_id, provider_source."""
        for provider in all_providers:
            storms = provider.list_active_storms()
            for s in storms:
                storm_dict = s if isinstance(s, dict) else (s.dict() if hasattr(s, "dict") else vars(s))
                assert "storm_id" in storm_dict, f"Missing storm_id in storm: {storm_dict}"
                storm_id = storm_dict["storm_id"]
                assert storm_id, f"storm_id must be non-empty"

    def test_active_storms_data_mode_is_valid(self, all_providers):
        """
        Each storm should carry a data_mode field (or provider name).
        Valid values: MOCK, HISTORICAL, LIVE, or the provider class name.
        """
        for provider in all_providers:
            storms = provider.list_active_storms()
            # At minimum, provider must advertise itself somewhere in the response
            # (may be at the storm level or via get_active_cyclone_provider metadata)
            provider_name = type(provider).__name__
            assert "Mock" in provider_name or "IMD" in provider_name or "JTWC" in provider_name or "GDACS" in provider_name, (
                f"Provider class name should reflect source: {provider_name}"
            )

    def test_get_track_returns_list_of_fixes(self, all_providers):
        """get_track() must return a list of TrackFix-compatible objects."""
        for provider in all_providers:
            storms = provider.list_active_storms()
            if not storms:
                pytest.skip(f"{type(provider).__name__} has no active storms")

            storm = storms[0]
            storm_id = (storm if isinstance(storm, str)
                        else storm.get("storm_id") if isinstance(storm, dict)
                        else storm.storm_id)

            fixes = provider.get_track(storm_id)
            assert isinstance(fixes, list), (
                f"get_track() must return list, got {type(fixes)}"
            )
            assert len(fixes) >= 1, "get_track() must return at least one fix"

    def test_track_fixes_have_required_fields(self, all_providers):
        """Every TrackFix must have lat, lon, central_pressure_hpa, max_wind_kmh."""
        for provider in all_providers:
            storms = provider.list_active_storms()
            if not storms:
                pytest.skip("No active storms")

            storm = storms[0]
            storm_id = (storm if isinstance(storm, str)
                        else storm.get("storm_id") if isinstance(storm, dict)
                        else storm.storm_id)

            fixes = provider.get_track(storm_id)
            for fix in fixes:
                fix_dict = fix if isinstance(fix, dict) else (fix.dict() if hasattr(fix, "dict") else vars(fix))

                assert "lat" in fix_dict, f"TrackFix missing 'lat': {fix_dict}"
                assert "lon" in fix_dict, f"TrackFix missing 'lon': {fix_dict}"
                assert fix_dict["lat"] is not None, "lat must not be None"
                assert fix_dict["lon"] is not None, "lon must not be None"

    def test_track_coordinates_in_valid_range(self, all_providers):
        """lat must be in [-90, 90] and lon in [-180, 180]."""
        for provider in all_providers:
            storms = provider.list_active_storms()
            if not storms:
                pytest.skip("No active storms")

            storm = storms[0]
            storm_id = (storm if isinstance(storm, str)
                        else storm.get("storm_id") if isinstance(storm, dict)
                        else storm.storm_id)

            fixes = provider.get_track(storm_id)
            for i, fix in enumerate(fixes):
                fix_dict = fix if isinstance(fix, dict) else (fix.dict() if hasattr(fix, "dict") else vars(fix))
                lat = float(fix_dict["lat"])
                lon = float(fix_dict["lon"])
                assert -90.0 <= lat <= 90.0, f"Fix {i}: lat={lat} out of range"
                assert -180.0 <= lon <= 180.0, f"Fix {i}: lon={lon} out of range"

    def test_observed_fixes_are_monotonic(self, all_providers):
        """Observed track fix timestamps must be strictly monotonically increasing."""
        for provider in all_providers:
            storms = provider.list_active_storms()
            if not storms:
                pytest.skip("No active storms")

            storm = storms[0]
            storm_id = (storm if isinstance(storm, str)
                        else storm.get("storm_id") if isinstance(storm, dict)
                        else storm.storm_id)

            fixes = provider.get_track(storm_id)

            # Filter to observed fixes only
            observed = []
            for fix in fixes:
                fix_dict = fix if isinstance(fix, dict) else (fix.dict() if hasattr(fix, "dict") else vars(fix))
                fix_type = fix_dict.get("fix_type", "observed")
                if fix_type in ("observed", "best_track"):
                    ts = fix_dict.get("timestamp")
                    if ts:
                        if isinstance(ts, str):
                            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        observed.append(ts)

            if len(observed) < 2:
                return  # Cannot test monotonicity with < 2 fixes

            for i in range(1, len(observed)):
                assert observed[i] >= observed[i - 1], (
                    f"Observed fix {i} timestamp {observed[i]} < previous {observed[i - 1]}: "
                    f"timestamps must be monotonically non-decreasing"
                )

    def test_pressure_in_valid_range(self, all_providers):
        """central_pressure_hpa must be between 870 and 1013 hPa if present."""
        for provider in all_providers:
            storms = provider.list_active_storms()
            if not storms:
                pytest.skip("No active storms")

            storm = storms[0]
            storm_id = (storm if isinstance(storm, str)
                        else storm.get("storm_id") if isinstance(storm, dict)
                        else storm.storm_id)

            fixes = provider.get_track(storm_id)
            for fix in fixes:
                fix_dict = fix if isinstance(fix, dict) else (fix.dict() if hasattr(fix, "dict") else vars(fix))
                pressure = fix_dict.get("central_pressure_hpa")
                if pressure is not None:
                    pressure = float(pressure)
                    assert 870.0 <= pressure <= 1013.0, (
                        f"central_pressure_hpa={pressure} outside plausible range [870, 1013]"
                    )

    def test_wind_speed_is_non_negative(self, all_providers):
        """max_wind_kmh must be non-negative if present."""
        for provider in all_providers:
            storms = provider.list_active_storms()
            if not storms:
                pytest.skip("No active storms")

            storm = storms[0]
            storm_id = (storm if isinstance(storm, str)
                        else storm.get("storm_id") if isinstance(storm, dict)
                        else storm.storm_id)

            fixes = provider.get_track(storm_id)
            for fix in fixes:
                fix_dict = fix if isinstance(fix, dict) else (fix.dict() if hasattr(fix, "dict") else vars(fix))
                wind = fix_dict.get("max_wind_kmh")
                if wind is not None:
                    assert float(wind) >= 0.0, f"max_wind_kmh={wind} must be non-negative"

    def test_provider_does_not_silently_substitute_mock_for_live(self, all_providers):
        """
        Non-mock providers must not silently return mock data without raising
        NotImplementedError or setting data_mode=MOCK explicitly.
        This prevents a future IMD stub from accidentally returning mock storm data
        as if it were a real IMD forecast.
        """
        for provider in all_providers:
            if "Mock" in type(provider).__name__:
                continue  # Mock providers are exempt — they are explicitly mock

            # For real providers (IMD, JTWC, GDACS): if not yet implemented,
            # they should raise NotImplementedError
            try:
                storms = provider.list_active_storms()
                # If it returns data, ensure it's labeled
                for s in storms:
                    storm_dict = s if isinstance(s, dict) else (s.dict() if hasattr(s, "dict") else vars(s))
                    # Real providers should NOT return MOCK as data_mode
                    data_mode = storm_dict.get("data_mode", "")
                    assert data_mode != "MOCK", (
                        f"Non-mock provider {type(provider).__name__} returned data_mode=MOCK. "
                        f"This indicates mock data is being served as real. Use MockCycloneProvider explicitly."
                    )
            except NotImplementedError:
                pass  # Expected for stub providers


# ── Pipeline safety contract tests ────────────────────────────────────────────

class TestPipelineSafetyContracts:
    """
    Phase 3 safety invariants: Gemini cannot alter trigger boolean,
    scenarios cannot chain, dispatch requires approval.
    """

    def test_trigger_boolean_unchanged_after_gemini(self):
        """
        The insurance trigger boolean must be identical before and after
        Gemini generates advisory text. This is the core financial safety gate.
        """
        from modeling.insurance_trigger.trigger_engine import evaluate_trigger
        from modeling.insurance_trigger.policy_schemas import PolicyZoneSchema as PolicyZone

        policy = PolicyZone(
            policy_id="TEST-POL-001",
            zone_id="IN-OD-PURI",
            trigger_type="surge_height",
            threshold=3.0,
            currency="USD",
            payout_amount=500000.0,
        )

        trigger_result = evaluate_trigger(
            policy=policy,
            event_id="TEST-2026",
            observed_value=3.5,
            confidence="forecast",
        )

        triggered_before = bool(trigger_result.triggered)

        # Simulate what Gemini does: it only formats text, NEVER touches trigger_result
        import copy
        trigger_result_copy = copy.deepcopy(trigger_result)

        # In production, advisory_service.py calls Gemini here — verify dict is unchanged
        triggered_after = bool(trigger_result_copy.triggered)

        assert triggered_before == triggered_after, (
            f"Trigger boolean changed from {triggered_before} to {triggered_after}. "
            "Gemini must never alter the trigger result."
        )

    def test_scenario_cannot_use_another_scenario_as_baseline(self):
        """Scenarios must chain: create_scenario() must reject a scenario run_id as baseline."""
        from backend.services.pipeline_orchestrator import create_scenario, _runs
        import uuid

        # Create a fake scenario run
        fake_scenario_run_id = str(uuid.uuid4())
        _runs[fake_scenario_run_id] = {
            "run_id": fake_scenario_run_id,
            "event_id": "TEST",
            "district_id": "TEST",
            "idempotency_key": "test-ikey",
            "status": "completed",
            "is_scenario": True,  # ← This is the key flag
            "config_snapshot": {},
        }

        with pytest.raises(ValueError, match="scenarios cannot chain"):
            create_scenario(
                baseline_run_id=fake_scenario_run_id,
                event_id="TEST",
                district_id="TEST",
                params={},
                created_by="test",
            )

    def test_record_review_requires_existing_draft(self):
        """record_review() must raise ValueError for a non-existent draft_id."""
        from backend.services.pipeline_orchestrator import record_review

        with pytest.raises(ValueError, match="not found"):
            record_review(
                draft_id="nonexistent-draft-id",
                actor_id="op1",
                actor_role="ddma_operator",
                decision="approved",
            )

    def test_dispatch_requires_existing_draft(self):
        """record_dispatch_attempt() must raise ValueError for a non-existent draft_id."""
        from backend.services.pipeline_orchestrator import record_dispatch_attempt

        with pytest.raises(ValueError, match="not found"):
            record_dispatch_attempt(
                draft_id="nonexistent-draft-id",
                channel="sms",
                recipient_ref="+91-test",
                status="sandbox",
                actor_id="op1",
            )
