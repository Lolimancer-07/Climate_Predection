/**
 * frontend/src/components/GcsMissionStatusBar.tsx
 *
 * GCS Mission Status Hero Ribbon.
 * High-density operational HUD displaying cyclone classification, central pressure,
 * sustained wind speed, storm surge peak, exposed population, lead time, and parametric status.
 */
import React from 'react';
import { useStorm } from '../context/StormContext';
import {
  Activity,
  AlertTriangle,
  Compass,
  Gauge,
  ShieldAlert,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';

interface GcsMissionStatusBarProps {
  stormCategory?: string;
  centralPressure?: number;
  maxWindKmh?: number;
  peakSurgeM?: number;
  exposedPopulation?: number;
}

export function GcsMissionStatusBar({
  stormCategory = 'Category 4 Super Cyclone',
  centralPressure = 932,
  maxWindKmh = 215,
  peakSurgeM = 4.2,
  exposedPopulation = 240000,
}: GcsMissionStatusBarProps) {
  const { simLeadTime, activeScenario } = useStorm();

  const isTriggered = centralPressure <= 940 && maxWindKmh >= 180;

  return (
    <div className="w-full border-y border-border/80 bg-gradient-to-r from-card via-card/90 to-card px-4 py-3 shadow-md backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        {/* Metric 1: Storm Category */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/15 text-destructive shadow-sm">
            <ShieldAlert className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Classification
            </div>
            <div className="font-heading text-sm font-bold text-foreground">
              {stormCategory}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Landfall ETA: <span className="font-mono font-bold text-primary">T-{simLeadTime}h</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Central Pressure */}
        <div className="flex items-center gap-3 border-l border-border/60 pl-4">
          <Gauge className="h-5 w-5 text-sky-400" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Barometer Deficit
            </div>
            <div className="font-mono text-base font-bold text-sky-400">
              {centralPressure} <span className="text-xs text-muted-foreground">hPa</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              ΔP = -{1013 - centralPressure} hPa
            </div>
          </div>
        </div>

        {/* Metric 3: Sustained Wind */}
        <div className="flex items-center gap-3 border-l border-border/60 pl-4">
          <Wind className="h-5 w-5 text-amber-400" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Sustained Wind
            </div>
            <div className="font-mono text-base font-bold text-amber-400">
              {maxWindKmh} <span className="text-xs text-muted-foreground">km/h</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Gusts: 245 km/h
            </div>
          </div>
        </div>

        {/* Metric 4: Peak Surge */}
        <div className="flex items-center gap-3 border-l border-border/60 pl-4">
          <Waves className="h-5 w-5 text-cyan-400" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Peak Storm Surge
            </div>
            <div className="font-mono text-base font-bold text-cyan-400">
              +{peakSurgeM.toFixed(1)} <span className="text-xs text-muted-foreground">m MSL</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Puri Coastal Ward 7
            </div>
          </div>
        </div>

        {/* Metric 5: Exposed Population */}
        <div className="hidden items-center gap-3 border-l border-border/60 pl-4 lg:flex">
          <Compass className="h-5 w-5 text-purple-400" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Pop. At Inundation Risk
            </div>
            <div className="font-mono text-base font-bold text-purple-400">
              {(exposedPopulation / 1000).toFixed(0)}k <span className="text-xs text-muted-foreground">citizens</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              64% Sheltered
            </div>
          </div>
        </div>

        {/* Metric 6: Parametric Insurance Trigger Status */}
        <div className="flex items-center gap-2 border-l border-border/60 pl-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Parametric Trigger
            </span>
            <span
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                isTriggered
                  ? 'border border-purple-500/50 bg-purple-500/15 text-purple-400 animate-pulse'
                  : 'border border-border bg-muted text-muted-foreground'
              }`}
            >
              {isTriggered ? 'TRIGGERED (100% AUDIT)' : 'PENDING'}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">
              HMAC-SHA256 Signed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
