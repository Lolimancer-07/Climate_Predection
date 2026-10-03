# Kavach — AI + Satellite + Structural-Physics Powered Anticipatory Disaster Intelligence

[![Domain](https://img.shields.io/badge/Domain-All--India%20%26%20Coastal%20APAC-1f6feb.svg)]()
[![Hazard Coverage](https://img.shields.io/badge/Hazard%20Coverage-8%20Perils-orange.svg)]()
[![Architecture](https://img.shields.io/badge/Architecture-Pluggable%20Multi--Hazard%20Framework-purple.svg)]()
[![Reasoning](https://img.shields.io/badge/Reasoning-Gemini%203.7%20Flash%20Multimodal-2ea44f.svg)]()
[![Geospatial](https://img.shields.io/badge/Geospatial-Google%20Earth%20Engine-4285F4.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Detect → Forecast → Model Exposure → Assess Structure → Reason (Gemini) → Draft Advisory → Notify → Trigger Liquidity → Protect Lives & Livelihoods**

A national-scale anticipatory action platform that fuses Google Earth Engine satellite data, real-time meteorological and hydrological telemetry, structural engineering fragility physics, and Gemini 3.7 Flash multimodal reasoning into one unified decision pipeline. 

Kavach turns a cyclone bulletin, a river gauge reading, or an instrumental seismic detection into a ward-level risk map, a ranked infrastructure-hardening list, a dispatch-ready advisory, and an auditable parametric insurance trigger payload before or immediately after impact.

---

## 1. System Architecture & Information Pipeline

```
                    ┌───────────────────────────────────────────────────────────┐
                    │                    INGESTION LAYER                       │
                    │  GEE (DEM, land cover, flood history, population, fire)  │
                    │  IMD / JTWC / GDACS / CWC / USGS-style feeds (+ Mock)    │
                    │  OSM exposure data (roads, power, hospitals, shelters)   │
                    └───────────────────────────┬───────────────────────────────┘
                                                ▼
                    ┌───────────────────────────────────────────────────────────┐
                    │        PROVIDER ADAPTER REGISTRY  (mock ⇄ real, swappable)│
                    └───────────────────────────┬───────────────────────────────┘
                                                ▼
   ┌─────────────────────────────────────────────────────────────────────────────────────┐
   │                    HAZARD MODULE REGISTRY (pluggable, per hazard_type)               │
   │  1. Cyclone (surge + wind)   2. River Flood (CWC gauge)   3. Earthquake (post-event)│
   │  4. Landslide (I-D curves)   5. Heatwave (IMD criteria)   6. Drought (SPI-3/6)      │
   │  7. Wildfire (thermal FRP)   8. Tsunami (seismic run-up)                            │
   └───────────────────────────────────────┬─────────────────────────────────────────────┘
                                           ▼
   ┌─────────────────────────────────────────────────────────────────────────────────────┐
   │        EXPOSURE & STRUCTURAL/MECHANICAL ENGINEERING SCORING ENGINE                   │
   │   Spatial exposure × criticality   |   Wind-load & hydrodynamic force physics        │
   │   Fragility curves (HAZUS-style)   |   Hardening-priority ranking                    │
   └───────────────────────────────────────┬─────────────────────────────────────────────┘
                                           ▼
   ┌─────────────────────────────────────────────────────────────────────────────────────┐
   │            GEMINI 3.7 FLASH MULTIMODAL REASONING CORE                                │
   │   Visual/numeric consistency check → Risk brief → Localized advisory → Trigger notice│
   └───────────────────────────────────────┬─────────────────────────────────────────────┘
                                           ▼
   ┌─────────────────────────────────────────────────────────────────────────────────────┐
   │     UNIFIED NOTIFICATION SERVICE          │   PARAMETRIC INSURANCE TRIGGER ENGINE    │
   │  Email · SMS · WhatsApp · CAP-XML · Push  │   Deterministic, structured-data-only,   │
   │  Subscriptions, digests, delivery tracking│   auditable payout-initiation signal     │
   └───────────────────────────────────┬───────┴─────────────────┬─────────────────────────┘
                                       ▼                         ▼
                    ┌───────────────────────────────────────────────────────────┐
                    │      STANDARDIZED NATIONAL DASHBOARD (React GCS)          │
                    │  National → State → District → Ward drill-down            │
                    │  Live storm tracking · Hazard filters · Hardening lists   │
                    │  Human-in-the-loop review & dispatch on every action      │
                    └───────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Hazard Peril Coverage (8 Peril Framework)

| Peril | Modeling Approach | Key Physical Metrics | Governance & Honesty Note |
|---|---|---|---|
| **Cyclone** | Parametric surge model + bathtub fill + CLIPER track extrapolation | Peak surge ($m$), sustained wind ($km/h$), pressure ($hPa$) | Forecastable 24–120h prior to landfall |
| **Riverine Flood** | CWC gauge threshold exceedance + stage-discharge routing | River stage ($m$), danger level exceedance ($m$) | Forecastable 12–72h in advance |
| **Earthquake** | Campbell-Bozorgnia PGA attenuation & MMI ground-motion modeling | Peak Ground Acceleration ($\%g$), focal depth ($km$), $M_w$ | **Strictly post-event impact assessment only.** Earthquakes cannot be predicted in advance. |
| **Landslide** | Rainfall Intensity-Duration (I-D) thresholds + GSI slope susceptibility | 48h antecedent rain ($mm$), triggering probability ($\%$) | Triggering susceptibility during heavy rain events |
| **Heatwave** | IMD departure threshold criteria + urban heat island amplification | Max temperature ($^\circ C$), departure ($^\circ C$), wet-bulb ($^\circ C$) | Forecastable 3–5 days in advance |
| **Drought** | Standardized Precipitation Index (SPI-3 / SPI-6) + GEE soil moisture | SPI deficit, soil moisture percentile ($\%$) | Seasonal anticipatory trend for agri-liquidity |
| **Wildfire** | GEE active thermal anomalies (MODIS/VIIRS 375m) + wind spread vector | Fire Radiative Power ($MW$), spread rate ($km/h$) | Active fire perimeter detection + short-term spread |
| **Tsunami** | Shallow-water wave celerity ($c = \sqrt{gh}$) + Green's law amplification | Deep-sea amplitude ($m$), coastal run-up ($m$) | Chained event reacting to sub-sea seismic rupture ($M_w \ge 7.2$) |

---

## 3. Structural & Mechanical Engineering Stress Module

Moving beyond simple spatial overlap, Kavach calculates mechanical forces against physical assets:
1. **Wind Drag Load:**
   $$F_{\text{wind}} = \frac{1}{2} C_d \rho_{\text{air}} A V^2$$
2. **Surge Hydrodynamic & Hydrostatic Load:**
   $$F_{\text{surge}} = \frac{1}{2} C_d \rho_{\text{water}} A_{\text{submerged}} V_{\text{flow}}^2 + F_{\text{hydrostatic}}$$
3. **Bending Moments & Safety Factor for Line Assets:**
   $$\text{Safety Factor} = \frac{M_{\text{capacity}}}{F_{\text{wind}} \cdot h_{\text{application}}}$$
4. **Lognormal Fragility Curves (HAZUS-Style):**
   $$P(\text{Damage State} \mid V) = \Phi\left( \frac{\ln(V / \theta)}{\beta} \right)$$
5. **Hardening Priority Ranking:** Assets with safety factors $< 1.0$ prioritized by criticality for pre-landfall reinforcement.

---

## 4. Unified Notification Service (`notifications/`)

- **First-Class Channels:**
  - **Email:** Rich HTML templates for Watch, Warning, Emergency Evacuation Orders, and Pan-India Daily Situational Digests.
  - **SMS:** Field alerts via Twilio API with sandbox fallback.
  - **WhatsApp:** WhatsApp Business Cloud API integration for operational teams.
  - **Web/Mobile Push:** Real-time push alerts to browser workstations and mobile field tablets.
  - **CAP 1.2 XML:** Fully compliant OASIS Common Alerting Protocol export, interoperable with NDMA SACHET.
  - **Insurer Webhook:** Cryptographically signed HMAC-SHA256 payloads for parametric insurance liquidity releases.
- **Granular Subscription Management:** Opt-ins segmented by district, hazard peril, preferred channel, and frequency.
- **Strict Human-in-the-Loop Gate:** Mandatory operator confirmation (`HITL_ENFORCE_HUMAN_CONFIRMATION=true`) blocks autonomous dispatch.

---

## 5. Quick Start (One-Command Launcher)

```bash
# Unified launch: Digital Twin WS (:8765), FastAPI (:8000), Vite React Console (:5173)
./run.sh

# Or auto-kill existing port collisions and restart:
./run.sh --restart
```

### Run Tests (104 Unit & Integration Tests Passing)

```bash
.venv/bin/pytest --cov=. --cov-report=term
```

---

## 6. API Surface (FastAPI v2)

| Route | Method | Description |
|---|---|---|
| `/v1/national/overview` | `GET` | All-India 8-peril situational summary and active hazard events |
| `/v1/hazards/supported` | `GET` | List all 8 registered hazard perils |
| `/v1/hazards/{hazard}/active` | `GET` | Active events for a specific hazard type |
| `/v1/hazards/{hazard}/forecast/{id}` | `GET` | Physical footprint and forward trajectory forecast |
| `/v1/hazards/{hazard}/impact/{id}/{district}` | `GET` | Localized district exposure, population at risk, and parametric trigger |
| `/v1/states` | `GET` | All 28 States and 8 Union Territories with coastal flags |
| `/v1/districts` | `GET` | All registered districts across India |
| `/v1/earthquakes/{id}/shake-impact` | `GET` | Post-event rapid ground-motion shake assessment |
| `/v1/notifications/subscribe` | `POST` | Create opt-in subscription for citizen, operator, or insurer |
| `/v1/notifications/dispatch` | `POST` | Multi-channel dispatch (enforcing mandatory HITL gate) |
| `/v1/notifications/digest/send` | `POST` | Broadcast national daily situational multi-hazard digest |
| `/v1/storms/active` | `GET` | List active cyclone tracks and forecast cones |
| `/structural/{district_id}/hardening-priority`| `GET` | Ranked pre-landfall structural retrofit recommendations |

---

## 7. Aerospace GCS Cockpit (Frontend)

Built with **React 18 + TypeScript + Vite + MapLibre GL + TanStack Query + Tailwind CSS**:
- **National Multi-Hazard Overview:** Interactive India SVG basemap, peril filter bar, live pulsating alert anchors, and daily digest dispatch trigger.
- **District Digital Twin Workstation:** Dual-axis synchronized telemetry curves, EWMA district vulnerability index (0–100), and evacuation feasibility modeling.
- **Telemetry FDR Monitor:** Protocol sniffer and meteorological frame decoder.
- **Model Evidence & Proof:** Zero-hallucination numeric validation against upstream JSON payloads.
- **Cyclone Nexus AI Copilot:** Sliding copilot panel with intent classification across 12 disaster response categories.


## Public static preview

The `Deploy public static demo` GitHub Actions workflow builds and publishes the frontend to [GitHub Pages](https://lolimancer-07.github.io/Climate_Predection/). The Pages build is intentionally read-only: it shows an Esri street basemap and a clearly labeled illustrative overlay, but it does not connect to the API, display live hazard data, issue advisories, or dispatch actions. The FastAPI/PostGIS backend remains a separate deployment and must be hosted/configured before operational data can appear.
