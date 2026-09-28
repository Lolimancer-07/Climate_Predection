/**
 * frontend/src/components/BackendGate.tsx
 *
 * Radar sweep connection gate & system boot status overlay.
 * Locks the GCS console with a visual radar animation and subsystem checklist
 * until the backend API and WebSocket telemetry streams are confirmed live.
 */
import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, Server, ShieldCheck } from 'lucide-react';

function RadarSweep() {
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setAngle((a) => (a + 3) % 360), 30);
    return () => clearInterval(id);
  }, []);

  const spoke = 64;
  const rad = (60 * Math.PI) / 180;
  const x2 = 80 + spoke * Math.sin(rad);
  const y2 = 80 - spoke * Math.cos(rad);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        {[64, 48, 32, 16].map((r, i) => (
          <circle
            key={i}
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke="rgba(56, 189, 248, 0.2)"
            strokeWidth="1"
          />
        ))}
        <line x1="80" y1="16" x2="80" y2="144" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
        <line x1="16" y1="80" x2="144" y2="80" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
        <defs>
          <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.7)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
          </radialGradient>
        </defs>
        <g transform={`rotate(${angle}, 80, 80)`}>
          <path
            d={`M80,80 L80,16 A${spoke},${spoke} 0 0,1 ${x2},${y2} Z`}
            fill="url(#sweepGrad)"
            opacity="0.5"
          />
          <line x1="80" y1="80" x2="80" y2="16" stroke="rgba(56, 189, 248, 0.9)" strokeWidth="1.5" />
        </g>
        <circle cx="80" cy="80" r="4" fill="rgb(56, 189, 248)" />
      </svg>
    </div>
  );
}

function CheckItem({ label, done, pulse }: { label: string; done: boolean; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      {done ? (
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
      ) : (
        <Radio className={`h-4 w-4 shrink-0 text-sky-400 ${pulse ? 'animate-pulse' : ''}`} />
      )}
      <span className={done ? 'text-muted-foreground line-through' : 'text-foreground'}>
        {label}
      </span>
    </div>
  );
}

interface BackendGateProps {
  children: React.ReactNode;
  isConnected?: boolean;
  onRetry?: () => void;
}

export function BackendGate({ children, isConnected = true, onRetry }: BackendGateProps) {
  if (isConnected) return <>{children}</>;

  return (
    <>
      <div className="pointer-events-none select-none opacity-10 blur-md transition-all duration-500">
        {children}
      </div>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-md">
        <div className="relative w-full max-w-md">
          <div className="mb-6 h-0.5 w-full bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-80" />

          <div className="overflow-hidden rounded-2xl border border-sky-500/30 bg-card/95 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                </span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  CYCLONE OPERATIONS · GCS
                </span>
              </div>
              <span className="rounded bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-400 uppercase">
                LINK SYNCING
              </span>
            </div>

            {/* Body */}
            <div className="flex flex-col items-center gap-5 p-6">
              <RadarSweep />

              <div className="space-y-1.5 text-center">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Synchronizing Cyclone Digital Twin…
                </h2>
                <p className="max-w-sm text-xs text-muted-foreground">
                  All predictive surge models, wind load calculations, and automated alerts are locked until the digital twin telemetry handshake completes.
                </p>
              </div>

              {/* Subsystem checklist */}
              <div className="w-full space-y-2.5 rounded-xl border border-border/60 bg-background/70 p-3.5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Subsystem Boot & Telemetry Checklist
                </p>
                <CheckItem label="FastAPI Application Core (:8000)" done={true} />
                <CheckItem label="Earth Engine SRTM DEM & Bathymetric Shelf Ingestion" done={true} />
                <CheckItem label="Parametric Surge Deficit & Bathtub Model" done={true} />
                <CheckItem label="Topographic Wetness (TWI) Flash Flood Engine" done={true} />
                <CheckItem label="Structural Fragility & HAZUS Damage Curves" done={true} />
                <CheckItem label="WebSocket Risk Stream (:8000/v1/storms/ws)" done={true} pulse={true} />
                <CheckItem label="10 Hz Multi-Channel Telemetry Synchronizer" done={false} pulse={true} />
              </div>

              <div className="flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1.5 font-mono text-xs font-semibold text-sky-400">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                <span>HANDSHAKE ACTIVE · AWAITING BURST</span>
              </div>

              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 py-2 text-xs font-semibold text-sky-400 transition-all hover:bg-sky-500/20"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Telemetry Handshake
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 h-0.5 w-full bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-80" />
        </div>
      </div>
    </>
  );
}
