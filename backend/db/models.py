"""
backend/db/models.py
SQLAlchemy ORM models — Phase 2/3 expansion.
Adds: PipelineRun, PipelineStage, AdvisoryDraft, AdvisoryReview,
       DispatchAttempt, Scenario, ScenarioOutput
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Numeric, Integer,
    ForeignKey, TIMESTAMP, func, JSON,
)
from sqlalchemy.dialects.postgresql import JSONB
from geoalchemy2 import Geometry
from backend.db.session import Base


def _uuid():
    return str(uuid.uuid4())


# ── Phase 1 models (unchanged) ────────────────────────────────────────────────

class District(Base):
    __tablename__ = "districts"

    district_id = Column(String, primary_key=True, default=_uuid)
    country = Column(String, nullable=False)
    name = Column(String, nullable=False)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)


class Ward(Base):
    __tablename__ = "wards"

    ward_id = Column(String, primary_key=True, default=_uuid)
    district_id = Column(String, ForeignKey("districts.district_id"), nullable=False)
    name = Column(String, nullable=False)
    population = Column(Integer, nullable=True)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)


class CycloneEvent(Base):
    __tablename__ = "cyclone_events"

    event_id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=True)
    source = Column(String, nullable=True)          # IMD | JTWC | GDACS | mock
    category = Column(String, nullable=True)
    eta = Column(TIMESTAMP(timezone=True), nullable=True)
    track_geom = Column(Geometry("LINESTRING", srid=4326), nullable=True)
    ingested_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class HazardPolygon(Base):
    __tablename__ = "hazard_polygons"

    hazard_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("cyclone_events.event_id"), nullable=False)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=True)
    hazard_type = Column(String, nullable=False)    # surge | rainfall_flood
    severity_class = Column(String, nullable=True)
    attribute_value = Column(Numeric, nullable=True)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)
    model_version = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class InfrastructureAsset(Base):
    __tablename__ = "infrastructure_assets"

    asset_id = Column(String, primary_key=True, default=_uuid)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=True)
    asset_type = Column(String, nullable=False)
    name = Column(String, nullable=True)
    criticality = Column(Numeric, nullable=True)
    geom = Column(Geometry(srid=4326), nullable=True)


class ExposureScore(Base):
    __tablename__ = "exposure_scores"

    score_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("cyclone_events.event_id"), nullable=False)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=False)
    surge_exposure = Column(Numeric, nullable=True)
    rainfall_exposure = Column(Numeric, nullable=True)
    combined_score = Column(Numeric, nullable=True)
    computed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Advisory(Base):
    __tablename__ = "advisories"

    advisory_id = Column(String, primary_key=True, default=_uuid)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=True)
    event_id = Column(String, ForeignKey("cyclone_events.event_id"), nullable=False)
    severity_tier = Column(String, nullable=False)
    content_en = Column(Text, nullable=False)
    content_local = Column(Text, nullable=True)
    validation_passed = Column(Boolean, default=False)
    status = Column(String, default="draft")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class DispatchLog(Base):
    __tablename__ = "dispatch_logs"

    log_id = Column(String, primary_key=True, default=_uuid)
    advisory_id = Column(String, ForeignKey("advisories.advisory_id"), nullable=False)
    channel = Column(String, nullable=False)
    recipient = Column(String, nullable=False)
    status = Column(String, nullable=False)
    dispatched_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ── Phase 2 models (new) ──────────────────────────────────────────────────────

class PipelineRun(Base):
    """Durable record of every pipeline execution attempt."""
    __tablename__ = "pipeline_runs"

    run_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, nullable=False)
    district_id = Column(String, nullable=False)
    idempotency_key = Column(String, unique=True, nullable=False)
    status = Column(String, nullable=False, default="queued")
    provider = Column(String, nullable=False, default="mock")
    provider_freshness_s = Column(Integer, nullable=True)
    # JSON column for config (use JSON for SQLite compat, JSONB for Postgres)
    config_snapshot = Column(JSON, nullable=False, default=dict)
    is_scenario = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)


class PipelineStage(Base):
    """One record per stage of a pipeline run."""
    __tablename__ = "pipeline_stages"

    stage_id = Column(String, primary_key=True, default=_uuid)
    run_id = Column(String, ForeignKey("pipeline_runs.run_id", ondelete="CASCADE"), nullable=False)
    stage_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="queued")
    started_at = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    error = Column(Text, nullable=True)
    model_name = Column(String, nullable=True)
    model_version = Column(String, nullable=True)
    output_ref = Column(String, nullable=True)


class AdvisoryDraft(Base):
    """Gemini-generated advisory draft waiting for human review."""
    __tablename__ = "advisory_drafts"

    draft_id = Column(String, primary_key=True, default=_uuid)
    run_id = Column(String, ForeignKey("pipeline_runs.run_id"), nullable=True)
    event_id = Column(String, nullable=False)
    district_id = Column(String, nullable=False)
    draft_text = Column(Text, nullable=False)
    evidence_json = Column(JSON, nullable=False, default=dict)
    grounding_passed = Column(Boolean, nullable=False, default=False)
    grounding_failures = Column(JSON, nullable=True)
    # pending | approved | rejected | dispatched
    status = Column(String, nullable=False, default="pending")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class AdvisoryReview(Base):
    """Human operator review decision for an advisory draft."""
    __tablename__ = "advisory_reviews"

    review_id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, ForeignKey("advisory_drafts.draft_id"), nullable=False)
    actor_role = Column(String, nullable=False)
    actor_id = Column(String, nullable=False)
    # approved | rejected | edited
    decision = Column(String, nullable=False)
    edited_text = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    reviewed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class DispatchAttempt(Base):
    """One record per channel per dispatch action — the canonical dispatch audit trail."""
    __tablename__ = "dispatch_attempts"

    attempt_id = Column(String, primary_key=True, default=_uuid)
    draft_id = Column(String, ForeignKey("advisory_drafts.draft_id"), nullable=False)
    channel = Column(String, nullable=False)
    recipient_ref = Column(String, nullable=False)
    # sent | failed | sandbox
    status = Column(String, nullable=False)
    provider_response = Column(JSON, nullable=True)
    actor_id = Column(String, nullable=True)
    event_id = Column(String, nullable=True)
    run_id = Column(String, nullable=True)
    dispatched_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ── Phase 3 models (scenario immutability) ────────────────────────────────────

class Scenario(Base):
    """Immutable parameter set applied over a baseline pipeline run."""
    __tablename__ = "scenarios"

    scenario_id = Column(String, primary_key=True, default=_uuid)
    baseline_run_id = Column(String, ForeignKey("pipeline_runs.run_id"), nullable=False)
    event_id = Column(String, nullable=False)
    district_id = Column(String, nullable=False)
    params = Column(JSON, nullable=False, default=dict)
    label = Column(String, nullable=True)
    created_by = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    status = Column(String, nullable=False, default="queued")


class ScenarioOutput(Base):
    """Results of running scenario pipeline stages."""
    __tablename__ = "scenario_outputs"

    output_id = Column(String, primary_key=True, default=_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.scenario_id", ondelete="CASCADE"), nullable=False)
    stage_name = Column(String, nullable=False)
    result_json = Column(JSON, nullable=False, default=dict)
    model_version = Column(String, nullable=False)
    computed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
