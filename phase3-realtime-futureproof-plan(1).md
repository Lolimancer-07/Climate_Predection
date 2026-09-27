# Climate_Predection — Phase 3 Plan
### Real-Time Prediction for Upcoming Cyclones (Mock-Data-Driven) + Futureproof Architecture

Phase 1 built the physics and AI logic. Phase 2 generalized it and added the structural engineering module. **Phase 3 removes the last hard limitation: the system only ever replays four named historical cyclones.** This phase adds genuine forward-looking prediction for storms that haven't made landfall yet, built against a mock live feed today, but architected so a real feed can be dropped in later with zero changes to any downstream model, API, or frontend code.

---

## 1. The Core Problem With the Current Design

Every existing entrypoint (`fani_demo_surge()`, `load_historical_track("FANI-2019")`, etc.) assumes:
- The event already happened
- The full track from genesis to dissipation is already known
- There is exactly one outcome, not a forecast with uncertainty

None of that is true for a storm that is currently forming. Phase 3 introduces a genuinely separate mode — **live/forecast mode** — that sits alongside the existing **historical/replay mode**, sharing the same downstream hazard, structural, and dispatch logic.

---

## 2. New Capability: Real-Time Prediction for Upcoming Cyclones

### 2.1 What "prediction" means here (stated precisely)
Given a storm's **observed track so far** (a handful of recent position/intensity fixes, exactly like a real IMD/JTWC bulletin provides), the system:
1. **Extrapolates the track forward** 24/48/72/96/120 hours using a lightweight, well-established technique — a **CLIPER-style** (CLImatology + PERsistence) approach: recent heading and forward speed persisted forward, decayed toward climatological norms for the basin and season, rather than requiring a full numerical weather model
2. **Extrapolates intensity forward** using a simple decay/intensification model driven by sea-surface-temperature-region climatology (mocked as a lookup table for now) and time-to-landfall
3. **Grows a cone of uncertainty** around the extrapolated track, widening with lead time (the same concept as the National Hurricane Center's official forecast cone), so a 120-hour-out prediction is honestly shown as a wide band, not a false-precision single line
4. **Dynamically determines which districts fall inside the cone** at each forecast hour, instead of a hardcoded `district_id`
5. **Runs the full existing pipeline** (surge → rainfall-runoff → exposure → structural → insurance trigger) for every threatened district, at every forecast hour, producing a **time series of risk**, not a single snapshot

This is a legitimate, well-precedented approach for a hackathon/early-stage build — it is exactly what basic operational track forecasting looked like before ensemble NWP models existed, and it's honest about being a screening tool rather than a claimed replacement for IMD/JTWC's own forecasts.

### 2.2 Track & intensity extrapolation — new module

```
modeling/track_forecast/
├── __init__.py
├── extrapolation.py        # CLIPER-style track extrapolation from recent fixes
├── intensity_model.py      # simple intensification/decay model vs. time-to-landfall & basin climatology
└── uncertainty_cone.py     # growing forecast-cone geometry per lead-time hour
```

```python
# modeling/track_forecast/extrapolation.py (interface sketch)

@dataclass
class TrackFix:
    timestamp: datetime
    lat: float
    lon: float
    central_pressure_hpa: float
    max_wind_kmh: float
    forward_speed_kt: float
    heading_deg: float

def extrapolate_track(
    recent_fixes: list[TrackFix],
    lead_hours: list[int] = [24, 48, 72, 96, 120],
) -> list[TrackFix]:
    """
    CLIPER-style extrapolation: persists recent heading/speed, decays
    toward basin-seasonal climatological heading as lead time grows.
    Returns one predicted TrackFix per lead_hours entry.
    """
```

### 2.3 Cone of uncertainty (honesty about confidence)

```python
# modeling/track_forecast/uncertainty_cone.py (interface sketch)

def cone_radius_km(lead_hours: int) -> float:
    """
    Standard-error-style growth, calibrated against historical Bay of
    Bengal forecast-error statistics (mocked lookup table today,
    replaceable with a real historical-error regression later).
    e.g. 24h -> ~40km, 72h -> ~150km, 120h -> ~300km
    """

def build_cone_polygon(track_points: list[TrackFix]) -> dict:
    """Returns a GeoJSON polygon: the union of per-point radius circles."""
```

### 2.4 Dynamic threatened-district resolution

Instead of a hardcoded `district_id`, a new lookup replaces it:
```
GET /v1/storms/{storm_id}/threatened-districts
```
spatially joins the forecast cone polygon against a **district boundary registry** (already partly implied by the `districts` table — Phase 3 makes it a first-class, queryable registry rather than a single seeded row for Puri), returning every district whose boundary intersects the cone at any forecast hour, each tagged with its earliest possible landfall-impact hour.

---

## 3. Mock Dataset Design (today's data source, swappable later)

Rather than hand-waving "mock data," here is the concrete shape, matching the real bulletin schema already defined in `data-ingestion/weather/schemas.py` — so a real feed later requires zero downstream changes.

### 3.1 `data-ingestion/mock_data/active_storm_BOB07_2026.json`
```json
{
  "storm_id": "BOB07-2026",
  "basin": "bay_of_bengal",
  "status": "active_forecast",
  "name": "MOCK-NILAM",
  "genesis_time": "2026-09-28T00:00:00Z",
  "observed_fixes": [
    {"timestamp": "2026-09-28T00:00:00Z", "lat": 14.2, "lon": 88.1, "central_pressure_hpa": 1000, "max_wind_kmh": 45,  "forward_speed_kt": 8,  "heading_deg": 310, "category": "Depression"},
    {"timestamp": "2026-09-28T12:00:00Z", "lat": 14.9, "lon": 87.3, "central_pressure_hpa": 992,  "max_wind_kmh": 65,  "forward_speed_kt": 9,  "heading_deg": 315, "category": "Deep Depression"},
    {"timestamp": "2026-09-29T00:00:00Z", "lat": 15.7, "lon": 86.4, "central_pressure_hpa": 978,  "max_wind_kmh": 85,  "forward_speed_kt": 10, "heading_deg": 320, "category": "Cyclonic Storm"}
  ],
  "next_fix_release_interval_hours": 6
}
```

### 3.2 `data-ingestion/mock_data/rainfall_grid_BOB07_2026.json`
A grid of `{lat, lon, rainfall_mm_24h, rainfall_mm_48h, wind_speed_kmh}` cells covering the current forecast cone, regenerated as the mock feed advances — same shape `rainfall_forecast.py` already expects from a real provider.

### 3.3 Mock feed progression (what makes it feel "real-time")
`MockCycloneProvider` doesn't just return this file statically — it simulates the passage of time: each time it's polled, it appends one new synthetic `observed_fix` (continuing the storm's evolution: intensifying, making landfall, then weakening), so repeated polling across a demo session genuinely shows a storm developing, exactly as a live bulletin feed would.

---

## 4. Futureproof Architecture — the Part That Matters Most

The goal: **swapping the mock feed for IMD/JTWC/GDACS later, or adding a new basin (Pacific typhoons, Atlantic hurricanes), or swapping the surge model for ADCIRC, should never require touching a router, a frontend component, or a database schema.** Four patterns make that true.

### 4.1 Provider adapter interface (data source is swappable)

```
data-ingestion/providers/
├── base.py                    # abstract interfaces, below
├── mock_cyclone_provider.py   # today's implementation
├── mock_meteo_provider.py
├── imd_provider.py            # stub — same interface, real HTTP calls, added later
├── jtwc_provider.py           # stub
└── gdacs_provider.py          # stub
```

```python
# data-ingestion/providers/base.py

class CycloneDataProvider(ABC):
    @abstractmethod
    def list_active_storms(self) -> list[StormSummary]: ...

    @abstractmethod
    def get_track(self, storm_id: str) -> list[TrackFix]: ...

class MeteorologicalProvider(ABC):
    @abstractmethod
    def get_rainfall_forecast(self, bbox: BoundingBox, lead_hours: int) -> RainfallGrid: ...
```

Which concrete provider is active is chosen entirely by config (`PROVIDER_MODE=mock|imd|jtwc|gdacs` in `.env`), resolved once at startup through a registry — every downstream call goes through the interface, never a concrete class.

```python
# backend/registry/provider_registry.py

PROVIDER_REGISTRY: dict[str, CycloneDataProvider] = {
    "mock": MockCycloneProvider(),
    "imd": IMDProvider(),     # not yet implemented — raises NotImplementedError today
    "jtwc": JTWCProvider(),
    "gdacs": GDACSProvider(),
}

def get_active_cyclone_provider() -> CycloneDataProvider:
    return PROVIDER_REGISTRY[settings.PROVIDER_MODE]
```

**Contract test suite** (`tests/contract/test_provider_contract.py`): any provider — mock or real — must pass the same test suite (returns well-formed `TrackFix` objects, timestamps are monotonic, required fields present) before it can be switched on. This is what actually prevents a future real-API integration from silently breaking every model downstream.

### 4.2 Hazard model registry (models are swappable, versioned, and comparable side-by-side)

```python
# backend/registry/model_registry.py

MODEL_REGISTRY = {
    "surge": {
        "parametric-v0.3": run_parametric_surge_model,     # today's model
        # "geoclaw-v1": run_geoclaw_surge_model,           # added later, same call signature
    },
    "structural_fragility": {
        "hazus-generic-v1": run_generic_fragility_model,
        # "bob-calibrated-v1": run_regional_fragility_model,
    },
}
```
Every model registered under the same key must accept the same input dataclass and return the same result dataclass — this is what lets a new model be A/B tested against the old one on the same historical events before it's promoted to default, and lets the API report `model_version` on every response without the caller needing to know which implementation ran.

### 4.3 Basin/region configuration (expanding beyond Bay of Bengal is a config change, not a rewrite)

```
backend/config/basins/
├── bay_of_bengal.yaml
└── _template.yaml
```
```yaml
# bay_of_bengal.yaml
basin_id: bay_of_bengal
seasonal_climatology_heading_deg: 315
cone_radius_lookup_km: {24: 40, 48: 90, 72: 150, 96: 220, 120: 300}
surge_calibration: {A: 0.0042, B: 0.0008, C: 0.012}
advisory_languages: [en, bn, or, my]
```
A future Pacific-typhoon or Atlantic-hurricane basin is added by writing a new YAML file against `_template.yaml`, not by editing Python. All basin-specific constants currently hardcoded in `parametric_surge.py` (Phase 1) move here in Phase 3.

### 4.4 API versioning & schema versioning
- All new endpoints are introduced under `/v1/...` from this point forward (the existing unversioned endpoints from Phase 1/2 are kept working as-is and can be aliased under `/v1/` too)
- Every JSON response carries a `"schema_version"` field
- Every Gemini prompt template declares which schema version it was written against, so a future payload shape change fails a prompt-eval test loudly instead of silently producing a malformed advisory

### 4.5 Feature flags
```python
# backend/config/feature_flags.py
FEATURE_FLAGS = {
    "live_forecast_mode": True,
    "structural_engineering_module": True,
    "rapid_damage_assessment": False,   # can be rolled out independently, per deployment
}
```
Lets a given deployment (e.g., a partner DDMA piloting the tool) enable only the capabilities they've validated, without a code branch per customer.

---

## 5. New Database Additions

```sql
CREATE TABLE active_storms (
    storm_id            TEXT PRIMARY KEY,
    basin_id            TEXT REFERENCES basins(basin_id),
    name                TEXT,
    status              TEXT,             -- active_forecast | dissipated | post_landfall
    provider_source      TEXT,             -- mock | imd | jtwc | gdacs
    genesis_time         TIMESTAMPTZ,
    last_updated         TIMESTAMPTZ
);

CREATE TABLE storm_track_points (
    point_id             TEXT PRIMARY KEY,
    storm_id             TEXT REFERENCES active_storms(storm_id),
    point_type           TEXT,             -- observed | forecast
    lead_hours           INTEGER,          -- null for observed points
    timestamp             TIMESTAMPTZ,
    lat                   NUMERIC,
    lon                   NUMERIC,
    central_pressure_hpa  NUMERIC,
    max_wind_kmh          NUMERIC,
    category              TEXT
);

CREATE TABLE forecast_cones (
    cone_id              TEXT PRIMARY KEY,
    storm_id             TEXT REFERENCES active_storms(storm_id),
    generated_at          TIMESTAMPTZ,
    geom                  GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE threatened_districts (
    id                   TEXT PRIMARY KEY,
    storm_id             TEXT REFERENCES active_storms(storm_id),
    district_id          TEXT REFERENCES districts(district_id),
    earliest_impact_hour  INTEGER,
    computed_at            TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. New API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/v1/storms/active` | List currently active/forming storms (mock provider today) |
| `GET` | `/v1/storms/{storm_id}/track` | Observed fixes + forecast fixes with lead-time labels |
| `GET` | `/v1/storms/{storm_id}/cone` | Forecast cone-of-uncertainty polygon |
| `GET` | `/v1/storms/{storm_id}/threatened-districts` | Dynamically resolved district list, per forecast hour |
| `POST` | `/v1/storms/{storm_id}/run-live-pipeline` | Runs the full hazard→structural→trigger pipeline for every threatened district, at every forecast hour |
| `GET` | `/v1/storms/{storm_id}/risk-timeline` | Time series of risk (not a single snapshot) across the forecast window |
| `WS` | `/ws/storms/{storm_id}` | Live push as the mock feed (or later, a real feed) advances |

---

## 7. Frontend Additions

```
frontend/src/pages/
└── LiveStormTracker.tsx     # new landing view: list of active storms, click into one

frontend/src/components/
├── StormTrackMap.tsx        # observed track (solid) + forecast track (dashed) + cone (shaded), on the existing MapView base
├── ConeConfidenceLegend.tsx # explains what the widening cone means, avoids false precision
├── RiskTimelineChart.tsx    # recharts view of risk-timeline across forecast hours
└── ProviderModeBadge.tsx    # small UI badge showing "Data source: MOCK" vs a real provider, so a demo never misrepresents itself as live official data
```

`LiveStormTracker` becomes the new default landing page; the existing historical-replay Dashboard (Fani/Amphan/etc.) becomes a secondary "Past Events" mode, reusing the same `MapView`/`RiskPanel` components — no duplicate UI logic.

---

## 8. Build Roadmap (this phase, 6 weeks)

| Sprint | Weeks | Focus |
|---|---|---|
| 1 | 1–2 | Provider adapter interfaces + `MockCycloneProvider`/`MockMeteoProvider` + mock dataset files + contract test suite |
| 2 | 2–3 | Track/intensity extrapolation + uncertainty cone + dynamic threatened-district resolution |
| 3 | 3–4 | Model registry + basin config extraction (move hardcoded constants out of `parametric_surge.py` into `bay_of_bengal.yaml`) |
| 4 | 4–5 | New `/v1/storms/*` endpoints + WebSocket live-poll job + risk-timeline aggregation |
| 5 | 5–6 | Frontend: `LiveStormTracker`, `StormTrackMap`, cone legend, risk timeline chart, provider-mode badge |

---

## 9. Risks & Mitigations (specific to this phase)

| Risk | Mitigation |
|---|---|
| Mock data mistaken for a real forecast in a demo or pitch | `ProviderModeBadge` always visibly labels the active data source; mock storm is named distinctly (`MOCK-NILAM`) rather than reusing a real storm name |
| CLIPER-style extrapolation presented as more accurate than it is | Cone of uncertainty is always rendered, widening with lead time; every forecast API response carries `confidence: "extrapolated"` distinct from `confidence: "observed"` |
| Swapping in a real provider later silently breaks the pipeline | Contract test suite (Section 4.1) is a required gate before any new provider is switched from stub to active |
| Basin-config extraction breaks the existing Fani/Amphan historical replay | Existing historical calibration constants are moved into `bay_of_bengal.yaml` verbatim first, with the full Phase 1/2 test suite re-run against them before anything else changes |
| Feature flags left inconsistent across environments | Feature flag state is logged on every pipeline run (`schema_version` + active flags), so any output can be traced back to exactly which capabilities were enabled |
