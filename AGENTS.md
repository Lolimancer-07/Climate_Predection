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
# 0. Quick Start (Run Backend + Frontend simultaneously)
./run.sh

# Or to auto-kill existing port conflicts:
./run.sh --restart

# 1. Run full test suite (73 tests passing)
.venv/bin/pytest --cov=. --cov-report=term

# 2. Run CLI End-to-End Simulation
.venv/bin/python3 scripts/demo_run.py --cyclone FANI-2019 --district IN-OD-PURI

# 3. Start Backend API Server manually (port 8000)
.venv/bin/uvicorn backend.main:app --reload --port 8000

# 4. Start Frontend Development Server manually (port 5173)
cd frontend && npm run dev
```

---

## 7. Changelog & Agent Activity Log

| Date (UTC/IST) | Agent Action / Milestone | Modified Files | Test Status | Notes |
| **2026-09-29 (1:1 Modular Backend Alignment with UAV Digital Twin)** | Implemented the complete 1:1 backend digital twin architecture from `Lolimancer-07/UAV_Digital_Twin` into `backend/`: (1) `anomaly_detector.py` with `FaultHysteresisFilter` (debouncing with trigger threshold 3, clear threshold 5), Isolation Forest envelope, and 10 disaster domain hazard rules; (2) `physics_engine.py` (first-principles inverted barometer rise, bathymetric shelf setup, Holland wind field, wave setup, and physical residuals); (3) `physics_check.py` (analytical validation of hydrodynamics); (4) `health_index.py` (District Vulnerability & Infrastructure Integrity Index 0-100 across coastal defense, drainage, power grid, evacuation routes, shelters, comms with EWMA smoothing alpha=0.20); (5) `mission_risk.py` (Evacuation & Response Feasibility Index: routes * surge window * shelter capacity * environmental stress); (6) `maintenance_advisor.py` (SOP/NDMA-compliant digital hardening work orders with deterministic flight/disaster-safety priority ranking); (7) `demo_controller.py` (9-step pre-landfall scripted demo sequencer); (8) `drift_detector.py` (sliding-window distribution shift & rapid intensification detector using rolling PSI & z-scores); (9) `edge_profile.py` (State EOC Float32 vs District Mobile Unit INT8 post-training quantization simulation); (10) `engine_config.py` (centralized basin registry for Bay of Bengal & Arabian Sea physics and fault thresholds); (11) `fleet_manager.py` (Coastal District Sector Manager tracking 5 districts simultaneously: Puri, Jagatsinghpur, Kendrapara, Ganjam, Bhadrak); (12) `federated_coordinator.py` (privacy-preserving multi-district FedAvg aggregation); (13) `sensor_integrity.py` (AWS, tide gauge, Doppler radar trust monitor); (14) `telemetry_integrity.py` (packet loss, sequence monotonicity, replay guard); (15) `twin_consistency.py` (cross-validation between AI models and hydrodynamic physics: Cases A, B, C, D); (16) `whatif_engine.py` (counterfactual scenario simulation of track shift, pressure drop, high tide); (17) `optimizer.py` (pre-landfall evacuation dispatch frequency & fuel allocation optimizer); (18) `prescriptive.py` (actionable DRR directives); (19) `xai_engine.py` (multivariate risk driver attribution ranking); (20) `ml_chatbot/` (`intent_dataset.py`, `intent_classifier.py`, `train_intent_clf.py`, `intent_clf.joblib`, `training_report.json` with 12 cyclone emergency intent classes); (21) `ai_engineer.py` (grounded plain-English Q&A); (22) `benchmark_models.py` & `model_benchmark_report.json` (offline benchmarking of Linear, RF, GB, and Hydrodynamic models); (23) `inference.py` (unified 10 Hz digital twin processing engine and GCS command processor); (24) Wired `backend/routers/storms.py` WebSocket to broadcast the full digital twin telemetry payload; (25) Created `tests/unit/test_cyclone_digital_twin_modules.py`. | `backend/{anomaly_detector,physics_engine,physics_check,health_index,mission_risk,maintenance_advisor,demo_controller,drift_detector,edge_profile,engine_config,fleet_manager,federated_coordinator,sensor_integrity,telemetry_integrity,twin_consistency,whatif_engine,optimizer,prescriptive,xai_engine,ai_engineer,benchmark_models,inference,train_anomaly_detector}.py`, `backend/ml_chatbot/{intent_dataset,intent_classifier,train_intent_clf}.py`, `backend/routers/storms.py`, `tests/unit/test_cyclone_digital_twin_modules.py`, `AGENTS.md` | **93/93 passed** (0.96s); `npm run build` clean (6.34s); backend & frontend running live | Complete 1:1 structural, modular, and behavioral alignment with UAV Digital Twin backend achieved. |
| **2026-09-28 (Complete UAV Digital Twin Operator Console Alignment)** | Fully unified the platform layout, ergonomics, and aesthetics with `Lolimancer-07/UAV_Digital_Twin`: (1) Created `backend/cyclone_nexus_ai.py` and wired `POST /advisory/copilot-query` and WebSocket commands for live zero-hallucination Cyclone Nexus Copilot; (2) Built `frontend/src/components/SiteHeader.tsx` with live telemetry HUD ribbon, data mode badge, provider, WS health, theme switcher (Default, Ice, Emerald, Amber), and role switcher; (3) Built `frontend/src/components/CommandDock.tsx` with persistent bottom controls (lead-time stage, scenario fault injection, sim playback speed 1x-5x, pause/resume, What-If dialog, 9-step scripted demo runner); (4) Built `frontend/src/components/AICopilotRightPanel.tsx` with streaming typewriter chat, 8 intent categories, and quick prompts; (5) Built `frontend/src/components/BackendGate.tsx` featuring the rotating radar sweep animation and subsystem boot checklist; (6) Built `frontend/src/components/ActiveAdvisoriesWidget.tsx` and `frontend/src/components/GcsMissionStatusBar.tsx`; (7) Built `frontend/src/components/ChartAreaInteractive.tsx` with multi-channel synchronized dual-axis curves; (8) Built `frontend/src/components/TelemetryFdrMonitor.tsx` (meteorological packet FDR and protocol sniffer with byte map and SPN decoding); (9) Rebuilt `frontend/src/App.tsx` and `frontend/src/pages/OperationsOverview.tsx` to tie the entire GCS cockpit together; (10) Added `tests/unit/test_cyclone_nexus_ai.py`. | `backend/cyclone_nexus_ai.py`, `backend/routers/advisory.py`, `backend/routers/storms.py`, `frontend/src/App.tsx`, `frontend/src/context/StormContext.tsx`, `frontend/src/theme/tokens.css`, `frontend/src/pages/OperationsOverview.tsx`, `frontend/src/components/{SiteHeader,CommandDock,AICopilotRightPanel,BackendGate,ActiveAdvisoriesWidget,GcsMissionStatusBar,ChartAreaInteractive,TelemetryFdrMonitor,AlarmSoundManager}.tsx`, `tests/unit/test_cyclone_nexus_ai.py`, `AGENTS.md` | **76/76 passed**; `npm run build` clean (5.25s); REST & WebSocket tested live | Platform fully achieves 1:1 behavioral and visual alignment with UAV Digital Twin operator workstation. |
| **2026-09-28 (UAV Digital Twin GCS Layout & Pipeline Alignment)** | Refined the frontend and backend to align with `UAV_Digital_Twin` operator console: (1) Rebuilt `Dashboard.tsx` (Impact Map) into a 3-panel GCS workstation with top HUD telemetry ribbon (storm category, surge, wind, precip, exposed population), interactive MapLibre map with layer legend overlay, ward telemetry rail, and grounded advisory preview; (2) Rebuilt `AdminPanel.tsx` with GCS-style tabs (assets, policies, dispatch log, basin calibration); (3) Wired `backend/routers/storms.py` endpoints `POST /v1/storms/{storm_id}/runs` and `GET /v1/storms/runs/{run_id}` to execute dynamic background pipeline jobs via `backend.routers.pipeline`; (4) Built and verified frontend and backend. | `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/AdminPanel.tsx`, `backend/routers/storms.py`, `AGENTS.md` | **73/73 passed**; `tsc --noEmit` clean; `npm run build` exit 0; live on ports 5173 & 8000 | Frontend fully adheres to Node.js/TSX/React GCS operator console specification. |
| **2026-09-28 (Root Build Helper & Polish)** | Added root `package.json` delegating scripts (`build`, `dev`, `preview`, `lint`) via `--prefix frontend` so running `npm run build` from root succeeds cleanly without ENOENT. Added exponential backoff & unmount protection to `useRiskWebSocket.ts`. Added prominent non-payment disclaimer banner to `InsurerDashboard.tsx` clarifying parametric trigger artifact role. | `package.json`, `frontend/src/hooks/useRiskWebSocket.ts`, `frontend/src/pages/InsurerDashboard.tsx`, `AGENTS.md` | **73/73 passed**; root `npm run build` passes 100% cleanly; dev server live on 5173 | Both `npm run build` and `cd frontend && npm run build` now work seamlessly. |
| **2026-09-28 (UAV Digital Twin Alignment — Phase 1+2 Shell & Evidence)** | Rebuilt frontend to match `Climate_Predection — UAV Digital Twin Reference-Aligned Implementation Plan`: (1) GCS-style collapsible sidebar shell with grouped navigation (11 pages) replacing flat top-nav, (2) Persistent `StormContext` provider for global active-storm/district state, (3) Top status strip with storm name, data_mode badge, WS health, pipeline/synthetic data warning strip, (4) New pages: `OperationsOverview` (KPI grid, model/source status, ward table), `AdvisoryReviewPage` (5-step HITL workflow with numeric evidence panel), `ModelEvidencePage` (confidence bars, ranked risk drivers, evidence agreement checks), `ScenarioLabPage` (SIMULATED-labeled wrapper), (5) Rebuilt `LiveStormTracker` wired to real `/v1/storms/active` API with data_mode/provider badges, (6) Backend: `storms.py` cone endpoint now returns GeoJSON FeatureCollection (not WKT), active storms annotated with `data_mode`, `provider`, `freshness_seconds`, WebSocket cleanup guard added. | `frontend/src/App.tsx`, `frontend/src/context/StormContext.tsx`, `frontend/src/pages/OperationsOverview.tsx`, `frontend/src/pages/AdvisoryReviewPage.tsx`, `frontend/src/pages/ModelEvidencePage.tsx`, `frontend/src/pages/ScenarioLabPage.tsx`, `frontend/src/pages/LiveStormTracker.tsx`, `backend/routers/storms.py`, `AGENTS.md` | **73/73 passed**; `tsc --noEmit` zero errors; `npm run build` clean; `/v1/storms/active` and `/v1/storms/{id}/cone` 200 OK with correct payloads | Platform running at http://localhost:5173 and http://localhost:8000. WebSocket reconnect loop issue previously observed is resolved (backend task was killed externally by OOM). |
| **2026-09-28 (Platform Startup & Dependency Fix)** | Installed `pyproj` in `.venv` required by `modeling/track_forecast/uncertainty_cone.py`. Added backwards compatibility alias `run_surge_model = run_parametric_surge_model` in `modeling/surge/parametric_surge.py` for CLI demo runner. Successfully launched both FastAPI backend (port 8000) and Vite frontend (port 5173) as active daemon background tasks via `./run.sh --restart`. | `modeling/surge/parametric_surge.py`, `AGENTS.md` | **73/73 passed**; `scripts/demo_run.py` 100% verified; API & UI returning 200 OK | Backend & Frontend currently running live and operational. |

| **2026-09-28 (Unified Startup Script)** | Added `run.sh` to launch both FastAPI backend (port 8000) and Vite frontend (port 5173) concurrently. Includes port collision checks, `--restart` auto-kill flags, virtualenv detection, and graceful Ctrl+C cleanup traps. Updated README.md and AGENTS.md. | `run.sh`, `README.md`, `AGENTS.md` | Tested: `./run.sh --help`, collision detection, syntax verified | Ready for one-command execution (`./run.sh`). |

| **2026-09-28 (Phase 3 Full Implementation)** | Implemented complete Phase 3 from `phase3-realtime-futureproof-plan(1).md`: (1) Provider adapters and registries for data sources and models (`backend/registry/*`, `data-ingestion/providers/*`), (2) CLIPER-style extrapolation for track and intensity, plus uncertainty cone calculation (`modeling/track_forecast/*`), (3) Extraction of hardcoded calibration constants into `bay_of_bengal.yaml` basin configuration, (4) DB Schema updates for tracking active storms (`active_storms`, `storm_track_points`, `forecast_cones`, `threatened_districts`), (5) Frontend: New `LiveStormTracker` page with `StormTrackMap`, `RiskTimelineChart`, and `ProviderModeBadge`. | `backend/registry/*`, `backend/basin_config.py`, `backend/feature_flags.py`, `backend/db/models.py`, `backend/db/schema.sql`, `backend/routers/storms.py`, `backend/main.py`, `data-ingestion/providers/*`, `modeling/track_forecast/*`, `modeling/surge/parametric_surge.py`, `frontend/src/App.tsx`, `frontend/src/pages/LiveStormTracker.tsx`, `frontend/src/components/*` | **73/73 passed**; Frontend built successfully | Alembic schema generation verified but offline since no local DB container was running. React-router-dom dependency bypassed for internal routing. |
| **2026-09-28 (Phase 2 Full Implementation)** | Implemented complete Phase 2 from `phase2-enhancement-plan.md`: (1) Structural/Mechanical Engineering module (wind_load, hydrodynamic_load, structural_check, fragility_curves, damage_state, hardening_priority), (2) AI Rapid Damage Assessment (image_pair_fetch, change_detection_prompt, validation_record), (3) Generalized Pipeline Router with BackgroundTasks + WebSocket, (4) Structural & DamageAssessment API routers, (5) Full frontend expansion: RoleGate, LiveUpdateBanner, TimelineScrubber, ScenarioSimulator, HardeningPriorityPage, DamageAssessmentPage, InsurerDashboard, HistoricalTrendsPage, useRiskWebSocket, useScenarioQuery, tokens.css, multi-role App.tsx navigation. | `modeling/structural_engineering/*` (7 files), `ai-reasoning/rapid_damage_assessment/*` (4 files), `backend/routers/pipeline.py`, `backend/routers/structural.py`, `backend/routers/damage_assessment.py`, `backend/main.py`, `frontend/src/theme/tokens.css`, `frontend/src/components/RoleGate.tsx`, `frontend/src/components/LiveUpdateBanner.tsx`, `frontend/src/components/TimelineScrubber.tsx`, `frontend/src/components/ScenarioSimulator.tsx`, `frontend/src/hooks/useRiskWebSocket.ts`, `frontend/src/hooks/useScenarioQuery.ts`, `frontend/src/pages/{HardeningPriorityPage,DamageAssessmentPage,InsurerDashboard,HistoricalTrendsPage}.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/package.json`, `tests/test_structural_engineering.py` | **73/73 passed** (+25 new Phase 2 tests); `tsc --noEmit` zero errors; `git push` to `origin/main` confirmed | recharts installed for historical trends charts. Structural fragility params tagged `generic_curve` (HAZUS analogs) per Phase 2 honesty requirement. All Phase 2 API endpoints live. |
| **2026-09-28 (Phase 1 Finalization)** | Completed Phase 1 implementation plan: DB schema, Alembic migrations, frontend App switcher, Terraform, GitHub Actions, docs, Jupyter notebooks, demo runner fixes. | `backend/db/schema.sql`, `backend/alembic.ini`, `backend/db/migrations/*`, `frontend/src/App.tsx`, `frontend/tsconfig.json`, `infra/*`, `docs/*`, `notebooks/*`, `scripts/demo_run.py`, `data-ingestion/weather/rainfall_forecast.py` | 48/48 passed; Frontend build passed | All unit & integration tests pass with 0 errors. |
| **2026-09-28 (Backend Dependency Fix)** | Installed backend runtime dependencies in `.venv` (`fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `geoalchemy2`, `alembic`, `greenlet`). Added graceful in-memory demo fallback for `init_db`. | `backend/db/session.py`, `.venv` | Uvicorn running & tested on port 8000 (`/health`, `/risk/IN-OD-PURI` 200 OK) | Resolves `.venv/bin/uvicorn: no such file or directory`. |
| **2026-09-28 (Agent Memory System)** | Added `AGENTS.md` and `.agents/rules/agent_memory.md` to permanently record agent context, architectural rules, and mandatory self-update protocol. | `AGENTS.md`, `.agents/rules/agent_memory.md` | 48/48 passed | Any agent modifying files must update this file. |

> *(When you make future changes, add a new row above with the date, summary of changes, modified files, test status, and notes).*
