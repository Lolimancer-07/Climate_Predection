"""
backend/main.py
FastAPI application entrypoint.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.db.session import init_db
from backend.routers import ingest, risk, advisory, insurance, assets
from backend.routers import pipeline, structural, damage_assessment, storms
from backend.routers import hazards, notifications
from backend.routers import scenarios, v1_advisory


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    await init_db()
    yield


app = FastAPI(
    title="Kavach — Anticipatory Disaster Intelligence Platform",
    description=(
        "AI + Satellite + Structural-Physics Powered Anticipatory Disaster Intelligence "
        "and Parametric Liquidity Platform covering All-India Multi-Hazards."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

# CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers — Phase 1
app.include_router(ingest.router, prefix="/ingest", tags=["Ingestion"])
app.include_router(risk.router, prefix="/risk", tags=["Risk"])
app.include_router(advisory.router, prefix="/advisory", tags=["Advisory"])
app.include_router(insurance.router, prefix="/insurance", tags=["Insurance"])
app.include_router(assets.router, prefix="/assets", tags=["Assets"])

# Routers — Phase 2
app.include_router(pipeline.router)          # /pipeline/run, /pipeline/status, /ws/risk
app.include_router(structural.router)        # /structural/{district_id}
app.include_router(damage_assessment.router) # /damage-assessment/{event_id}

# Routers — Phase 3
app.include_router(storms.router)            # /v1/storms/*
app.include_router(storms.runs_router)       # /v1/runs/*

# Routers — Phase 4
app.include_router(hazards.router)           # /v1/national/overview, /v1/hazards/*, /v1/states, /v1/districts
app.include_router(notifications.router)     # /v1/notifications/*

# Routers — Phase 2/3 (new durable endpoints)
app.include_router(scenarios.router)         # /v1/scenarios
app.include_router(v1_advisory.router)       # /v1/advisories
app.include_router(v1_advisory.admin_router) # /v1/admin/audit-export


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "platform": "cyclone-anticipatory-action"}
