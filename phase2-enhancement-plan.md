# Climate_Predection — Phase 2 Enhancement Plan
### Backend hardening, new features, structural/mechanical engineering module, and React frontend expansion

This plan builds directly on the existing `Lolimancer-07/Climate_Predection` codebase (verified against the actual repo, not the abstract design doc). It assumes the Phase 1 scaffold already works as a single-scenario demo (Cyclone Fani 2019, district `IN-OD-PURI`, Ward 7) and turns it into a generalizable, multi-feature platform.

---

## 1. Current State — What's Actually in the Repo

| Area | What exists today | What's missing |
|---|---|---|
| Backend | FastAPI app (`backend/main.py`), 5 routers, SQLAlchemy+GeoAlchemy2 models, RBAC stub | Routers bypass the DB entirely and return hardcoded demo objects; no real query path |
| Modeling | Real parametric surge model (`modeling/surge/parametric_surge.py`) with calibration constants, rainfall-runoff, exposure scoring, insurance trigger engine | Only one hardcoded scenario (`fani_demo_surge()`); no generalized "run for any district/event" entrypoint used by the API |
| AI reasoning | Gemini client, prompt templates, output validator | Not yet wired to accept dynamically computed risk payloads — only demo-shaped input |
| Frontend | Real React 18 + Vite + TypeScript app, MapLibre GL via `react-map-gl`, TanStack Query, Axios | Single fixed view; no district/scenario selector, no timeline, no layer toggles, no role-based views |
| Dispatch | CAP XML, SMS, WhatsApp, PDF, insurer webhook modules exist | Not connected to a live human-review queue; no persistence of dispatch history |
| Tests | Unit tests for surge/runoff/exposure/trigger, one integration test | No frontend tests, no load/perf tests, no prompt-regression suite beyond one file |

**Conclusion:** the physics and AI logic are real and worth keeping — the priority for Phase 2 is (a) generalizing it beyond one hardcoded case, (b) adding genuine new capability (the structural/mechanical module is the biggest one), and (c) building out the React frontend to actually expose all of this.

---

## 2. Flagship New Feature: Structural & Mechanical Engineering Stress Module

### 2.1 Why this fits, directly

The original brief asks for infrastructure **exposure mapping** (power grids, roads, shelters). The current repo only answers *"is this asset inside the flood/surge polygon?"* — a purely spatial question. It never asks *"will this specific structure actually survive the forecast wind and water forces?"* — a **mechanical/structural engineering** question. Adding that turns exposure mapping into genuine infrastructure-hardening decision support, which is explicitly called out in the problem statement.

### 2.2 Core physics (all standard, textbook wind/structural engineering — no exotic modeling needed)

**Wind load on a structure (drag force):**
```
F_wind = 0.5 * Cd * rho_air * A * V^2
```
- `Cd` = drag coefficient (asset-type dependent: ~1.2 for flat-sided buildings, ~1.0 for cylindrical poles, ~2.0 for open lattice transmission towers)
- `rho_air` ≈ 1.225 kg/m³
- `A` = projected frontal area of the structure
- `V` = forecast sustained wind speed at the asset's location (already available from the meteorological ingestion layer)

**Hydrodynamic surge force on a structure (debris-laden flow):**
```
F_surge = 0.5 * Cd_water * rho_water * A_submerged * V_flow^2
```
plus a hydrostatic component for fully/partially submerged walls. `V_flow` is estimated from surge height and local terrain slope (already computed by the existing surge model).

**Structural check for line assets (power poles / transmission towers):**
```
bending_moment = F_wind * height_of_application
safety_factor  = pole_material_capacity_moment / bending_moment
```
Standard mechanics-of-materials bending-moment vs. section-modulus check, parameterized per pole/tower class (wood pole, concrete pole, steel lattice tower) using published capacity values.

**Fragility curve (probability of a given damage state, HAZUS-style):**
```
P(damage_state | V) = Φ( ln(V / median_threshold) / dispersion_beta )
```
A lognormal cumulative distribution — the standard form used in earthquake and hurricane engineering risk models (HAZUS-MH, FEMA). Each asset class (RCC-frame hospital, masonry school/shelter, thatched-roof house, wood power pole, steel transmission tower, concrete bridge pier) gets its own `(median_threshold, dispersion_beta)` pair, sourced from published regional vulnerability studies where available, and conservatively estimated where not, with the estimation method documented.

### 2.3 Output

For every flagged asset, in addition to the existing `priority_score`:
```json
{
  "asset_id": "POLE-0231",
  "asset_class": "wood_power_pole",
  "forecast_wind_speed_kmh": 165,
  "wind_force_kn": 12.4,
  "safety_factor": 0.71,
  "damage_state_probabilities": {
    "none": 0.05, "minor": 0.18, "moderate": 0.34, "severe": 0.31, "collapse": 0.12
  },
  "expected_damage_state": "moderate",
  "hardening_recommendation": "Guy-wire reinforcement recommended pre-landfall; safety factor below 1.0."
}
```

This feeds three places at once:
1. **Exposure scoring** — `priority_score` becomes physics-informed, not purely spatial
2. **Insurance trigger engine** — a new `trigger_type: "structural_damage_index"` becomes possible, aggregating expected damage state across an insured zone's assets
3. **A new "Hardening Priority List"** — a ranked, exportable list of exactly which poles/roofs/bridges to reinforce before landfall, sorted by (safety factor ascending × criticality descending)

### 2.4 New module structure

```
modeling/structural_engineering/
├── __init__.py
├── wind_load.py            # F_wind calculation per asset class
├── hydrodynamic_load.py     # F_surge calculation
├── fragility_curves.py      # lognormal P(damage_state | load), per asset class parameter table
├── structural_check.py      # bending moment / safety factor for line assets
├── damage_state.py          # aggregates load + fragility -> expected damage state
└── hardening_priority.py    # ranks assets for pre-landfall reinforcement
```

### 2.5 Calibration note (state this honestly in any demo/pitch)
Fragility curve parameters for Bay-of-Bengal-specific construction types are not universally published; where a region-specific curve is unavailable, use the nearest published equivalent (e.g., FEMA HAZUS hurricane fragility tables) and flag the asset's damage-state output as `confidence: "generic_curve"` vs. `confidence: "region_calibrated"`. This keeps the module honest rather than presenting invented precision.

---

## 3. Second New Feature: Rapid Post-Event Damage Assessment (Gemini Vision, closes the loop)

Uses the same GEE access already in the repo, plus Gemini's multimodal reasoning (already integrated for the advisory layer), for a second purpose:

1. Pull a **pre-event** satellite image tile (from GEE, before landfall) and a **post-event** image tile (as soon as available after landfall) for the same district/ward
2. Send both images to Gemini with a structured prompt asking it to flag visually apparent changes consistent with damage (roof loss, flooding extent, road blockage, vegetation debris) — again constrained to describe only what's visible, not invent severity numbers
3. Cross-reference Gemini's visual change flags against the **pre-landfall structural predictions** from Section 2 for the same assets
4. Output: a validation record per asset — did the structure survive as predicted, or not? This is exactly the feedback loop needed to recalibrate both the surge model constants and the fragility curve parameters over time, and it also gives insurers a fast, low-cost initial damage signal before formal loss adjustment.

```
ai-reasoning/rapid_damage_assessment/
├── __init__.py
├── image_pair_fetch.py      # pre/post GEE image tile retrieval
├── change_detection_prompt.py
└── validation_record.py     # compares predicted vs. observed, feeds calibration notebook
```

---

## 4. Backend Improvements (making it a real system, not a demo)

| Improvement | What changes | Why |
|---|---|---|
| **Generalize the pipeline** | Replace `fani_demo_surge()` calls in routers with a `run_pipeline_for(district_id, event_id)` orchestrator that pulls real inputs from the DB/ingestion layer | Currently only one district works at all |
| **Real DB read/write path** | Routers query `hazard_polygons`, `exposure_scores`, etc. via SQLAlchemy instead of recomputing in-request | Persistence, auditability, and speed (don't recompute on every GET) |
| **Background task pipeline** | Move the ingestion → modeling → scoring chain into a Celery/RQ worker (or FastAPI `BackgroundTasks` for a lighter first cut), triggered by `/ingest/cyclone-event` | Keeps API responses fast; lets the pipeline re-run automatically as forecasts update |
| **Caching layer (Redis)** | Cache GEE terrain/land-cover pulls and weather forecast pulls per district for a short TTL | GEE and weather API calls are the slowest, most rate-limited part of the pipeline |
| **WebSocket channel** | `/ws/risk/{district_id}` pushes updated risk payloads to connected clients as new forecasts land | Enables live-updating frontend instead of manual refresh |
| **Auth enforcement** | Wire the existing `backend/auth/rbac.py` into route dependencies (`Depends(require_role("ddma_operator"))`, etc.) | RBAC module exists but isn't actually enforced on routes yet |
| **Config/environments** | Expand `backend/config.py` with `pydantic-settings` profiles for `local` / `staging` / `demo` | Makes it safe to deploy beyond a laptop demo |
| **Structured logging & tracing** | Add `structlog` + basic OpenTelemetry spans around each pipeline stage | Needed once the trigger engine is doing anything insurance-adjacent (Section 14 of the original plan already commits to auditability — this is what actually delivers it) |
| **Rate limiting / API keys** | `slowapi` or a simple Redis token-bucket for third-party DDMA/insurer API consumers | The API contract already promises external consumers; needs protection before it's exposed |
| **CI pipeline** | GitHub Actions: run `pytest` + `ruff`/`mypy` on backend, `eslint`/`tsc --noEmit` + a build check on frontend, on every PR | No CI currently exists in the repo |

---

## 5. Full New Feature List

| # | Feature | Layer |
|---|---|---|
| 1 | Structural/mechanical engineering fragility module (Section 2) | Modeling |
| 2 | Rapid post-event damage assessment via Gemini vision (Section 3) | AI reasoning |
| 3 | Multi-district generalization (any Bay of Bengal district, not just Puri) | Backend + data-ingestion |
| 4 | Scenario "what-if" simulator — slide cyclone category/track up or down and re-run the pipeline live | Backend + Frontend |
| 5 | Shelter capacity vs. population overflow calculator — flags when a ward's assigned shelter(s) can't hold the at-risk population, and suggests the nearest shelter with spare capacity | Modeling |
| 6 | Multi-shelter evacuation route assignment — extends the existing single-route `route_impact.py` into an assignment problem (which population centroid goes to which shelter, avoiding flagged roads) | Modeling |
| 7 | Historical trend analytics — track how a district's structural/flood risk has evolved across multiple past events | Backend + Frontend |
| 8 | Multi-tenant admin — onboard a new district/country by uploading boundary + asset data through a UI instead of editing Python constants | Backend + Frontend |
| 9 | Insurer-facing trigger dashboard — separate role view showing only trigger status, audit trail, and notification history, never raw citizen contact data | Frontend + RBAC |
| 10 | Citizen-facing subscription (opt-in SMS/WhatsApp alerts by ward) | Backend + Dispatch |
| 11 | Public read-only risk map (no auth) with a heavily rate-limited API, for transparency/press use | Backend |
| 12 | Regional-language pack expansion beyond one language, driven by the existing Gemini advisory drafting task | AI reasoning |
| 13 | Offline-first field companion view (PWA) for shelter managers with poor connectivity — caches the last-known advisory and asset list | Frontend |
| 14 | Automated model recalibration notebook-to-service pipeline — periodically refits the surge model's regression constants (`_A`, `_B`, `_C` in `parametric_surge.py`) against newly available historical events using `scikit-learn`, instead of hand-set constants | Modeling + ML |
| 15 | Full audit/compliance export — one-click export of every advisory, trigger, and dispatch record for a given event, for post-event regulatory or insurer review | Backend |

---

## 6. Frontend (React) Expansion Plan

The frontend is already React 18 + Vite + TypeScript + MapLibre GL (`react-map-gl`) + TanStack Query + Axios — no framework change needed. This is purely additive.

### 6.1 New pages/components

```
frontend/src/
├── pages/
│   ├── Dashboard.tsx                (existing — becomes the DDMA operator view)
│   ├── AdminPanel.tsx               (existing — expand: onboard new districts/policies)
│   ├── InsurerDashboard.tsx         (new — trigger status + audit trail, role-gated)
│   ├── HardeningPriorityPage.tsx    (new — ranked structural retrofit list, from Section 2)
│   ├── DamageAssessmentPage.tsx     (new — pre/post imagery comparison + validation records)
│   ├── HistoricalTrendsPage.tsx     (new — recharts-based trend view across past events)
│   └── PublicRiskMap.tsx            (new — unauthenticated read-only view)
├── components/
│   ├── MapView.tsx                  (existing — extend with layer toggles: surge / rainfall / wind / structural)
│   ├── TimelineScrubber.tsx         (new — T-120h to T-0 slider, re-queries risk at each point)
│   ├── ScenarioSimulator.tsx        (new — category/track sliders driving the what-if re-run)
│   ├── AssetDetailDrawer.tsx        (new — click an asset -> shows exposure + structural + criticality detail)
│   ├── AdvisoryPreview.tsx          (existing — add inline edit + diff view before human confirmation)
│   ├── DispatchControls.tsx         (existing — extend with dispatch history log)
│   ├── InsuranceTriggerPanel.tsx    (existing — link into new InsurerDashboard)
│   ├── LiveUpdateBanner.tsx         (new — surfaces WebSocket push updates)
│   ├── NotificationCenter.tsx       (new — in-app log of advisories/triggers fired)
│   └── RoleGate.tsx                 (new — wraps routes/components by RBAC role)
├── hooks/
│   ├── useRiskWebSocket.ts          (new — WebSocket subscription hook)
│   └── useScenarioQuery.ts          (new — TanStack Query wrapper for what-if re-runs)
└── theme/
    └── tokens.css                   (new — light/dark tokens, since this is now a multi-role, longer-lived app)
```

### 6.2 State/data approach
- Keep **TanStack Query** for all REST reads (already in use) — add query keys per district/event/scenario so the timeline scrubber and scenario simulator can cache intermediate states cheaply
- Add a thin **WebSocket hook** (`useRiskWebSocket`) that invalidates the relevant TanStack Query cache entry on a push update, rather than maintaining a separate state store — avoids introducing Redux/Zustand for what is still fundamentally server-state-driven data
- Add **recharts** (already whitelisted-friendly, lightweight) for the historical trends and structural damage-state distribution charts

### 6.3 Role-based views
Three roles, enforced both by backend RBAC and by `RoleGate.tsx` on the frontend:
- **DDMA operator** — full Dashboard, advisory review/dispatch, hardening priority list
- **Insurer viewer** — InsurerDashboard only, trigger status and audit trail, no citizen contact data
- **Public** — PublicRiskMap only, read-only, heavily cached

---

## 7. Database Schema Additions

```sql
CREATE TABLE structural_assets (
    asset_id             TEXT PRIMARY KEY REFERENCES infrastructure_assets(asset_id),
    asset_class          TEXT,               -- wood_power_pole | steel_lattice_tower | rcc_building | masonry_building | bridge_pier
    design_wind_speed_kmh NUMERIC,
    material_capacity_kn NUMERIC,
    height_m             NUMERIC,
    frontal_area_m2       NUMERIC
);

CREATE TABLE fragility_curves (
    curve_id             TEXT PRIMARY KEY,
    asset_class          TEXT,
    hazard_type          TEXT,               -- wind | surge
    damage_state         TEXT,               -- minor | moderate | severe | collapse
    median_threshold      NUMERIC,
    dispersion_beta       NUMERIC,
    confidence            TEXT                -- region_calibrated | generic_curve
);

CREATE TABLE structural_assessments (
    assessment_id         TEXT PRIMARY KEY,
    event_id              TEXT REFERENCES cyclone_events(event_id),
    asset_id              TEXT REFERENCES structural_assets(asset_id),
    forecast_load_kn       NUMERIC,
    safety_factor          NUMERIC,
    expected_damage_state  TEXT,
    hardening_recommendation TEXT,
    computed_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE damage_validation_records (
    record_id             TEXT PRIMARY KEY,
    event_id              TEXT REFERENCES cyclone_events(event_id),
    asset_id              TEXT REFERENCES structural_assets(asset_id),
    predicted_damage_state TEXT,
    observed_damage_state  TEXT,             -- from Gemini vision change-detection pass
    match                  BOOLEAN,
    reviewed_by            TEXT,
    created_at             TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. New/Updated API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/pipeline/run` | Generalized trigger: run the full pipeline for any `{district_id, event_id}`, replacing the hardcoded demo path |
| `GET` | `/structural/{district_id}` | Per-asset structural load, safety factor, and damage-state predictions |
| `GET` | `/structural/{district_id}/hardening-priority` | Ranked pre-landfall reinforcement list |
| `POST` | `/damage-assessment/{event_id}/run` | Trigger a pre/post imagery comparison pass for a district |
| `GET` | `/damage-assessment/{event_id}` | Retrieve validation records comparing predicted vs. observed damage |
| `WS` | `/ws/risk/{district_id}` | Live-push risk/advisory/trigger updates |
| `GET` | `/analytics/{district_id}/history` | Historical risk/damage trend data for charting |
| `POST` | `/admin/districts` | Onboard a new district (boundary + asset upload) |
| `POST` | `/public/risk/{district_id}` | Rate-limited, unauthenticated read-only risk summary |

---

## 9. Build Roadmap (12-week phased plan)

| Sprint | Weeks | Focus |
|---|---|---|
| 1 | 1–2 | Generalize pipeline off hardcoded demo; wire real DB read/write path; add CI |
| 2 | 3–4 | Structural/mechanical engineering module (Section 2) — core physics + fragility curves + hardening priority endpoint |
| 3 | 5–6 | Frontend: timeline scrubber, layer toggles, asset detail drawer, hardening priority page |
| 4 | 7–8 | Background task pipeline + Redis caching + WebSocket live updates, frontend WebSocket hook |
| 5 | 9–10 | Rapid post-event damage assessment (Gemini vision) + validation records + insurer dashboard |
| 6 | 11–12 | Multi-tenant admin onboarding, public read-only view, role-based access hardening, audit/compliance export |

---

## 10. Risks & Mitigations (additions specific to Phase 2)

| Risk | Mitigation |
|---|---|
| Fragility curve parameters presented as more precise than they are | Every structural output carries a `confidence: region_calibrated | generic_curve` flag, surfaced in the UI, not hidden |
| Structural safety-factor numbers mistaken for a certified engineering sign-off | Every hardening recommendation is labeled as a screening priority list, explicitly "not a substitute for a licensed structural engineer's assessment" |
| Gemini vision change-detection over-interpreting ambiguous post-event imagery | Prompts constrained to describe only clearly visible changes; validation records always show predicted vs. observed side by side for human review, never auto-accepted |
| Multi-district generalization exposing incomplete/low-quality OSM data for new districts | Admin onboarding flow includes a data-completeness check before a new district is marked "active" |
