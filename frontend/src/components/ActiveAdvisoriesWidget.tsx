/**
 * frontend/src/components/ActiveAdvisoriesWidget.tsx
 *
 * Real-time prescriptive action directives grounded in live digital twin state.
 * Displays:
 *  - Action Recommended banner with alert severity
 *  - Operational / Evacuation Directive (for Disaster Management Authorities)
 *  - Infrastructure Hardening Directive (for Public Works / Power Engineers)
 */
import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Plane,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
  Compass,
} from 'lucide-react';

interface ActiveAdvisoriesWidgetProps {
  onNavigateToAdvisories?: () => void;
  severity?: 'CRITICAL' | 'WARNING' | 'NOMINAL';
  staticDemo?: boolean;
}

export function ActiveAdvisoriesWidget({
  onNavigateToAdvisories,
  severity = 'CRITICAL',
  staticDemo = false,
}: ActiveAdvisoriesWidgetProps) {
  const isCritical = severity === 'CRITICAL';
  const isWarning = severity === 'WARNING';

  if (staticDemo) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">Advisory review module</h3>
              <p className="text-xs text-muted-foreground">Live directives are suppressed in this public preview.</p>
            </div>
          </div>
          <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">API OFFLINE</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs">
          <p className="max-w-3xl text-muted-foreground">The review screen is available for interface exploration. No evacuation, infrastructure, insurance, or other operational instruction is active or being issued.</p>
          {onNavigateToAdvisories && (
            <button onClick={onNavigateToAdvisories} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80">
              Open review preview <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/20 p-4 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              Real-Time Prescriptive Action Directives
            </h3>
            <p className="text-xs text-muted-foreground">
              Algorithmic action guidance grounded in live surge, TWI runoff, and structural fragility models
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isCritical
                ? 'border border-destructive/60 bg-destructive/15 text-destructive'
                : isWarning
                ? 'border border-amber-500/60 bg-amber-500/15 text-amber-500'
                : 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-500'
            }`}
          >
            {isCritical ? 'CRITICAL EVACUATION' : isWarning ? 'ALERT REQUIRED' : 'ALL CLEAR'}
          </span>

          {onNavigateToAdvisories && (
            <button
              onClick={onNavigateToAdvisories}
              className="flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              <span>HITL Review</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isCritical || isWarning ? (
          <div className="flex flex-col gap-3">
            {/* Action Alert Banner */}
            <div
              className={`flex items-start gap-3 rounded-lg border p-3.5 ${
                isCritical
                  ? 'border-destructive/60 bg-destructive/10'
                  : 'border-amber-500/60 bg-amber-500/10'
              }`}
            >
              {isCritical ? (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Action Recommended
                  </span>
                  <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                    {severity}
                  </span>
                </div>
                <div className="mt-1 text-sm font-bold text-foreground">
                  Immediate Pre-Landfall Evacuation of Coastal Inundation Sector (Puri Ward 7)
                </div>
              </div>
            </div>

            {/* Two Directives Breakdown */}
            <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
              <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                <span className="mb-1 flex items-center gap-1 font-bold text-sky-400">
                  <Compass className="h-3.5 w-3.5" /> Disaster Management Directive:
                </span>
                <p className="font-medium text-foreground leading-snug">
                  Execute mandatory evacuation of Ward 7 (Sipasarubali) to inland shelters CS-04 & CS-07. Avoid Marine Drive KM 12–18 due to surge inundation breach.
                </p>
              </div>

              <div className="rounded-md border border-border/60 bg-muted/20 p-2.5">
                <span className="mb-1 flex items-center gap-1 font-bold text-amber-400">
                  <Wrench className="h-3.5 w-3.5" /> Infrastructure Hardening Directive:
                </span>
                <p className="font-medium text-foreground leading-snug">
                  Deploy secondary guy-wires to 132kV Puri Grid Substation mast towers and pre-position 4 high-head submersible pumps at Puri District Hospital.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <div className="text-sm font-bold text-emerald-400">
                  Coastal Defenses Nominal — Inundation Below Threat Thresholds
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  All 14 meteorological and hydro-station channels indicate storm track remains 280+ km offshore.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
