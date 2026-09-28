/**
 * frontend/src/components/CommandDock.tsx
 *
 * Persistent Bottom Action Dock — GCS Operator Controls.
 * Features:
 *  - Mission Lead-Time Stage: T-72h Approach -> T-0h Landfall
 *  - Scenario / Perturbation Injection (Track drift, Rapid intensification, Surge boost)
 *  - Sim Speed & Playback (1.0x, 2.0x, 5.0x, Pause/Resume)
 *  - Scripted 9-Step Demo Walkthrough
 *  - Quick Launchers: What-If, Optimize Routes, Hardware Hardening
 */
import React, { useState } from 'react';
import { useStorm } from '../context/StormContext';
import {
  Flame,
  RotateCcw,
  Play,
  Pause,
  FastForward,
  StepForward,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  ShieldAlert,
  Zap,
} from 'lucide-react';

const STAGE_OPTIONS = [
  { value: 'T-72h', label: 'T-72h (Early Approach / Watch)', leadTime: 72 },
  { value: 'T-48h', label: 'T-48h (Inundation Threat / Alert)', leadTime: 48 },
  { value: 'T-36h', label: 'T-36h (Rapid Intensification)', leadTime: 36 },
  { value: 'T-24h', label: 'T-24h (Mandatory Evacuation)', leadTime: 24 },
  { value: 'T-12h', label: 'T-12h (Final Hardening / Lock)', leadTime: 12 },
  { value: 'T-0h',  label: 'T-0h (Landfall Impact)', leadTime: 0 },
];

const SCENARIO_FAULTS = [
  { value: 'track_drift', label: 'Track Drift East (+25 km toward Puri)' },
  { value: 'rapid_intensification', label: 'Rapid Intensification (+15 kt / Cat 4)' },
  { value: 'surge_amplification', label: 'Surge Amplification (+1.2 m High Astronomical Tide)' },
  { value: 'cloudburst_rain', label: 'Extreme Cloudburst (+65 mm/h Rain Band)' },
  { value: 'sea_dike_breach', label: 'Sea Dike Structural Breach (Ward 3 & 7)' },
  { value: 'sensor_drift', label: 'Automated Weather Station Drift (-12 hPa Bias)' },
];

export function CommandDock() {
  const {
    playbackSpeed,
    setPlaybackSpeed,
    isPaused,
    togglePause,
    activeScenario,
    setActiveScenario,
    demoState,
    setDemoState,
    simLeadTime,
    setSimLeadTime,
  } = useStorm();

  const [selectedStage, setSelectedStage] = useState('T-36h');
  const [selectedFault, setSelectedFault] = useState('rapid_intensification');
  const [justCleared, setJustCleared] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);

  const handleStageChange = (val: string) => {
    setSelectedStage(val);
    const opt = STAGE_OPTIONS.find((s) => s.value === val);
    if (opt) setSimLeadTime(opt.leadTime);
  };

  const handleInjectFault = () => {
    setJustCleared(false);
    setActiveScenario(selectedFault);
  };

  const handleClearFaults = () => {
    setActiveScenario(null);
    setJustCleared(true);
    setTimeout(() => setJustCleared(false), 2000);
  };

  const handleStartDemo = () => {
    setDemoState({
      active: true,
      step: 1,
      title: 'Baseline Approach (T-72h)',
      description: 'Cyclone BOB07 detected 480 km SSE of Puri. Parametric monitoring active.',
    });
    setSimLeadTime(72);
  };

  const handleNextDemoStep = () => {
    const next = demoState.step + 1;
    if (next > 9) {
      setDemoState((prev) => ({ ...prev, active: false }));
      return;
    }
    const stepTitles = [
      '',
      'Baseline Approach (T-72h)',
      'Inverted Barometer Deficit (T-48h)',
      'Rapid Intensification (T-36h - 215 km/h)',
      'Surge Inundation Footprint Calculation',
      'TWI Flash Flood Runoff Convergence',
      'Deterministic Parametric Insurance Payout Trigger',
      'Zero-Hallucination Numeric Grounding Gate',
      'Human-in-the-Loop Multi-Channel Dispatch',
      'Landfall & Rapid Damage Assessment Verification',
    ];
    setDemoState({
      active: true,
      step: next,
      title: stepTitles[next] || `Demo Step ${next}`,
      description: `Step ${next}/9 executing across physical hazard & financial liquidity models.`,
    });
    setSimLeadTime(Math.max(0, 72 - next * 8));
  };

  const handleStopDemo = () => {
    setDemoState((prev) => ({ ...prev, active: false }));
  };

  return (
    <>
      {/* ── Demo Mode Stage Banner ─────────────────────────────────── */}
      {demoState.active && (
        <div className="flex items-center justify-between border-b border-border bg-card/95 px-4 py-2 text-xs shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              DEMO WALKTHROUGH
            </span>
            <span className="font-semibold text-foreground">
              Step {demoState.step}/9: {demoState.title}
            </span>
            <span className="hidden text-muted-foreground md:inline">
              — {demoState.description}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNextDemoStep}
              className="flex h-7 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              <span>NEXT STEP</span>
              <StepForward className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleStopDemo}
              className="flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-all hover:bg-muted"
            >
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              EXIT DEMO
            </button>
          </div>
        </div>
      )}

      {/* ── Persistent Bottom Command Dock ─────────────────────────── */}
      <footer className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-4 py-2.5 shadow-xl backdrop-blur-md">
        {/* Group 1: Lead-Time Stage */}
        <div className="flex items-center gap-2">
          <span className="hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground lg:inline">
            STAGE:
          </span>
          <select
            value={selectedStage}
            onChange={(e) => handleStageChange(e.target.value)}
            className="h-8 rounded-lg border border-border/80 bg-card px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:border-primary/50"
          >
            {STAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-card text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Group 2: Scenario Perturbation Injection */}
        <div className="flex items-center gap-1.5">
          <span className="hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:inline">
            SCENARIO:
          </span>
          <select
            value={selectedFault}
            onChange={(e) => setSelectedFault(e.target.value)}
            className="h-8 max-w-[220px] truncate rounded-lg border border-border/80 bg-card px-2.5 text-xs font-medium text-foreground outline-none transition-colors hover:border-primary/50"
          >
            {SCENARIO_FAULTS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-card text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleInjectFault}
            className="flex h-8 items-center gap-1 rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 text-xs font-bold text-amber-400 transition-all hover:bg-amber-500 hover:text-black"
          >
            <Flame className="h-3.5 w-3.5" />
            <span>INJECT</span>
          </button>
          <button
            onClick={handleClearFaults}
            className={`flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-all ${
              justCleared
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-border/80 bg-card text-foreground hover:bg-muted'
            }`}
          >
            {justCleared ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>CLEARED</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>RESET</span>
              </>
            )}
          </button>

          {activeScenario && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-400 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              PERTURBATION ACTIVE
            </span>
          )}
        </div>

        {/* Group 3: Simulation Speed & Playback */}
        <div className="flex items-center gap-1.5">
          <span className="hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground xl:inline">
            SPEED:
          </span>
          <select
            value={String(playbackSpeed)}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="h-8 rounded-lg border border-border/80 bg-card px-2 text-xs font-medium text-foreground outline-none"
          >
            <option value="1.0">1.0× Real</option>
            <option value="2.0">2.0× Fast</option>
            <option value="5.0">5.0× Ultra</option>
          </select>
          <button
            onClick={togglePause}
            className={`flex h-8 w-20 items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-all ${
              isPaused
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                : 'border-border/80 bg-card text-foreground hover:bg-muted'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="h-3.5 w-3.5" />
                RESUME
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                PAUSE
              </>
            )}
          </button>
        </div>

        {/* Group 4: Advanced Tools & Scripted Demo */}
        <div className="flex items-center gap-2">
          {!demoState.active && (
            <button
              onClick={handleStartDemo}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>RUN DEMO</span>
            </button>
          )}

          <button
            onClick={() => setShowWhatIf(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-400 transition-all hover:bg-sky-500/20"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>WHAT-IF</span>
          </button>
        </div>
      </footer>

      {/* ── What-If Modal ─────────────────────────────────────────── */}
      {showWhatIf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-sky-500/30 bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-sky-400" />
                <h3 className="text-base font-bold text-foreground">
                  Cyclone Scenario Simulator (What-If Lab)
                </h3>
              </div>
              <button
                onClick={() => setShowWhatIf(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-muted-foreground">
                Perturb track, pressure deficit, and rainfall rates to evaluate worst-case inundation and parametric trigger sensitivity.
              </p>

              <div>
                <label className="font-semibold text-foreground">Track Lateral Offset: ±25 km</label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  defaultValue="0"
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Rainfall Intensity Multiplier: 1.0× – 2.5×</label>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.1"
                  defaultValue="1.0"
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Astronomical Tide Phase</label>
                <select className="mt-1 w-full rounded-md border border-border bg-background p-2 text-foreground">
                  <option>High Astronomical Spring Tide (+1.4 m)</option>
                  <option>Mean High Water (+0.8 m)</option>
                  <option>Neap Low Tide (-0.4 m)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setShowWhatIf(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setActiveScenario('surge_amplification');
                  setShowWhatIf(false);
                }}
                className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600"
              >
                Apply Scenario
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
