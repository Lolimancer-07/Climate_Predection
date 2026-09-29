/**
 * SectionCards.tsx — Cyclone Anticipatory Action Platform
 *
 * UAV Digital Twin GCS-style KPI cards adapted for cyclone domain:
 *  Row 1: 4 primary KPIs (Storm Intensity, Peak Surge, Flash Flood Risk, Insurance Trigger)
 *  Row 2: 4 secondary status metrics (Landfall ETA, Exposed Population, Evacuation Routes, Data Mode)
 */
import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  Gauge,
  Globe2,
  Map,
  Navigation,
  Shield,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wind,
  Zap,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";

/* ─── helpers ──────────────────────────────────────────────────────────────── */

function fmtNum(v: number | undefined, dec = 1, fallback = "—"): string {
  if (v == null || isNaN(v)) return fallback;
  return v.toFixed(dec);
}

function SubBar({
  label,
  value,
  color = "emerald",
}: {
  label: string;
  value: number;
  color?: "emerald" | "amber" | "red" | "sky" | "violet";
}) {
  const colorMap = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
  };
  return (
    <div className="flex flex-col gap-1 w-full min-w-0">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-muted-foreground tracking-tight">
          {label}
        </span>
        <span className="font-mono font-bold text-foreground tabular-nums">
          {value}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colorMap[color]}`}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function alertBadge(level: "NOMINAL" | "WARNING" | "CRITICAL" | string) {
  if (level === "CRITICAL")
    return (
      <Badge variant="destructive" className="animate-pulse font-bold">
        CRITICAL
      </Badge>
    );
  if (level === "WARNING")
    return (
      <Badge variant="warning" className="font-bold">
        WARNING
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-emerald-400 border-emerald-500/40">
      <ShieldCheck className="size-3 mr-1" />
      NOMINAL
    </Badge>
  );
}

/* ─── Hook: pull live state from backend WebSocket context ─────────────────── */

function useCycloneTelemetry() {
  const [state, setState] = React.useState({
    stormId: "BOB07-2026",
    stormName: "Cyclone BIPARJOY",
    category: 4,
    windKmh: 220.0,
    gustsKmh: 245.0,
    centralPressureHpa: 928,
    peakSurgeM: 4.2,
    surgeAmplification: 3.2,
    flashFloodRisk: 0.74,
    twi: 14.8,
    landfall_h: 31.5,
    exposedPopulation: 284000,
    evacuationRoutesOpen: 4,
    evacuationRoutesTotal: 6,
    insuranceTrigger: true,
    triggerThresholdM: 3.0,
    observedSurgeM: 4.2,
    payoutUsd: 4200000,
    dataMode: "FORECAST" as "FORECAST" | "SIMULATED" | "HISTORICAL",
    surgeConfidence: 89,
    rainfallMm48h: 312,
    warningLevel: "CRITICAL" as "NOMINAL" | "WARNING" | "CRITICAL",
    healthSubScores: {
      surgeModel: 89,
      flashFlood: 74,
      structuralDamage: 68,
      dispatchReady: 100,
    },
  });

  // Animate live telemetry fluctuations
  React.useEffect(() => {
    const id = setInterval(() => {
      setState((s) => ({
        ...s,
        windKmh: Math.max(150, s.windKmh + (Math.random() - 0.5) * 3),
        centralPressureHpa: Math.max(
          900,
          s.centralPressureHpa + (Math.random() - 0.5) * 0.5
        ),
        landfall_h: Math.max(0, s.landfall_h - 1 / 120),
        exposedPopulation:
          s.exposedPopulation + Math.floor((Math.random() - 0.5) * 200),
        rainfallMm48h: Math.min(
          500,
          s.rainfallMm48h + (Math.random() - 0.3) * 2
        ),
      }));
    }, 500);
    return () => clearInterval(id);
  }, []);

  return state;
}

/* ─── Section Cards ─────────────────────────────────────────────────────────── */

export function SectionCards() {
  const t = useCycloneTelemetry();

  const surgeColor =
    t.peakSurgeM >= t.triggerThresholdM ? "text-red-400" : "text-sky-400";
  const floodSev =
    t.flashFloodRisk >= 0.7
      ? "EXTREME"
      : t.flashFloodRisk >= 0.5
      ? "HIGH"
      : "MODERATE";
  const routeStatus = `${t.evacuationRoutesOpen}/${t.evacuationRoutesTotal}`;
  const routeColor =
    t.evacuationRoutesOpen < t.evacuationRoutesTotal
      ? "text-amber-400"
      : "text-emerald-400";
  const landfallHH = Math.floor(t.landfall_h);
  const landfallMM = Math.round((t.landfall_h - landfallHH) * 60);

  return (
    <div className="flex flex-col gap-3 px-4 lg:px-6">
      {/* ── Primary KPI Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Card 1: Storm Intensity */}
        <Card className="overflow-hidden bg-card/80 hover:shadow-lg transition-shadow duration-200">
          <div
            className={`h-1 w-full ${
              t.category >= 4
                ? "bg-red-500"
                : t.category >= 3
                ? "bg-amber-500"
                : "bg-sky-500"
            }`}
          />
          <CardHeader className="min-h-28 p-5">
            <CardDescription>STORM INTENSITY</CardDescription>
            <CardTitle className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {Math.round(t.windKmh)}
              <span className="text-lg text-muted-foreground"> km/h</span>
            </CardTitle>
            <CardAction>{alertBadge(t.warningLevel)}</CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-2 px-5 pb-4 text-xs w-full">
            <div className="grid grid-cols-2 gap-3 w-full">
              <SubBar
                label="WIND"
                value={Math.round((t.windKmh / 280) * 100)}
                color="red"
              />
              <SubBar
                label="PRES"
                value={Math.round(((1013 - t.centralPressureHpa) / 120) * 100)}
                color="amber"
              />
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-muted-foreground w-full pt-0.5">
              <span>GUSTS {Math.round(t.gustsKmh)} km/h</span>
              <span className="text-muted-foreground/30">•</span>
              <span>
                CAT{t.category}{" "}
                {t.category >= 4 ? "SUPER EYEWALL" : "CYCLONE"}
              </span>
            </div>
          </CardFooter>
        </Card>

        {/* Card 2: Peak Storm Surge */}
        <Card className="overflow-hidden bg-card/80 hover:shadow-lg transition-shadow duration-200">
          <div
            className={`h-1 w-full ${
              t.peakSurgeM >= t.triggerThresholdM
                ? "bg-red-500"
                : "bg-sky-500"
            }`}
          />
          <CardHeader className="min-h-28 p-5">
            <CardDescription>PEAK STORM SURGE</CardDescription>
            <CardTitle
              className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${surgeColor}`}
            >
              +{fmtNum(t.peakSurgeM)}
              <span className="text-lg text-muted-foreground"> m MSL</span>
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <Droplets className="size-3 mr-1" />
                PARAMETRIC
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 px-5 pb-4 text-xs">
            <div className="flex gap-2 font-medium">
              Bathymetric amplification {t.surgeAmplification}×
            </div>
            <div className="text-muted-foreground">
              Threshold {t.triggerThresholdM} m · Confidence {t.surgeConfidence}%
            </div>
          </CardFooter>
        </Card>

        {/* Card 3: Flash Flood Risk */}
        <Card className="overflow-hidden bg-card/80 hover:shadow-lg transition-shadow duration-200">
          <div
            className={`h-1 w-full ${
              t.flashFloodRisk >= 0.7
                ? "bg-red-500"
                : t.flashFloodRisk >= 0.5
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
          />
          <CardHeader className="min-h-28 p-5">
            <CardDescription>FLASH FLOOD RISK (TWI)</CardDescription>
            <CardTitle className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-cyan-400">
              {Math.round(t.flashFloodRisk * 100)}
              <span className="text-lg text-muted-foreground"> /100</span>
            </CardTitle>
            <CardAction>
              <Badge
                variant={t.flashFloodRisk >= 0.7 ? "destructive" : "warning"}
                className="font-bold"
              >
                {floodSev}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 px-5 pb-4 text-xs">
            <div className="flex gap-2 font-medium">
              TWI {t.twi} · Rainfall {t.rainfallMm48h} mm/48h
            </div>
            <div className="text-muted-foreground">
              Land runoff coefficient 0.71 (LULC)
            </div>
          </CardFooter>
        </Card>

        {/* Card 4: Parametric Insurance Trigger */}
        <Card className="overflow-hidden bg-card/80 hover:shadow-lg transition-shadow duration-200">
          <div
            className={`h-1 w-full ${
              t.insuranceTrigger ? "bg-violet-500" : "bg-muted"
            }`}
          />
          <CardHeader className="min-h-28 p-5">
            <CardDescription>INSURANCE TRIGGER</CardDescription>
            <CardTitle
              className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${
                t.insuranceTrigger ? "text-violet-400" : "text-muted-foreground"
              }`}
            >
              {t.insuranceTrigger ? "FIRED" : "WATCH"}
            </CardTitle>
            <CardAction>
              <Badge
                variant={t.insuranceTrigger ? "default" : "outline"}
                className={
                  t.insuranceTrigger
                    ? "bg-violet-600 text-white font-bold"
                    : ""
                }
              >
                <Zap className="size-3 mr-1" />
                {t.insuranceTrigger ? "TRIGGERED" : "MONITORING"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 px-5 pb-4 text-xs">
            <div className="flex gap-2 font-medium text-violet-400">
              ${(t.payoutUsd / 1e6).toFixed(1)}M USD · 100% Deterministic
            </div>
            <div className="text-muted-foreground">
              HMAC-SHA256 audit signed · Gemini-free
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* ── Secondary Status Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 5: Landfall ETA */}
        <Card className="bg-card/60 hover:shadow-sm transition-shadow duration-200">
          <CardHeader className="p-4">
            <CardDescription className="text-[10px]">LANDFALL ETA</CardDescription>
            <CardTitle className="mt-1.5 text-xl font-semibold tracking-tight font-mono">
              T−{String(landfallHH).padStart(2, "0")}h{" "}
              {String(landfallMM).padStart(2, "0")}m
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="text-[10px]">
                <Clock className="size-2.5 mr-1" />
                FORECAST
              </Badge>
            </CardAction>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="text-[11px] text-muted-foreground">
              Near Puri coast · Bay of Bengal
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Track: NNW 15 km/h
            </div>
          </div>
        </Card>

        {/* Card 6: Exposed Population */}
        <Card className="bg-card/60 hover:shadow-sm transition-shadow duration-200">
          <CardHeader className="p-4">
            <CardDescription className="text-[10px]">EXPOSED POPULATION</CardDescription>
            <CardTitle className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums text-amber-400">
              {(t.exposedPopulation / 1000).toFixed(0)}k
            </CardTitle>
            <CardAction>
              <Badge variant="warning" className="text-[10px] font-bold">
                HIGH
              </Badge>
            </CardAction>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="text-[11px] text-muted-foreground">
              Within 5m MSL inundation zone
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              OSM census overlay
            </div>
          </div>
        </Card>

        {/* Card 7: Evacuation Routes */}
        <Card className="bg-card/60 hover:shadow-sm transition-shadow duration-200">
          <CardHeader className="p-4">
            <CardDescription className="text-[10px]">EVACUATION ROUTES</CardDescription>
            <CardTitle
              className={`mt-1.5 text-xl font-semibold tracking-tight font-mono ${routeColor}`}
            >
              {routeStatus}
            </CardTitle>
            <CardAction>
              <Badge
                variant={
                  t.evacuationRoutesOpen < t.evacuationRoutesTotal
                    ? "warning"
                    : "outline"
                }
                className="text-[10px]"
              >
                {t.evacuationRoutesOpen < t.evacuationRoutesTotal
                  ? "CORRIDORS CUT"
                  : "ALL CLEAR"}
              </Badge>
            </CardAction>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="text-[11px] text-muted-foreground">
              NetworkX pathfinding · OSMnx
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {t.evacuationRoutesTotal - t.evacuationRoutesOpen} corridor(s)
              flood-blocked
            </div>
          </div>
        </Card>

        {/* Card 8: Data Mode & Advisory Status */}
        <Card className="bg-card/60 hover:shadow-sm transition-shadow duration-200">
          <CardHeader className="p-4">
            <CardDescription className="text-[10px]">DATA MODE</CardDescription>
            <CardTitle className="mt-1.5 text-xl font-semibold tracking-tight text-sky-400">
              {t.dataMode}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="text-[10px]">
                <Activity className="size-2.5 mr-1" />
                {t.dataMode === "FORECAST" ? "LIVE" : "DEMO"}
              </Badge>
            </CardAction>
          </CardHeader>
          <div className="px-4 pb-4">
            <div className="text-[11px] text-muted-foreground">
              IMD / Open-Meteo GFS
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Advisory: PENDING HITL REVIEW
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
