-- =============================================================================
-- Cyclone Anticipatory Action Platform
-- PostgreSQL + PostGIS Database Schema
-- Bay of Bengal & Coastal APAC
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Districts & Jurisdictions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS districts (
    district_id     TEXT PRIMARY KEY,
    country         TEXT NOT NULL,
    name            TEXT NOT NULL,
    state_province  TEXT,
    geom            GEOMETRY(MultiPolygon, 4326),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_districts_geom ON districts USING GIST (geom);

-- ── 2. Wards & Local Administrative Units ────────────────────────────────────
CREATE TABLE IF NOT EXISTS wards (
    ward_id         TEXT PRIMARY KEY,
    district_id     TEXT REFERENCES districts(district_id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    ward_number     INTEGER,
    population      INTEGER DEFAULT 0,
    elevation_m     NUMERIC,
    twi_mean        NUMERIC,
    geom            GEOMETRY(MultiPolygon, 4326),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wards_district ON wards (district_id);
CREATE INDEX IF NOT EXISTS idx_wards_geom ON wards USING GIST (geom);

-- ── 3. Cyclone Events & Storm Tracks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cyclone_events (
    event_id        TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    source          TEXT NOT NULL,               -- IMD | JTWC | GDACS | BMD
    basin           TEXT DEFAULT 'BoB',          -- BoB | AS | NIO
    category        TEXT NOT NULL,               -- CS | SCS | VSCS | ESCS | Super
    central_pressure_hpa NUMERIC,
    max_wind_speed_kt    NUMERIC,
    eta             TIMESTAMPTZ,
    landfall_district TEXT,
    track_geom      GEOMETRY(LineString, 4326),
    ingested_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cyclone_events_track ON cyclone_events USING GIST (track_geom);

-- ── 4. Hazard Polygons (Surge & Flash Flood Inundation) ──────────────────────
CREATE TABLE IF NOT EXISTS hazard_polygons (
    hazard_id       TEXT PRIMARY KEY,
    event_id        TEXT REFERENCES cyclone_events(event_id) ON DELETE CASCADE,
    ward_id         TEXT REFERENCES wards(ward_id) ON DELETE SET NULL,
    hazard_type     TEXT NOT NULL,               -- surge | rainfall_flood
    severity_class  TEXT NOT NULL,               -- Low | Medium | High | Severe
    attribute_value NUMERIC NOT NULL,            -- surge height (m) or rainfall (mm)
    inundation_area_km2 NUMERIC,
    geom            GEOMETRY(MultiPolygon, 4326),
    model_version   TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hazard_polygons_event ON hazard_polygons (event_id);
CREATE INDEX IF NOT EXISTS idx_hazard_polygons_ward ON hazard_polygons (ward_id);
CREATE INDEX IF NOT EXISTS idx_hazard_polygons_geom ON hazard_polygons USING GIST (geom);

-- ── 5. Critical Infrastructure Assets ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS infrastructure_assets (
    asset_id        TEXT PRIMARY KEY,
    ward_id         TEXT REFERENCES wards(ward_id) ON DELETE SET NULL,
    asset_type      TEXT NOT NULL,               -- hospital | shelter | road | power_line | substation
    name            TEXT NOT NULL,
    criticality     NUMERIC NOT NULL DEFAULT 1.0, -- 1.0 (baseline) to 5.0 (critical)
    capacity        INTEGER,
    operator        TEXT,
    geom            GEOMETRY(Geometry, 4326),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_ward ON infrastructure_assets (ward_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON infrastructure_assets (asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_geom ON infrastructure_assets USING GIST (geom);

-- ── 6. Exposure Scores ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exposure_scores (
    score_id        TEXT PRIMARY KEY,
    event_id        TEXT REFERENCES cyclone_events(event_id) ON DELETE CASCADE,
    asset_id        TEXT REFERENCES infrastructure_assets(asset_id) ON DELETE CASCADE,
    exposure_score  NUMERIC NOT NULL,            -- 0.0 - 1.0 (hazard intersection)
    priority_score  NUMERIC NOT NULL,            -- exposure_score * criticality
    flagged         BOOLEAN NOT NULL DEFAULT false,
    computed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exposure_scores_event ON exposure_scores (event_id);
CREATE INDEX IF NOT EXISTS idx_exposure_scores_asset ON exposure_scores (asset_id);
CREATE INDEX IF NOT EXISTS idx_exposure_scores_priority ON exposure_scores (priority_score DESC);

-- ── 7. Advisories (Human-in-the-Loop review lifecycle) ────────────────────────
CREATE TABLE IF NOT EXISTS advisories (
    advisory_id     TEXT PRIMARY KEY,
    event_id        TEXT REFERENCES cyclone_events(event_id) ON DELETE CASCADE,
    ward_id         TEXT REFERENCES wards(ward_id) ON DELETE CASCADE,
    severity_tier   TEXT NOT NULL,               -- Watch | Warning | Evacuation Order
    content_en      TEXT NOT NULL,
    content_local   TEXT,
    lead_time_hours INTEGER,
    recommended_shelters JSONB DEFAULT '[]'::jsonb,
    blocked_routes       JSONB DEFAULT '[]'::jsonb,
    generated_by    TEXT DEFAULT 'gemini-3.7-flash',
    validated_grounding BOOLEAN DEFAULT false,
    reviewed_by     TEXT,                        -- DDMA operator user ID
    review_status   TEXT DEFAULT 'pending',      -- pending | approved | rejected | amended
    review_notes    TEXT,
    reviewed_at     TIMESTAMPTZ,
    dispatched_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisories_event ON advisories (event_id);
CREATE INDEX IF NOT EXISTS idx_advisories_ward ON advisories (ward_id);
CREATE INDEX IF NOT EXISTS idx_advisories_status ON advisories (review_status);

-- ── 8. Parametric Insurance Policies & Triggers ──────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_policies (
    policy_id       TEXT PRIMARY KEY,
    zone_id         TEXT NOT NULL,
    insurer_name    TEXT NOT NULL,
    beneficiary     TEXT NOT NULL,
    trigger_type    TEXT NOT NULL,               -- surge_height | rainfall_total | wind_speed
    threshold_value NUMERIC NOT NULL,
    payout_amount_usd NUMERIC NOT NULL,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_zone ON insurance_policies (zone_id);

CREATE TABLE IF NOT EXISTS insurance_triggers (
    trigger_id      TEXT PRIMARY KEY,
    policy_id       TEXT REFERENCES insurance_policies(policy_id) ON DELETE CASCADE,
    zone_id         TEXT NOT NULL,
    event_id        TEXT REFERENCES cyclone_events(event_id) ON DELETE CASCADE,
    trigger_type    TEXT NOT NULL,
    threshold_value NUMERIC NOT NULL,
    observed_value  NUMERIC NOT NULL,
    triggered       BOOLEAN NOT NULL,
    payout_amount_usd NUMERIC DEFAULT 0.0,
    trigger_timestamp TIMESTAMPTZ NOT NULL,
    audit_hash      TEXT NOT NULL,
    signature_hmac  TEXT,
    reviewed_by     TEXT,
    notified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triggers_event ON insurance_triggers (event_id);
CREATE INDEX IF NOT EXISTS idx_triggers_policy ON insurance_triggers (policy_id);
CREATE INDEX IF NOT EXISTS idx_triggers_triggered ON insurance_triggers (triggered);

-- ── 9. Multi-Channel Dispatch Audit Log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispatch_log (
    dispatch_id     TEXT PRIMARY KEY,
    advisory_id     TEXT REFERENCES advisories(advisory_id) ON DELETE CASCADE,
    channel         TEXT NOT NULL,               -- sms | whatsapp | cap_xml | pdf | insurer_webhook
    recipient       TEXT NOT NULL,
    status          TEXT NOT NULL,               -- dispatched | delivered | failed | demo_simulated
    external_ref_id TEXT,
    error_message   TEXT,
    dispatched_by   TEXT NOT NULL,               -- operator ID
    dispatched_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_log_advisory ON dispatch_log (advisory_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_channel ON dispatch_log (channel);
