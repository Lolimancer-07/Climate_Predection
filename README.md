# Anticipatory Action Platform — Bay of Bengal & Coastal APAC Cyclones
### AI-Powered Predictive Risk, Vulnerability Modeling & Parametric Insurance Trigger Platform

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

This platform shifts cyclone disaster response **left** into the 24–120 hour pre-landfall window by fusing:

1. **Storm surge simulation** — where the water will go  
2. **Rainfall damage pathway prediction** — where flash floods and waterlogging will happen  
3. **Critical infrastructure exposure mapping** — what gets hit (power grids, roads, hospitals, shelters)  
4. **Automated early-warning dispatch** — getting the right advisory to the right authority in time to act  
5. **Parametric insurance liquidity trigger** — payouts can move *before* landfall rather than months after  

**Powered by:** Google Earth Engine · Gemini 3.7 Flash (multimodal) · FastAPI · PostGIS · React + MapLibre GL

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (for local PostGIS)
- Google Earth Engine service account
- Gemini API key (Google AI Studio or Vertex AI)
- Twilio account (sandbox mode for demo)

### Quick Run (Unified Script)

To start both the FastAPI backend and React frontend concurrently with automatic port collision checking and graceful Ctrl+C shutdown:

```bash
./run.sh
```

Or to automatically stop existing instances on ports 8000/5173 and restart:
```bash
./run.sh --restart
```

---

### Manual Step-by-Step Setup

### 1. Clone & configure

```bash
git clone <repo-url>
cd cyclone-anticipatory-platform
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start PostGIS via Docker
docker-compose up -d db

# Run migrations
alembic upgrade head

# Start FastAPI dev server
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### 4. Run the demo pipeline

```bash
# Replay Cyclone Fani 2019 from T-72h
python -m scripts.demo_run --cyclone FANI-2019 --district IN-OD-PURI --hours-before-landfall 72
```

---

## Architecture

```
Cyclone Bulletin -> GEE Terrain/Land-Cover -> Parametric Surge Model
                                           -> Rainfall-Runoff Model
                                           |
                              Infrastructure Exposure Overlay
                                           |
                              Gemini 3.7 Flash (multimodal fusion)
                                    |           |
                           Advisory Draft   Insurance Trigger
                                    |           |
                         Human Review Gate (HITL)
                                    |
                    SMS / WhatsApp / CAP XML / PDF / Insurer Webhook
```

See `docs/architecture.md` for the full layered diagram.

---

## Demo Scenario

**Primary: Cyclone Fani (2019, Odisha, India)** — the real evacuation of ~1.2 million people.

```bash
python -m scripts.demo_run --cyclone FANI-2019 --district IN-OD-PURI
```

**Secondary: Cyclone Mocha (2023, Myanmar/Bangladesh)** — multi-country credibility.

---

## Project Structure

```
.
|-- data-ingestion/     # GEE, weather forecast, and OSM exposure data pulls
|-- modeling/           # Surge, rainfall-runoff, exposure scoring, insurance trigger
|-- ai-reasoning/       # Gemini integration, prompts, output validator
|-- dispatch/           # SMS, WhatsApp, CAP XML, PDF, insurer webhook
|-- backend/            # FastAPI app, routers, DB models
|-- frontend/           # React + MapLibre GL dashboard
|-- tests/              # Unit, integration, and prompt-eval tests
|-- notebooks/          # Exploration and calibration notebooks
`-- docs/               # Architecture, data sources, advisory templates
```

---

## Responsible AI

- **No autonomous dispatch:** Every advisory and insurance trigger requires an explicit human confirmation click.
- **Deterministic financial logic:** The insurance trigger boolean is computed from structured hazard data only — never from LLM output.
- **Numeric grounding:** Post-generation validator checks every number in Gemini output against the source JSON before it enters the review queue.
- **Auditability:** Full timestamp/operator/model-version audit trail for every dispatch and trigger.

---

## License

MIT
