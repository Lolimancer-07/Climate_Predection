/**
 * GcsMissionStatusBar.tsx — Cyclone Anticipatory Action Platform
 *
 * UAV-style persistent mission bar adapted for cyclone domain.
 * Shows: Storm ID · Status Badge · Live telemetry HUD pills (Wind, Surge, Rainfall, Pop, Elapsed)
 * Profile tabs · Pause/Resume · Audio · Safe Return equivalent (HITL DISPATCH)
 */
import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Droplets,
  FastForward,
  Pause,
  Play,
  Radio,
  Satellite,
  Shield,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import { Badge } from "./ui/badge";

function metHms(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function LiveClock() {
  const [time, setTime] = React.useState("");
  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toISOString().replace("T", " ").slice(0, 19) + " UTC");
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono tabular-nums">{time || "—"}</span>;
}

interface GcsMissionStatusBarProps {
  stormId?: string;
  windKmh?: number;
  surgeM?: number;
  rainfallMm?: number;
  exposedPop?: number;
  alertLevel?: "NOMINAL" | "WARNING" | "CRITICAL";
  dataMode?: "FORECAST" | "SIMULATED" | "HISTORICAL";
  wsConnected?: boolean;
  onDispatch?: () => void;
}

export function GcsMissionStatusBar({
  stormId = "BOB07-2026",
  windKmh = 220,
  surgeM = 4.2,
  rainfallMm = 312,
  exposedPop = 284000,
  alertLevel = "CRITICAL",
  dataMode = "FORECAST",
  wsConnected = true,
  onDispatch,
}: GcsMissionStatusBarProps) {
  const [metSecs, setMetSecs] = React.useState(5406);
  const [isPaused, setIsPaused] = React.useState(false);
  const [audioOn, setAudioOn] = React.useState(true);
  const [profile, setProfile] = React.useState("NORMAL 10X");

  const profiles = ["NORMAL 10X", "HIGH-ALT", "NOT-MX", "MAX-LOSTER", "RAPID-RPM"];

  React.useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => setMetSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const isCritical = alertLevel === "CRITICAL";
  const isWarning = alertLevel === "WARNING";
  const isNominal = !isCritical && !isWarning;

  const statusColor = isCritical
    ? "bg-red-500"
    : isWarning
    ? "bg-amber-500"
    : "bg-emerald-500";

  const statusText = isCritical
    ? "SYSTEM CRITICAL"
    : isWarning
    ? "ANOMALY DETECTED"
    : "SYSTEM NOMINAL";

  const statusBg = isCritical
    ? "border-red-800 bg-red-950/50"
    : isWarning
    ? "border-amber-800 bg-amber-950/50"
    : "border-border bg-card";

  return (
    <div className={`mx-4 lg:mx-6 rounded-xl border ${statusBg} shadow-sm overflow-hidden`}>
      {/* ── Row 1: Storm identity + status + live clock ─────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60">
        <div className="flex items-center gap-3">
          {/* Pulse dot */}
          <div className="relative flex size-3">
            {wsConnected && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusColor}`}
              />
            )}
            <span
              className={`relative inline-flex rounded-full size-3 ${statusColor}`}
            />
          </div>

          {/* Storm ID */}
          <div>
            <span className="font-mono text-xs font-bold text-muted-foreground uppercase">
              ACTIVE STORM
            </span>
            <div className="font-bold text-foreground leading-tight">{stormId}</div>
          </div>

          {/* Twin status */}
          <div>
            <span className="font-mono text-xs font-bold text-muted-foreground uppercase">
              TWIN STATUS
            </span>
            <div
              className={`font-bold text-sm leading-tight ${
                isCritical
                  ? "text-red-400"
                  : isWarning
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {statusText}
            </div>
          </div>
        </div>

        {/* Right: Live telemetry pills */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <Wind className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground uppercase">Wind</span>
            <span className="font-bold text-foreground">
              {Math.round(windKmh)} km/h
            </span>
          </div>
          <div className="text-border/40">|</div>
          <div className="flex items-center gap-1.5">
            <Droplets className="size-3.5 text-sky-400" />
            <span className="text-muted-foreground uppercase">Surge</span>
            <span className="font-bold text-sky-400">{surgeM.toFixed(1)} m</span>
          </div>
          <div className="text-border/40">|</div>
          <div className="flex items-center gap-1.5">
            <Activity className="size-3.5 text-cyan-400" />
            <span className="text-muted-foreground uppercase">Rain</span>
            <span className="font-bold text-cyan-400">{Math.round(rainfallMm)} mm</span>
          </div>
          <div className="text-border/40">|</div>
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-amber-400" />
            <span className="text-muted-foreground uppercase">Pop</span>
            <span className="font-bold text-amber-400">
              {(exposedPop / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="text-border/40">|</div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground uppercase">Elapsed</span>
            <span className="font-bold text-foreground">{metHms(metSecs)}</span>
          </div>
          <div className="text-border/40">|</div>
          <LiveClock />
          <div className="text-border/40">|</div>
          <Badge
            className={`font-bold text-[10px] ${
              dataMode === "SIMULATED"
                ? "bg-amber-600 text-white"
                : "bg-emerald-600 text-white animate-pulse"
            }`}
          >
            {dataMode === "FORECAST" ? "● 10Hz LIVE" : `● ${dataMode}`}
          </Badge>
        </div>
      </div>

      {/* ── Row 2: Profile tabs + action controls ───────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        {/* Profile selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">
            PROFILE:
          </span>
          {profiles.map((p) => (
            <button
              key={p}
              onClick={() => setProfile(p)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                profile === p
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Pause/Resume */}
          <button
            onClick={() => setIsPaused((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors"
          >
            {isPaused ? (
              <Play className="size-3" />
            ) : (
              <Pause className="size-3" />
            )}
            {isPaused ? "RESUME" : "PAUSE"}
          </button>

          {/* Audio */}
          <button
            onClick={() => setAudioOn((v) => !v)}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            {audioOn ? (
              <Volume2 className="size-3.5 text-foreground" />
            ) : (
              <VolumeX className="size-3.5 text-muted-foreground" />
            )}
          </button>

          {/* HITL Dispatch (= Safe Return equivalent) */}
          <button
            onClick={onDispatch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition-colors shadow-sm"
          >
            <Shield className="size-3" />
            HITL DISPATCH
            <ChevronRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
