/**
 * frontend/src/pages/ScenarioLabPage.tsx
 *
 * Simulation-only what-if controls.
 * Track offset, intensity delta, rainfall multiplier, lead time offset.
 * Side-by-side baseline vs scenario results.
 * CRITICAL: Scenario perturbations NEVER overwrite observed/baseline data.
 * All scenario outputs are clearly labeled SIMULATED.
 *
 * Spec: UAV Digital Twin plan §4.2, page 6 "Scenario Lab"
 */
import React, { useState } from 'react';
import { useStorm } from '../context/StormContext';
import { ScenarioSimulator } from '../components/ScenarioSimulator';

export function ScenarioLabPage() {
  const { selectedDistrict } = useStorm();

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
        Scenario Lab
      </h1>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Simulate alternative storm tracks, intensities, or lead times.
        Scenario perturbations are <strong style={{ color: '#f59e0b' }}>simulation-only</strong> — 
        they never modify the underlying observed forecast or trigger any real action.
      </p>

      {/* Safety notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 11,
        color: 'var(--color-indigo)',
      }}>
        <span style={{ fontSize: 16 }}>⚗️</span>
        <div>
          <strong>Scenario outputs are synthetic and reversible.</strong> All values shown in this tab are
          generated from parameter offsets applied to the demo baseline. They are not observational data,
          not forecast outputs, and may not trigger any dispatch or insurance action.
        </div>
      </div>

      <ScenarioSimulator districtId={selectedDistrict} eventId="CYCLONE-FANI-2019" />
    </div>
  );
}
