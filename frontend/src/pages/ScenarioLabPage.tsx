/**
 * frontend/src/pages/ScenarioLabPage.tsx
 *
 * Full Phase 2/3 implementation of the Scenario Lab.
 * - Creates scenarios via POST /v1/scenarios
 * - Fetches comparison from GET /v1/scenarios/{id}
 * - All scenario values labeled SIMULATED in amber
 * - Scenario outputs CANNOT trigger advisory review or dispatch
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStorm } from '../context/StormContext';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ScenarioParams {
  track_offset_deg: number;
  intensity_delta_hpa: number;
  rainfall_multiplier: number;
  lead_time_offset_h: number;
  label: string;
}

const defaultParams: ScenarioParams = {
  track_offset_deg: 0,
  intensity_delta_hpa: 0,
  rainfall_multiplier: 1.0,
  lead_time_offset_h: 0,
  label: '',
};

async function postScenario(body: {
  baseline_run_id: string;
  event_id: string;
  district_id: string;
} & ScenarioParams) {
  const res = await fetch(`${API_BASE}/v1/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Role': 'ddma_operator' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Scenario creation failed');
  }
  return res.json();
}

async function fetchScenarioComparison(scenarioId: string) {
  // Poll until completed
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${API_BASE}/v1/scenarios/${scenarioId}`, {
      headers: { 'X-Role': 'ddma_operator' },
    });
    if (!res.ok) throw new Error('Failed to fetch scenario');
    const data = await res.json();
    if (data.status === 'completed') return data;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Scenario timed out');
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SimulationBanner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
    }}>
      <span style={{ fontSize: 20 }}>⚗️</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>
          SIMULATION ONLY — Outputs will not trigger advisories, dispatch, or insurance actions
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          Scenario perturbations apply parameter offsets to the baseline run.
          They are never admitted to the advisory review queue.
        </div>
      </div>
    </div>
  );
}

function ParamSlider({
  label, value, onChange, min, max, step, unit, description,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string; description: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
        <span style={{
          fontSize: 12, fontFamily: 'monospace', fontWeight: 700,
          color: value !== 0 && value !== 1.0 ? '#f59e0b' : '#38bdf8',
        }}>
          {value > 0 ? `+${value}` : value} {unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#f59e0b' }}
      />
      <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{description}</div>
    </div>
  );
}

function MetricCard({ label, baseline, scenario, unit, delta }: {
  label: string; baseline: number; scenario: number; unit: string; delta: number;
}) {
  const isIncrease = delta > 0;
  const hasChange = Math.abs(delta) > 0.01;
  return (
    <div style={{
      background: 'var(--color-surface, rgba(255,255,255,0.04))',
      border: '1px solid var(--color-border, rgba(255,255,255,0.08))',
      borderRadius: 8, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Baseline</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>
            {baseline.toFixed(1)} <span style={{ fontSize: 10 }}>{unit}</span>
          </div>
        </div>
        <div style={{ fontSize: 14, color: '#475569', paddingBottom: 4 }}>→</div>
        <div>
          <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 2 }}>SIMULATED</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#f59e0b' }}>
            {scenario.toFixed(1)} <span style={{ fontSize: 10 }}>{unit}</span>
          </div>
        </div>
      </div>
      {hasChange && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
          background: isIncrease ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
          color: isIncrease ? '#ef4444' : '#22c55e',
        }}>
          {isIncrease ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} {unit}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function ScenarioLabPage() {
  const { selectedDistrict, activeStorm } = useStorm();
  const activeStormId = activeStorm?.storm_id ?? null;
  const queryClient = useQueryClient();
  const [params, setParams] = useState<ScenarioParams>({ ...defaultParams });
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [baselineRunId, setBaselineRunId] = useState<string>('');
  const [showRunIdInput, setShowRunIdInput] = useState(false);

  // Try to get the latest run_id from the query cache
  const cachedRuns = queryClient.getQueryData<{ runs: Array<{ run_id: string; status: string; is_scenario: boolean }> }>(
    ['stormRuns', activeStormId]
  );
  const latestRealRun = cachedRuns?.runs?.find((r) => !r.is_scenario && r.status === 'completed');

  const effectiveBaselineId = baselineRunId || latestRealRun?.run_id || '';

  const createScenario = useMutation({
    mutationFn: (p: ScenarioParams) =>
      postScenario({
        baseline_run_id: effectiveBaselineId,
        event_id: activeStormId || 'CYCLONE-FANI-2019',
        district_id: selectedDistrict || 'IN-OD-PURI',
        ...p,
      }),
    onSuccess: (data) => {
      setScenarioId(data.scenario_id);
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      toast.success(`Scenario created: ${data.scenario_id.slice(0, 8)}…`);
    },
    onError: (err: Error) => {
      toast.error(`Scenario failed: ${err.message}`);
    },
  });

  const { data: comparison, isLoading: compLoading } = useQuery({
    queryKey: ['scenario', scenarioId],
    queryFn: () => fetchScenarioComparison(scenarioId!),
    enabled: !!scenarioId,
    staleTime: Infinity,
  });

  const updateParam = <K extends keyof ScenarioParams>(key: K, value: ScenarioParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  };

  const hasBaseline = !!effectiveBaselineId;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text, #e2e8f0)', margin: 0, marginBottom: 4 }}>
          Scenario Lab
        </h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Simulate alternative storm tracks, intensities, or lead times against a completed baseline run.
        </p>
      </div>

      <SimulationBanner />

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
        {/* Left: parameter controls */}
        <div>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: 16, marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 14, letterSpacing: '0.08em' }}>
              SCENARIO PARAMETERS
            </div>

            {/* Baseline run selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Baseline Run</span>
                <button
                  onClick={() => setShowRunIdInput(!showRunIdInput)}
                  style={{ fontSize: 10, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {showRunIdInput ? 'auto' : 'manual'}
                </button>
              </div>
              {showRunIdInput ? (
                <input
                  type="text"
                  placeholder="Paste run_id here"
                  value={baselineRunId}
                  onChange={(e) => setBaselineRunId(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#e2e8f0', fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div style={{
                  padding: '6px 8px', borderRadius: 6,
                  background: hasBaseline ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${hasBaseline ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  fontSize: 10, fontFamily: 'monospace',
                  color: hasBaseline ? '#22c55e' : '#ef4444',
                }}>
                  {hasBaseline
                    ? `${effectiveBaselineId.slice(0, 20)}…`
                    : 'No completed run found — run the pipeline first'}
                </div>
              )}
            </div>

            <ParamSlider
              label="Track Offset"
              value={params.track_offset_deg}
              onChange={(v) => updateParam('track_offset_deg', v)}
              min={-5} max={5} step={0.5} unit="°"
              description="Shift the forecast track left (−) or right (+)"
            />
            <ParamSlider
              label="Intensity Delta (pressure drop)"
              value={params.intensity_delta_hpa}
              onChange={(v) => updateParam('intensity_delta_hpa', v)}
              min={-30} max={30} step={1} unit="hPa"
              description="Deeper pressure → stronger storm"
            />
            <ParamSlider
              label="Rainfall Multiplier"
              value={params.rainfall_multiplier}
              onChange={(v) => updateParam('rainfall_multiplier', v)}
              min={0.5} max={3.0} step={0.1} unit="×"
              description="Scale the rainfall forecast"
            />
            <ParamSlider
              label="Landfall Time Offset"
              value={params.lead_time_offset_h}
              onChange={(v) => updateParam('lead_time_offset_h', v)}
              min={-24} max={24} step={6} unit="h"
              description="Earlier (−) or later (+) landfall"
            />

            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Scenario label (optional)"
                value={params.label}
                onChange={(e) => updateParam('label', e.target.value)}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#e2e8f0', fontSize: 11, boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={() => createScenario.mutate(params)}
              disabled={!hasBaseline || createScenario.isPending}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                background: hasBaseline ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
                border: `1px solid ${hasBaseline ? 'rgba(245,158,11,0.4)' : 'rgba(100,116,139,0.3)'}`,
                color: hasBaseline ? '#f59e0b' : '#64748b',
                fontSize: 12, fontWeight: 700, cursor: hasBaseline ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {createScenario.isPending ? '⏳ Running scenario…' : '⚗️ Run Scenario'}
            </button>

            {createScenario.isError && (
              <div style={{
                marginTop: 8, padding: '6px 10px', borderRadius: 6, fontSize: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
              }}>
                {(createScenario.error as Error).message}
              </div>
            )}
          </div>

          {/* List of past scenarios */}
          <PastScenariosList onSelect={(id) => setScenarioId(id)} activeId={scenarioId} />
        </div>

        {/* Right: comparison results */}
        <div>
          {!scenarioId && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 300, background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10,
              color: '#475569', fontSize: 12,
            }}>
              Configure parameters and click "Run Scenario" to see a side-by-side comparison
            </div>
          )}

          {compLoading && scenarioId && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              height: 200, gap: 12,
            }}>
              <div style={{ width: 32, height: 32, border: '2px solid #f59e0b', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 11, color: '#f59e0b' }}>Computing scenario…</span>
            </div>
          )}

          {comparison?.comparison && (
            <ScenarioComparisonPanel
              scenarioId={scenarioId!}
              label={comparison.label}
              params={comparison.params}
              comparison={comparison.comparison}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PastScenariosList({ onSelect, activeId }: {
  onSelect: (id: string) => void;
  activeId: string | null;
}) {
  const { data } = useQuery({
    queryKey: ['scenarios'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/scenarios`, { headers: { 'X-Role': 'ddma_operator' } });
      return res.ok ? res.json() : { scenarios: [] };
    },
    staleTime: 10_000,
  });

  const scenarios = (data?.scenarios ?? []).slice(0, 5);
  if (!scenarios.length) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 8, letterSpacing: '0.08em' }}>
        RECENT SCENARIOS
      </div>
      {scenarios.map((s: any) => (
        <button
          key={s.scenario_id}
          onClick={() => onSelect(s.scenario_id)}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', padding: '6px 8px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
            background: activeId === s.scenario_id ? 'rgba(245,158,11,0.10)' : 'transparent',
            border: `1px solid ${activeId === s.scenario_id ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
            {s.label || s.scenario_id.slice(0, 12) + '…'}
          </span>
          <span style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3,
            background: 'rgba(245,158,11,0.10)', color: '#f59e0b',
          }}>
            SIMULATED
          </span>
        </button>
      ))}
    </div>
  );
}

function ScenarioComparisonPanel({ scenarioId, label, params, comparison }: {
  scenarioId: string;
  label: string;
  params: Record<string, number>;
  comparison: {
    baseline: { run_id: string; max_surge_height_m: number; max_wind_kmh: number; insurance_triggered: boolean };
    scenario: { run_id: string; max_surge_height_m: number; max_wind_kmh: number; insurance_triggered: boolean; data_mode: string };
    delta: { surge_m: number; wind_kmh: number };
  };
}) {
  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{label}</div>
          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
            {scenarioId.slice(0, 20)}…
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
          background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)',
        }}>
          ⚗️ SIMULATED
        </div>
      </div>

      {/* Param summary */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16,
      }}>
        {Object.entries(params).map(([k, v]) => (
          <div key={k} style={{
            padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}>
            {k.replace(/_/g, ' ')}: <span style={{ color: v !== 0 && v !== 1.0 ? '#f59e0b' : '#38bdf8' }}>
              {typeof v === 'number' && v > 0 ? `+${v}` : v}
            </span>
          </div>
        ))}
      </div>

      {/* Metric comparison grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <MetricCard
          label="Max Surge Height"
          baseline={comparison.baseline.max_surge_height_m}
          scenario={comparison.scenario.max_surge_height_m}
          unit="m"
          delta={comparison.delta.surge_m}
        />
        <MetricCard
          label="Max Wind Speed"
          baseline={comparison.baseline.max_wind_kmh}
          scenario={comparison.scenario.max_wind_kmh}
          unit="km/h"
          delta={comparison.delta.wind_kmh}
        />
      </div>

      {/* Insurance trigger comparison */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16,
      }}>
        {(['baseline', 'scenario'] as const).map((mode) => {
          const fired = comparison[mode].insurance_triggered;
          return (
            <div key={mode} style={{
              padding: '10px 14px', borderRadius: 8,
              background: fired ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${fired ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>
                {mode === 'baseline' ? 'Baseline' : '⚗️ SIMULATED'} Trigger
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: fired ? '#a855f7' : '#22c55e',
              }}>
                {fired ? '🔴 FIRED' : '⚪ NOT FIRED'}
              </div>
              {mode === 'scenario' && (
                <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
                  Simulation result only — no real trigger initiated
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Safety notice */}
      <div style={{
        padding: '8px 12px', borderRadius: 6, fontSize: 10,
        background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)',
        color: '#92400e',
      }}>
        ⚠️ These results are simulation-only. They cannot be submitted for advisory review,
        dispatch, or insurance trigger. Use the baseline run for all operational actions.
      </div>
    </div>
  );
}
