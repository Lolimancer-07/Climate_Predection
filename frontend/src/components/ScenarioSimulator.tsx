/**
 * frontend/src/components/ScenarioSimulator.tsx
 * "What-if" scenario simulator — sliders for wind category and surge height.
 * Drives structural re-query via useStructuralScenario.
 */
import React, { useState } from 'react';
import { Zap, Waves, Play, Loader2 } from 'lucide-react';
import { useStructuralScenario } from '../hooks/useScenarioQuery';

const CYCLONE_CATEGORIES: Array<{ label: string; wind: number; color: string }> = [
  { label: 'Cat 1 (Deep Depression)',  wind: 90,  color: 'hsl(162, 80%, 45%)' },
  { label: 'Cat 2 (Cyclonic Storm)',   wind: 110, color: 'hsl(67, 80%, 52%)' },
  { label: 'Cat 3 (Severe CS)',        wind: 150, color: 'hsl(38, 95%, 55%)' },
  { label: 'Cat 4 (Very Severe CS)',   wind: 200, color: 'hsl(20, 95%, 60%)' },
  { label: 'Cat 5 (Extremely Severe)', wind: 240, color: 'hsl(0, 85%, 60%)' },
  { label: 'Cat 6 (Super Cyclone)',    wind: 280, color: 'hsl(300, 80%, 60%)' },
];

interface ScenarioSimulatorProps {
  districtId: string;
  eventId: string;
}

export function ScenarioSimulator({ districtId, eventId }: ScenarioSimulatorProps) {
  const [windKmh, setWindKmh] = useState(220);
  const [surgeM, setSurgeM] = useState(3.5);
  const [committed, setCommitted] = useState({ windKmh: 220, surgeM: 3.5 });

  const { data, isFetching, isError } = useStructuralScenario({
    districtId,
    eventId,
    windSpeedKmh: committed.windKmh,
    maxSurgeM: committed.surgeM,
  });

  const activeCategory = [...CYCLONE_CATEGORIES].filter((c) => c.wind <= windKmh).pop() ?? CYCLONE_CATEGORIES[0];

  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-4) var(--space-5)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      }}>
        <Zap size={16} style={{ color: 'var(--color-warning)' }} />
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
          Scenario Simulator
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 'var(--text-xs)', fontWeight: 600,
          color: activeCategory.color, fontFamily: 'var(--font-mono)',
        }}>
          {activeCategory.label}
        </span>
      </div>

      {/* Controls */}
      <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Wind speed */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={12} style={{ color: activeCategory.color }} />
              Max Wind Speed
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: activeCategory.color }}>
              {windKmh} km/h
            </span>
          </div>
          <input
            type="range" min={60} max={320} step={10} value={windKmh}
            onChange={(e) => setWindKmh(Number(e.target.value))}
            style={{ width: '100%', accentColor: activeCategory.color }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>60 km/h</span><span>320 km/h</span>
          </div>
        </label>

        {/* Surge height */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Waves size={12} style={{ color: 'var(--color-primary)' }} />
              Max Surge Height
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {surgeM.toFixed(1)} m
            </span>
          </div>
          <input
            type="range" min={0.5} max={8} step={0.5} value={surgeM}
            onChange={(e) => setSurgeM(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--color-primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>0.5 m</span><span>8.0 m</span>
          </div>
        </label>

        {/* Run button */}
        <button
          id="scenario-run-btn"
          onClick={() => setCommitted({ windKmh, surgeM })}
          disabled={isFetching}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
            background: 'var(--color-primary)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontWeight: 600, fontSize: 'var(--text-sm)', cursor: isFetching ? 'not-allowed' : 'pointer',
            opacity: isFetching ? 0.7 : 1,
            transition: 'all var(--transition-base)',
          }}
        >
          {isFetching
            ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running…</>
            : <><Play size={14} /> Run Scenario</>}
        </button>

        {/* Results summary */}
        {data && !isFetching && (
          <div style={{
            background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)',
          }}>
            {[
              { label: 'Total Assets', value: data.total_at_risk, color: 'var(--text-secondary)' },
              { label: 'Likely Failure', value: data.likely_failure_count, color: 'var(--color-danger)' },
              { label: 'Need Hardening', value: data.reinforcement_advisable_count, color: 'var(--color-warning)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
                  {value}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', margin: 0 }}>
            Failed to run scenario. Backend may be offline.
          </p>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
