/**
 * OperationsOverview.tsx — Cyclone Anticipatory Action Platform
 *
 * Full GCS-style dashboard page, mirroring UAV Digital Twin dashboard/page.tsx:
 *  - GcsMissionStatusBar (storm telemetry HUD)
 *  - SectionCards (8 KPI cards in 2 rows)
 *  - CycloneTwinShowcase (main digital twin section)
 *  - ActiveAdvisoriesWidget
 *  - ChartAreaInteractive (telemetry chart)
 *  - Subsystem grid (ward table + reasoning engine status)
 */
import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  Brain,
  Map,
  MapPin,
  Shield,
  ShieldCheck,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { GcsMissionStatusBar } from "../components/GcsMissionStatusBar";
import { SectionCards } from "../components/SectionCards";
import { CycloneTwinShowcase } from "../components/CycloneTwinShowcase";
import { ActiveAdvisoriesWidget } from "../components/ActiveAdvisoriesWidget";
import { ChartAreaInteractive } from "../components/ChartAreaInteractive";

interface Props {
  onNavigate?: (page: string) => void;
}

const WARDS = [
  {
    name: "Ward 7 — Sipasarubali Coastal",
    elev: "1.4 m MSL",
    depth: "2.8 m",
    risk: 94.2,
    label: "EVACUATION ORDER",
    color: "destructive" as const,
  },
  {
    name: "Ward 3 — Balukhand Sanctuary",
    elev: "2.1 m MSL",
    depth: "Coastal buffer breached",
    risk: 81.6,
    label: "WARNING",
    color: "warning" as const,
  },
  {
    name: "Ward 5 — Marine Drive Corridor",
    elev: "2.8 m MSL",
    depth: "Seawall overtopping",
    risk: 76.4,
    label: "WARNING",
    color: "warning" as const,
  },
  {
    name: "Ward 9 — Pentakota Estuary",
    elev: "3.1 m MSL",
    depth: "1.1 m projected",
    risk: 62.1,
    label: "WATCH",
    color: "sky" as const,
  },
];

const SUBSYSTEMS = [
  { label: "Parametric Surge Model", status: "CONVERGED (3.2×)", ok: true },
  { label: "TWI Flash Flood Index", status: "14.8 TWI (EXTREME)", ok: true },
  { label: "HAZUS Fragility Curves", status: "LOADED (DS1–DS4)", ok: true },
  { label: "NetworkX Evacuation Routes", status: "2 CORRIDORS CUT OFF", ok: false },
  { label: "Numeric Grounding Gate", status: "100% VERIFIED", ok: true },
  { label: "HMAC-SHA256 Trigger Audit", status: "SIGNED", ok: true, purple: true },
];

function badgeStyle(color: "destructive" | "warning" | "sky") {
  if (color === "destructive")
    return "bg-red-500/15 text-red-400 border border-red-500/30";
  if (color === "warning")
    return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
  return "bg-sky-500/15 text-sky-400 border border-sky-500/30";
}

export function OperationsOverview({ onNavigate }: Props) {
  const [selectedDistrict] = useState("IN-OD-PURI");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 py-4 md:gap-5 md:py-5">
      {/* ── Mission Status Hero Bar ─────────────────────────────────────── */}
      <GcsMissionStatusBar
        stormId="BOB07-2026 · BIPARJOY"
        windKmh={220}
        surgeM={4.2}
        rainfallMm={312}
        exposedPop={284000}
        alertLevel="CRITICAL"
        dataMode="FORECAST"
        wsConnected={true}
        onDispatch={() => onNavigate && onNavigate("advisories")}
      />

      {/* ── KPI Overview Cards ──────────────────────────────────────────── */}
      <SectionCards />

      {/* ── Core Content ────────────────────────────────────────────────── */}
      {/* Row 1: Digital Twin Showcase (full width) */}
      <div className="px-4 lg:px-6">
        <CycloneTwinShowcase />
      </div>

      {/* Row 2: Active Advisories */}
      <div className="px-4 lg:px-6">
        <ActiveAdvisoriesWidget
          severity="CRITICAL"
          onNavigateToAdvisories={() =>
            onNavigate && onNavigate("advisories")
          }
        />
      </div>

      {/* Row 3: Telemetry Chart */}
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>

      {/* Row 4: High-Risk Wards + Reasoning Engine Health */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:px-6">
        {/* Ward Risk Table */}
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-bold text-foreground">
                Highest-Risk Wards — {selectedDistrict}
              </h3>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              Spatially Resolved
            </span>
          </div>

          <div className="divide-y divide-border/40 text-xs">
            {WARDS.map((w) => (
              <div
                key={w.name}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <span className="font-bold text-foreground">{w.name}</span>
                  <p className="text-[11px] text-muted-foreground">
                    Mean elevation {w.elev} · {w.depth}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={`font-mono font-bold ${
                        w.color === "destructive"
                          ? "text-red-400"
                          : w.color === "warning"
                          ? "text-amber-400"
                          : "text-sky-400"
                      }`}
                    >
                      Risk {w.risk}/100
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Surge + TWI Rain
                    </div>
                  </div>
                  <span className={`rounded px-2 py-0.5 font-bold text-[10px] ${badgeStyle(w.color)}`}>
                    {w.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reasoning Engine Subsystems */}
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground">
              Reasoning Engine Subsystems
            </h3>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            {SUBSYSTEMS.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{s.label}</span>
                <span
                  className={`font-mono font-bold ${
                    s.purple
                      ? "text-violet-400"
                      : s.ok
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate("model_evidence")}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <span>Inspect Proof &amp; Citations</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
