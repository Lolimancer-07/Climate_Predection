# AGENTS.md — Platform Agent Memory & Operational Rules

> **MANDATORY INSTRUCTION FOR ALL AI AGENTS / ASSISTANTS:**
> 1. You **MUST** read this file at the start of any conversation to understand past architectural decisions, repository status, and established patterns.
> 2. **CRITICAL SELF-UPDATE PROTOCOL:** Whenever you make ANY changes to this codebase (adding features, fixing bugs, refactoring, modifying configurations, or updating tests), you **MUST UPDATE THIS FILE** before completing your turn. Record the timestamp, changes made, files modified, test results, and next pending items in the [Changelog & Agent Activity Log](#changelog--agent-activity-log) section.

---

## 1. Project Overview & Context

- **Project Name:** Cyclone Anticipatory Action Platform (`Climate_Predection`)
- **Repository:** `Lolimancer-07/Climate_Predection`
- **Core Mission:** Shifts cyclone disaster response from reactive post-landfall relief into the **24–72h pre-landfall window** across the Bay of Bengal & Coastal APAC by fusing:
  1. Parametric storm surge inundation modeling
  2. Topographic Wetness Index (TWI) rainfall-runoff flash flood modeling
  3. Critical infrastructure exposure & route impact pathfinding
  4. Multimodal AI synthesis (Gemini 3.7 Flash) with strict zero-hallucination numeric grounding
  5. Deterministic parametric insurance liquidity triggers (HMAC-SHA256 signed audit payloads)
  6. Strict Human-in-the-Loop (HITL) multi-channel dispatch (CAP 1.2 XML, SMS, WhatsApp, PDF)

---

## 2. Technical Stack & Conventions

- **Python Runtime:** Python 3.11+ / 3.14 (`.venv`)
- **Backend API:** FastAPI, Pydantic v2, Pydantic-Settings, Uvicorn
- **Geospatial & Modeling:** Earth Engine Python API (`earthengine-api`), Shapely, GeoPandas, OSMnx, NetworkX, NumPy
- **Database & ORM:** PostgreSQL 15 + PostGIS, SQLAlchemy 2.0 (asyncio + asyncpg + greenlet), GeoAlchemy2, Alembic
- **AI / Multimodal:** Google Generative AI SDK (`google-generativeai`), Gemini 3.7 Flash
- **Frontend:** Vite, React 18, TypeScript, MapLibre GL (`react-map-gl`), TanStack React Query, Axios, Lucide React
- **Dispatch:** Twilio (SMS), WhatsApp Cloud API, ReportLab (PDF), OASIS CAP 1.2 XML
- **Testing:** Pytest, pytest-asyncio, pytest-cov

---

## 3. Architecture & Core Rules

1. **Unidirectional Pipeline:** Data flows strictly: Ingestion → Hazard Modeling → Exposure Overlay → AI Reasoning → Review Gate → Dispatch / Insurer Webhook.
2. **Deterministic Financial Logic:** The parametric insurance trigger boolean is computed **strictly from numerical physical models** (surge height, rainfall sum, wind speed). Gemini **never** triggers or alters financial payout decisions; it only formats human-readable briefs.
3. **Zero-Hallucination Numeric Grounding:** Every generated advisory must pass `ai-reasoning/validate_output.py`, matching every number against upstream structured JSON before reaching human review.
4. **Mandatory Human-in-the-Loop:** No advisory or insurance notification is dispatched without explicit operator confirmation (`HITL_ENFORCE_HUMAN_CONFIRMATION=true`).
5. **Graceful Demo Fallback:** `backend/db/session.py` catches database connection failures gracefully and operates in demo mode when PostgreSQL is offline, so the FastAPI server and frontend work immediately without requiring live Docker/PostGIS containers.

---

## 4. Current State & Completed Implementation (Phase 1)

### 4.1 Ingestion (`data-ingestion/`)
- `gee/auth.py`, `terrain.py`, `landcover.py`, `historical_floods.py`, `exports.py`: Earth Engine SRTM DEM, slope, Dynamic World LULC, flood calibration, and GeoTIFF exports.
- `weather/cyclone_track.py`, `rainfall_forecast.py`, `schemas.py`: IMD/JTWC track ingestion, Open-Meteo GFS 72h rainfall grid fetcher, hardcoded historical presets (Fani 2019, Mocha 2023).
- `exposure/osm_extract.py`, `shelters.py`: OpenStreetMap Overpass query for hospitals, power lines, roads; OSDMA cyclone shelters registry.

### 4.2 Physical Modeling (`modeling/`)
- `surge/parametric_surge.py`: Inverted barometer pressure deficit + bathymetric shelf slope amplification + radial decay bathtub fill.
- `rainfall_runoff/flash_flood_model.py`: TWI + landcover runoff coefficient scoring.
- `exposure_scoring/asset_overlay.py`, `criticality.py`: Spatial intersection with hazard footprints, multi-factor criticality scoring.
- `exposure_scoring/route_impact.py`: NetworkX/OSMnx evacuation route pathfinding with hazard-flagged impassable edges removed.
- `insurance_trigger/trigger_engine.py`, `policy_schemas.py`, `payout_payload.py`: Contractual parametric threshold evaluation, SHA-256 canonical hashing, and HMAC-SHA256 signature generation.

### 4.3 AI Multimodal Reasoning (`ai-reasoning/`)
- `gemini_client.py`: Google AI Studio / Vertex AI SDK wrapper.
- `map_render.py`: Server-side Matplotlib rendering producing map PNGs for multimodal vision inputs.
- `advisory_generator.py`: Orchestrator fusing structured risk + rendered map into Gemini drafts.
- `validate_output.py`: Post-generation numeric consistency regex validator.
- `prompts/`: `consistency_check.md`, `risk_brief.md`, `advisory_draft.md`, `insurance_trigger_notice.md`.

### 4.4 Multi-Channel Dispatch (`dispatch/`)
- `cap_alert.py`: OASIS CAP 1.2 XML payload builder.
- `sms_dispatch.py`: Twilio SMS sender with sandbox fallback.
- `whatsapp_dispatch.py`: Meta Graph WhatsApp Business Cloud API integration.
- `pdf_report.py`: ReportLab PDF generation with institutional headers and disaster warning styling.
- `insurer_webhook.py`: HMAC-authenticated webhook dispatcher for insurance liquidity releases.
- `dispatch_orchestrator.py`: Severity tier routing, review status check, and dispatch audit logging.

### 4.5 Backend & API (`backend/`)
- `main.py`: FastAPI application with CORS and lifespan handler.
- `routers/`: `ingest.py`, `risk.py`, `advisory.py`, `insurance.py`, `assets.py`.
- `db/models.py`, `session.py`: Async SQLAlchemy models with GeoAlchemy2 Geometry columns; graceful fallback when PostgreSQL is offline.
- `db/schema.sql`, `alembic.ini`, `db/migrations/`: Full PostgreSQL+PostGIS schema and Alembic migration setup.
- `auth/rbac.py`: Role-Based Access Control (`ddma_operator`, `insurer_viewer`, `admin`).
- `config.py`: Pydantic-Settings environment configuration.

### 4.6 Frontend Web App (`frontend/`)
- Built with React 18, Vite, TypeScript, TanStack Query, and MapLibre GL.
- `src/App.tsx`: Top navigation bar toggling between **Operational Dashboard** and **Admin Panel**.
- `src/pages/Dashboard.tsx`: Live risk map, active cyclone card, Ward 7 risk metrics, Gemini advisory preview, HITL dispatch modal.
- `src/pages/AdminPanel.tsx`: Infrastructure asset table, parametric policies list, dispatch audit log, RBAC role switcher.
- `src/components/`: `MapView.tsx`, `RiskPanel.tsx`, `AdvisoryPreview.tsx`, `DispatchControls.tsx`, `InsuranceTriggerPanel.tsx`.
- Production bundle: Cleanly compiled and verified with zero TypeScript errors (`tsc --noEmit` and `npm run build` pass).

### 4.7 Infrastructure & CI/CD (`infra/`)
- `terraform/`: `cloud_run.tf`, `postgis_instance.tf`, `scheduler.tf`.
- `github-actions/`: `ci.yml` (test suite + frontend build), `deploy.yml` (Cloud Run deploy).

### 4.8 Documentation & Analysis (`docs/`, `notebooks/`, `scripts/`)
- `docs/`: `architecture.md`, `data_sources.md`, `advisory_template_ndma.md`, `insurance_trigger_spec.md`, `demo_script.md`.
- `notebooks/`: `01_gee_exploration.ipynb`, `02_surge_calibration.ipynb`, `03_insurance_trigger_backtest.ipynb`, `04_demo_district_walkthrough.ipynb`.
- `scripts/demo_run.py`: End-to-end CLI pipeline runner (tested in 0.01s).
- `.gitignore`: Configured to exclude `.venv/`, `node_modules/`, `__pycache__/`, `.coverage`, etc.

---

## 5. Active Roadmap (Phase 2)

As specified in `phase2-enhancement-plan.md`:
1. **Structural & Mechanical Engineering Stress Module (`modeling/structural_engineering/`)**:
   - `wind_load.py`: Drag force calculation ($F_{\text{wind}} = 0.5 \cdot C_d \cdot \rho \cdot A \cdot V^2$) per asset class.
   - `hydrodynamic_load.py`: Surge hydrodynamic force and hydrostatic pressure.
   - `structural_check.py`: Bending moments vs section modulus for line assets (power poles, transmission towers).
   - `fragility_curves.py`: Lognormal damage state probabilities (HAZUS-style).
   - `hardening_priority.py`: Pre-landfall infrastructure reinforcement ranking.
2. **Rapid Post-Event Damage Assessment**:
   - Gemini Vision comparison of pre- vs post-landfall satellite/drone imagery.
3. **Multi-Scenario Generalization**:
   - Generalize backend routers beyond hardcoded Puri/Fani demo to dynamic bounding boxes and cyclone tracks.
4. **Interactive Timeline & Layer Controls in Frontend**:
   - Time-slider across $T-72\text{h} \to T-0\text{h}$ landfall sequence.

---

## 6. How to Run the Project

```bash
# 1. Run full test suite (48 tests passing)
.venv/bin/pytest --cov=. --cov-report=term

# 2. Run CLI End-to-End Simulation
.venv/bin/python3 scripts/demo_run.py --cyclone FANI-2019 --district IN-OD-PURI

# 3. Start Backend API Server (port 8000)
.venv/bin/uvicorn backend.main:app --reload --port 8000

# 4. Start Frontend Development Server (port 5173)
cd frontend && npm run dev
```

---

## 7. Changelog & Agent Activity Log

| Date (UTC/IST) | Agent Action / Milestone | Modified Files | Test Status | Notes |
|---|---|---|---|---|
| **2026-09-28 (Phase 1 Finalization)** | Completed Phase 1 implementation plan: DB schema, Alembic migrations, frontend App switcher, Terraform, GitHub Actions, docs, Jupyter notebooks, demo runner fixes. | `backend/db/schema.sql`, `backend/alembic.ini`, `backend/db/migrations/*`, `frontend/src/App.tsx`, `frontend/tsconfig.json`, `infra/*`, `docs/*`, `notebooks/*`, `scripts/demo_run.py`, `data-ingestion/weather/rainfall_forecast.py` | 48/48 passed; Frontend build passed | All unit & integration tests pass with 0 errors. |
| **2026-09-28 (Backend Dependency Fix)** | Installed backend runtime dependencies in `.venv` (`fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `geoalchemy2`, `alembic`, `greenlet`). Added graceful in-memory demo fallback for `init_db`. | `backend/db/session.py`, `.venv` | Uvicorn running & tested on port 8000 (`/health`, `/risk/IN-OD-PURI` 200 OK) | Resolves `.venv/bin/uvicorn: no such file or directory`. |
| **2026-09-28 (Agent Memory System)** | Added `AGENTS.md` and `.agents/rules/agent_memory.md` to permanently record agent context, architectural rules, and mandatory self-update protocol. | `AGENTS.md`, `.agents/rules/agent_memory.md` | 48/48 passed | Any agent modifying files must update this file. |

> *(When you make future changes, add a new row above with the date, summary of changes, modified files, test status, and notes).*
