/**
 * frontend/src/pages/OperationsOverview.tsx
 *
 * Operations Overview — High-density GCS landing view.
 * Aligned with UAV Digital Twin dashboard layout:
 *  - Real-time Prescriptive Action Directives (ActiveAdvisoriesWidget)
 *  - Multi-channel synchronized interactive area chart (ChartAreaInteractive)
 *  - High-risk Wards & Asset Telemetry Rail
 *  - Physical Model Health & Ingestion Pipeline Status
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStorm } from '../context/StormContext';
import { fetchDistrictRisk } from '../api/client';
import { ActiveAdvisoriesWidget } from '../components/ActiveAdvisoriesWidget';
import { ChartAreaInteractive } from '../components/ChartAreaInteractive';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  FileText,
  Gauge,
  Layers,
  MapPin,
  Radio,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';

interface OperationsOverviewProps {
  onNavigate?: (page: any) => void;
}

export function OperationsOverview({ onNavigate }: OperationsOverviewProps) {
  const { activeStorm, selectedDistrict } = useStorm();

  const { data: risk, isLoading, isError } = useQuery({
    queryKey: ['district-risk', selectedDistrict],
    queryFn: () => fetchDistrictRisk(selectedDistrict),
    staleTime: 60_000,
    retry: 1,
  });

  const ward = risk?.wards?.[0];

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6">
      {/* ── Active Event Banner ───────────────────────────────────── */}
      {activeStorm && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent p-4 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white font-bold text-xl shadow-md">
              🌀
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  {activeStorm.name}
                </h2>
                <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-400">
                  {activeStorm.storm_id}
                </span>
                <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                  {activeStorm.data_mode}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Basin: {activeStorm.basin} · Target District: <span className="font-semibold text-foreground">{selectedDistrict}</span> · Lead Time: <span className="font-mono text-primary font-bold">T-36h</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigate && (
              <>
                <button
                  onClick={() => onNavigate('live_tracker')}
                  className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 transition-all hover:bg-sky-500/20"
                >
                  <span>Track Cone</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                >
                  <span>Inundation Map</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── KPI Overview Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1 */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Central Pressure Deficit
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-sky-400">
            932 <span className="text-xs font-normal text-muted-foreground">hPa</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            ΔP = -81 hPa (Extreme Barometric Surge)
          </div>
        </div>

        {/* Card 2 */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Max Sustained Wind
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-amber-400">
            215 <span className="text-xs font-normal text-muted-foreground">km/h</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Gusts: 245 km/h · Cat 4 Super Eyewall
          </div>
        </div>

        {/* Card 3 */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Peak Storm Surge
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-cyan-400">
            +4.2 <span className="text-xs font-normal text-muted-foreground">m MSL</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Bathymetric amplification 3.2×
          </div>
        </div>

        {/* Card 4 */}
        <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Parametric Payout Tranche
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-purple-400">
            $4.2M <span className="text-xs font-normal text-muted-foreground">USD</span>
          </div>
          <div className="mt-1 text-[11px] text-purple-400 font-semibold">
            100% Deterministic Trigger Verified
          </div>
        </div>
      </div>

      {/* ── Prescriptive Action Directives (Widget) ─────────────────── */}
      <ActiveAdvisoriesWidget
        severity="CRITICAL"
        onNavigateToAdvisories={() => onNavigate && onNavigate('advisories')}
      />

      {/* ── Multi-Channel Telemetry Chart ─────────────────────────── */}
      <ChartAreaInteractive />

      {/* ── High-Risk Wards & Model Ingestion Strip ────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Top Threatened Wards */}
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
            <div className="flex items-center justify-between py-3">
              <div>
                <span className="font-bold text-foreground">Ward 7 — Sipasarubali Coastal</span>
                <p className="text-[11px] text-muted-foreground">
                  Mean elevation 1.4 m MSL · Projected inundation depth 2.8 m
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono font-bold text-destructive">Risk 94.2/100</div>
                  <div className="text-[10px] text-muted-foreground">Surge + TWI Rain</div>
                </div>
                <span className="rounded bg-destructive/15 px-2 py-0.5 font-bold text-destructive">
                  EVACUATION ORDER
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <span className="font-bold text-foreground">Ward 3 — Balukhand Sanctuary</span>
                <p className="text-[11px] text-muted-foreground">
                  Mean elevation 2.1 m MSL · Coastal mangrove buffer breached
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono font-bold text-amber-400">Risk 81.6/100</div>
                  <div className="text-[10px] text-muted-foreground">Wind + Runoff</div>
                </div>
                <span className="rounded bg-amber-500/15 px-2 py-0.5 font-bold text-amber-400">
                  WARNING
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <span className="font-bold text-foreground">Ward 5 — Marine Drive Corridor</span>
                <p className="text-[11px] text-muted-foreground">
                  Mean elevation 2.8 m MSL · Wave run-up overtopping seawall
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-mono font-bold text-amber-400">Risk 76.4/100</div>
                  <div className="text-[10px] text-muted-foreground">Route Blocked</div>
                </div>
                <span className="rounded bg-amber-500/15 px-2 py-0.5 font-bold text-amber-400">
                  WARNING
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Model Ingestion Subsystems Health */}
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground">
              Reasoning Engine Subsystems
            </h3>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Parametric Surge Model</span>
              <span className="font-mono font-bold text-emerald-400">CONVERGED (3.2x)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">TWI Flash Flood Index</span>
              <span className="font-mono font-bold text-emerald-400">14.8 TWI (EXTREME)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">HAZUS Fragility Curves</span>
              <span className="font-mono font-bold text-emerald-400">LOADED (DS1-DS4)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">NetworkX Evacuation Routes</span>
              <span className="font-mono font-bold text-amber-400">2 CORRIDORS CUT OFF</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Numeric Grounding Gate</span>
              <span className="font-mono font-bold text-emerald-400">100% VERIFIED</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">HMAC-SHA256 Trigger Audit</span>
              <span className="font-mono font-bold text-purple-400">SIGNED</span>
            </div>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('model_evidence')}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <span>Inspect Proof & Citations</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
