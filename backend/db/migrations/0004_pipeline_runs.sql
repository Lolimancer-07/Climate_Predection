-- ============================================================
-- Alembic-compatible migration: 0004_pipeline_runs
-- Adds durable pipeline run state, advisory review queue,
-- and dispatch history tables.
-- Run with: psql -U $PGUSER -d $PGDB -f 0004_pipeline_runs.sql
-- ============================================================

-- Pipeline run lifecycle
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id              TEXT PRIMARY KEY,
    event_id            TEXT NOT NULL,
    district_id         TEXT NOT NULL,
    idempotency_key     TEXT UNIQUE NOT NULL,
    status              TEXT NOT NULL DEFAULT 'queued',
    provider            TEXT NOT NULL DEFAULT 'mock',
    provider_freshness_s INTEGER,
    config_snapshot     JSONB NOT NULL DEFAULT '{}',
    is_scenario         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_event_id ON pipeline_runs(event_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);

-- Per-stage records
CREATE TABLE IF NOT EXISTS pipeline_stages (
    stage_id            TEXT PRIMARY KEY,
    run_id              TEXT NOT NULL REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    stage_name          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'queued',
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    error               TEXT,
    model_name          TEXT,
    model_version       TEXT,
    output_ref          TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_run_id ON pipeline_stages(run_id);

-- Advisory drafts (output of AI reasoning, waiting for human review)
CREATE TABLE IF NOT EXISTS advisory_drafts (
    draft_id            TEXT PRIMARY KEY,
    run_id              TEXT REFERENCES pipeline_runs(run_id),
    event_id            TEXT NOT NULL,
    district_id         TEXT NOT NULL,
    draft_text          TEXT NOT NULL,
    evidence_json       JSONB NOT NULL DEFAULT '{}',
    grounding_passed    BOOLEAN NOT NULL DEFAULT false,
    grounding_failures  JSONB,
    status              TEXT NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_drafts_run_id ON advisory_drafts(run_id);
CREATE INDEX IF NOT EXISTS idx_advisory_drafts_status ON advisory_drafts(status);

-- Human review decisions
CREATE TABLE IF NOT EXISTS advisory_reviews (
    review_id           TEXT PRIMARY KEY,
    draft_id            TEXT NOT NULL REFERENCES advisory_drafts(draft_id),
    actor_role          TEXT NOT NULL,
    actor_id            TEXT NOT NULL,
    decision            TEXT NOT NULL,  -- approved | rejected | edited
    edited_text         TEXT,
    reason              TEXT,
    reviewed_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisory_reviews_draft_id ON advisory_reviews(draft_id);

-- Dispatch attempts (one row per channel per dispatch action)
CREATE TABLE IF NOT EXISTS dispatch_attempts (
    attempt_id          TEXT PRIMARY KEY,
    draft_id            TEXT NOT NULL REFERENCES advisory_drafts(draft_id),
    channel             TEXT NOT NULL,  -- sms | whatsapp | cap_xml | pdf | insurer_webhook
    recipient_ref       TEXT NOT NULL,
    status              TEXT NOT NULL,  -- sent | failed | sandbox
    provider_response   JSONB,
    actor_id            TEXT,
    event_id            TEXT,
    run_id              TEXT,
    dispatched_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_attempts_draft_id ON dispatch_attempts(draft_id);

-- Scenario runs (immutable parameter sets applied to a baseline run)
CREATE TABLE IF NOT EXISTS scenarios (
    scenario_id         TEXT PRIMARY KEY,
    baseline_run_id     TEXT NOT NULL REFERENCES pipeline_runs(run_id),
    event_id            TEXT NOT NULL,
    district_id         TEXT NOT NULL,
    params              JSONB NOT NULL DEFAULT '{}',
    label               TEXT,
    created_by          TEXT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    status              TEXT NOT NULL DEFAULT 'queued'
);

CREATE TABLE IF NOT EXISTS scenario_outputs (
    output_id           TEXT PRIMARY KEY,
    scenario_id         TEXT NOT NULL REFERENCES scenarios(scenario_id) ON DELETE CASCADE,
    stage_name          TEXT NOT NULL,
    result_json         JSONB NOT NULL DEFAULT '{}',
    model_version       TEXT NOT NULL,
    computed_at         TIMESTAMPTZ DEFAULT now()
);
