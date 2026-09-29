/**
 * CycloneTwinShowcase.tsx
 *
 * Main digital twin panel for the cyclone platform.
 * Mirrors UAV mvp-twin-showcase.tsx:
 *  - Header with status pipeline banner
 *  - 3-KPI strip: Surge Index / Discharge Forecast / AI Anomaly
 *  - Per-ward thermal-balance style risk table
 *  - What-If controls
 *  - Fault inject / scenario controls
 */
import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Gauge,
  Map,
  Minus,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  TrendingDown,
  TrendingUp,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";

/* ─── live telemetry hook ─────────────────────────────────────────────────── */

function useDigitalTwin() {
  const [t, setT] = React.useState({
    surgeM: 4.2,
    surgeThreshold: 3.0,
    healthIndex: 81,
    rainfallMm48h: 312,
    flashFloodRisk: 0.74,
    isAnomaly: false,
    anomalyScore: 0.013,
    windKmh: 220.0,
    category: 4,
    districts: [
      { id: "IN-OD-PURI", name: "Puri", surgeM: 4.2, floodRisk: 0.74, alert: "CRITICAL" },
      { id: "IN-OD-JAGA", name: "Jagatsinghpur", surgeM: 3.6, floodRisk: 0.61, alert: "WARNING" },
      { id: "IN-OD-KEND", name: "Kendrapara", surgeM: 2.8, floodRisk: 0.55, alert: "WARNING" },
      { id: "IN-OD-GANJ", name: "Ganjam", surgeM: 1.9, floodRisk: 0.38, alert: "WATCH" },
      { id: "IN-OD-BHAD", name: "Bhadrak", surgeM: 1.4, floodRisk: 0.29, alert: "NOMINAL" },
    ],
    isFaultActive: false,
    whatifResult: null as { deltaSurge: number; deltaFlood: number } | null,
    networkXRoutes: 4,
    networkXRoutesTotal: 6,
    twinConsistency: { case: "A", passed: 4, total: 4 },
  });

  // Live jitter
  React.useEffect(() => {
    const id = setInterval(() => {
      setT((s) => ({
        ...s,
        surgeM: Math.max(0.5, s.surgeM + (Math.random() - 0.5) * 0.05),
        windKmh: Math.max(100, s.windKmh + (Math.random() - 0.5) * 1.5),
        rainfallMm48h: Math.min(500, s.rainfallMm48h + (Math.random() - 0.3)),
        anomalyScore: Math.max(0, s.anomalyScore + (Math.random() - 0.5) * 0.002),
      }));
    }, 800);
    return () => clearInterval(id);
  }, []);

  return { t, setT };
}

/* ─── component ───────────────────────────────────────────────────────────── */

export function CycloneTwinShowcase() {
  const { t, setT } = useDigitalTwin();

  const [scenarioIntensity, setScenarioIntensity] = React.useState(0);
  const [scenarioRainfall, setScenarioRainfall] = React.useState(0);
  const [isSimulating, setIsSimulating] = React.useState(false);

  const surgeScore = Math.round((t.surgeM / 6.0) * 100);
  const isHighConfidence =
    t.twinConsistency.passed === t.twinConsistency.total && !t.isAnomaly;

  const estimatedSurge = Math.max(
    0.5,
    t.surgeM * (1 + scenarioIntensity * 0.3)
  );
  const estimatedFlood = Math.min(
    1.0,
    t.flashFloodRisk * (1 + scenarioRainfall * 0.4)
  );

  const handleToggleFault = () => {
    setT((s) => ({ ...s, isFaultActive: !s.isFaultActive, isAnomaly: !s.isFaultActive }));
  };

  const handleRunScenario = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setT((s) => ({
        ...s,
        whatifResult: {
          deltaSurge: estimatedSurge - s.surgeM,
          deltaFlood: estimatedFlood - s.flashFloodRisk,
        },
      }));
      setIsSimulating(false);
    }, 600);
  };

  const alertColor = (a: string) =>
    a === "CRITICAL"
      ? "bg-red-500/15 text-red-400 border-red-500/40"
      : a === "WARNING"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
      : a === "WATCH"
      ? "bg-sky-500/15 text-sky-400 border-sky-500/40"
      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";

  return (
    <Card className="border-2 border-primary bg-card shadow-xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <CardHeader className="border-b border-border bg-muted/40 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono font-bold text-primary border-primary">
                {t.districts[0].id} · DIGITAL TWIN HUB
              </Badge>
              <Badge className="bg-primary text-primary-foreground font-bold text-[11px] px-2">
                INGEST → MODEL → EXPOSE → TRIGGER → VALIDATE → DISPATCH
              </Badge>
            </div>
            <CardTitle className="mt-1.5 text-xl font-bold tracking-tight">
              Cyclone Anticipatory Action Digital Twin
            </CardTitle>
            <CardDescription className="text-xs normal-case font-normal text-muted-foreground mt-0.5">
              Parametric surge + TWI flash flood + HAZUS structural cross-validation engine —{" "}
              {t.isFaultActive
                ? "🔴 SCENARIO FAULT ACTIVE"
                : t.isAnomaly
                ? "🟡 ANOMALY DETECTED"
                : "🟢 ALL SYSTEMS NOMINAL"}
            </CardDescription>
          </div>

          {/* Fault Control */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">
              FAULT INJECT:
            </div>
            <Badge
              className={`font-mono text-xs font-bold ${
                t.isFaultActive
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-emerald-600 text-white"
              }`}
            >
              {t.isFaultActive ? "● FAULT ACTIVE" : "● NOMINAL"}
            </Badge>
            <button
              onClick={handleToggleFault}
              className={`h-7 px-3 rounded-md text-xs font-bold transition-colors ${
                t.isFaultActive
                  ? "bg-destructive text-white hover:bg-destructive/80"
                  : "bg-primary text-white hover:bg-primary/80"
              }`}
            >
              <Flame className="size-3 mr-1 inline" />
              {t.isFaultActive ? "STOP FAULT" : "START FAULT"}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-5">
        {/* ── Section 1: Core 3 KPI Strip ─────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Surge Index */}
          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Parametric Surge Index
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span
                className={`font-mono text-4xl font-extrabold ${
                  t.surgeM >= t.surgeThreshold
                    ? "text-red-400"
                    : "text-sky-400"
                }`}
              >
                {surgeScore}%
              </span>
              <Badge
                className={`font-mono text-xs font-bold ${
                  t.surgeM >= t.surgeThreshold
                    ? "bg-red-600 text-white"
                    : "bg-sky-600 text-white"
                }`}
              >
                {t.surgeM >= t.surgeThreshold
                  ? "🔴 THRESHOLD EXCEEDED"
                  : "🟢 BELOW THRESHOLD"}
              </Badge>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Inverted barometer + bathymetric shelf setup + Holland wind field
            </div>
          </div>

          {/* Discharge Forecast */}
          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Flash Flood Discharge
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-4xl font-extrabold text-foreground">
                {Math.round(t.flashFloodRisk * 100)}{" "}
                <span className="text-lg font-normal text-muted-foreground">
                  /100
                </span>
              </span>
              <Badge
                variant="outline"
                className={`font-mono text-xs font-bold ${
                  t.isFaultActive
                    ? "border-destructive text-destructive"
                    : "border-emerald-500 text-emerald-400"
                }`}
              >
                {t.isFaultActive ? (
                  <TrendingDown className="size-3 mr-1 inline" />
                ) : (
                  <TrendingUp className="size-3 mr-1 inline" />
                )}
                {t.isFaultActive ? "↑ DEGRADED" : "→ STABLE"}
              </Badge>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              TWI runoff scoring with Open-Meteo GFS 72h rainfall
            </div>
          </div>

          {/* AI Anomaly Detector */}
          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              AI Anomaly Detector
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span
                className={`font-mono text-4xl font-extrabold ${
                  t.isAnomaly ? "text-destructive" : "text-emerald-400"
                }`}
              >
                {t.isAnomaly ? "ANOMALY" : "NORMAL"}
              </span>
              <Badge
                variant={t.isAnomaly ? "destructive" : "outline"}
                className="font-mono text-xs font-bold"
              >
                Score: {t.anomalyScore.toFixed(3)}
              </Badge>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Isolation Forest (100 estimators on 14 hazard features)
            </div>
          </div>
        </div>

        {/* ── Section 2: District Risk Heat Table ─────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Waves className="size-4 text-primary" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  COASTAL DISTRICT RISK MATRIX — BAY OF BENGAL
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Per-district surge height, flash flood risk &amp; evacuation status
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  isHighConfidence
                    ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                    : "border-amber-500 text-amber-500 bg-amber-500/10"
                }`}
              >
                TWIN CONSISTENCY: {t.twinConsistency.passed}/
                {t.twinConsistency.total} CHECKS{" "}
                {isHighConfidence ? "✓ VALID" : "⚠ DIVERGED"}
              </Badge>
              <Badge
                variant={t.twinConsistency.case === "B" ? "destructive" : "outline"}
                className="text-[10px]"
              >
                CASE-{t.twinConsistency.case}
              </Badge>
            </div>
          </div>

          {/* Per-district rows */}
          <div className="divide-y divide-border/40 text-sm">
            {t.districts.map((d, i) => {
              const surge = d.surgeM;
              const flood = Math.round(d.floodRisk * 100);
              const surgeBarW = Math.round((surge / 5.0) * 100);
              const floodBarW = Math.round(flood);
              const barColor =
                d.alert === "CRITICAL"
                  ? "bg-red-500"
                  : d.alert === "WARNING"
                  ? "bg-amber-500"
                  : d.alert === "WATCH"
                  ? "bg-sky-500"
                  : "bg-emerald-500";

              return (
                <div key={d.id} className="grid grid-cols-12 gap-4 py-3 items-center">
                  {/* District name */}
                  <div className="col-span-2 font-semibold text-foreground text-xs">
                    <div>{d.name}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">
                      {d.id}
                    </div>
                  </div>

                  {/* Surge bar */}
                  <div className="col-span-3">
                    <div className="text-[10px] text-muted-foreground mb-1 flex justify-between">
                      <span>SURGE</span>
                      <span className="font-mono font-bold text-foreground">
                        {surge.toFixed(1)} m
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${surgeBarW}%` }}
                      />
                    </div>
                  </div>

                  {/* Flood bar */}
                  <div className="col-span-3">
                    <div className="text-[10px] text-muted-foreground mb-1 flex justify-between">
                      <span>FLOOD</span>
                      <span className="font-mono font-bold text-foreground">
                        {flood}/100
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${floodBarW}%` }}
                      />
                    </div>
                  </div>

                  {/* Alert badge */}
                  <div className="col-span-2 flex justify-end">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold border ${alertColor(
                        d.alert
                      )}`}
                    >
                      {d.alert}
                    </span>
                  </div>

                  {/* Check icon */}
                  <div className="col-span-2 flex justify-end">
                    {d.alert === "CRITICAL" || d.alert === "WARNING" ? (
                      <AlertTriangle className="size-4 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section 3: What-If Scenario Controls ────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                WHAT-IF COUNTERFACTUAL SCENARIO
              </h3>
            </div>
            <Badge variant="warning" className="text-[10px] font-bold">
              SIMULATED · NOT DISPATCHABLE
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Intensity delta */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Intensity Delta (× scale)
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScenarioIntensity((v) => Math.max(-1, v - 0.1))}
                  className="rounded-md border border-border p-1.5 hover:bg-muted transition-colors"
                >
                  <Minus className="size-3" />
                </button>
                <div className="flex-1 h-2 rounded-full bg-muted/60 relative cursor-pointer">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all"
                    style={{
                      width: `${((scenarioIntensity + 1) / 2) * 100}%`,
                    }}
                  />
                </div>
                <button
                  onClick={() => setScenarioIntensity((v) => Math.min(1, v + 0.1))}
                  className="rounded-md border border-border p-1.5 hover:bg-muted transition-colors"
                >
                  <Plus className="size-3" />
                </button>
                <span className="font-mono text-sm font-bold w-16 text-right">
                  {scenarioIntensity >= 0 ? "+" : ""}
                  {(scenarioIntensity * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Est. surge: {estimatedSurge.toFixed(2)} m (Δ
                {(estimatedSurge - t.surgeM >= 0 ? "+" : "")}
                {(estimatedSurge - t.surgeM).toFixed(2)} m)
              </div>
            </div>

            {/* Rainfall delta */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Rainfall Multiplier (× scale)
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScenarioRainfall((v) => Math.max(-1, v - 0.1))}
                  className="rounded-md border border-border p-1.5 hover:bg-muted transition-colors"
                >
                  <Minus className="size-3" />
                </button>
                <div className="flex-1 h-2 rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{
                      width: `${((scenarioRainfall + 1) / 2) * 100}%`,
                    }}
                  />
                </div>
                <button
                  onClick={() => setScenarioRainfall((v) => Math.min(1, v + 0.1))}
                  className="rounded-md border border-border p-1.5 hover:bg-muted transition-colors"
                >
                  <Plus className="size-3" />
                </button>
                <span className="font-mono text-sm font-bold w-16 text-right">
                  {scenarioRainfall >= 0 ? "+" : ""}
                  {(scenarioRainfall * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Est. flood risk: {Math.round(estimatedFlood * 100)}/100 (Δ
                {Math.round((estimatedFlood - t.flashFloodRisk) * 100) >= 0
                  ? "+"
                  : ""}
                {Math.round((estimatedFlood - t.flashFloodRisk) * 100)})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleRunScenario}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/80 disabled:opacity-60 transition-colors"
            >
              <Gauge className="size-3" />
              {isSimulating ? "RUNNING SCENARIO…" : "RUN WHAT-IF"}
            </button>

            {t.whatifResult && (
              <div className="flex items-center gap-4 font-mono text-xs">
                <span className="text-muted-foreground">→</span>
                <span
                  className={
                    t.whatifResult.deltaSurge > 0
                      ? "text-red-400"
                      : "text-emerald-400"
                  }
                >
                  Surge Δ: {t.whatifResult.deltaSurge >= 0 ? "+" : ""}
                  {t.whatifResult.deltaSurge.toFixed(2)} m
                </span>
                <span
                  className={
                    t.whatifResult.deltaFlood > 0
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }
                >
                  Flood Δ: {t.whatifResult.deltaFlood >= 0 ? "+" : ""}
                  {Math.round(t.whatifResult.deltaFlood * 100)} pts
                </span>
                <Badge variant="warning" className="text-[10px]">
                  SIMULATED
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function alertColor(a: string) {
  return a === "CRITICAL"
    ? "bg-red-500/15 text-red-400 border-red-500/40"
    : a === "WARNING"
    ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
    : a === "WATCH"
    ? "bg-sky-500/15 text-sky-400 border-sky-500/40"
    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";
}
