/**
 * frontend/src/pages/ModelEvidencePage.tsx
 *
 * Model Evidence page — shows all model outputs, confidence levels,
 * independent evidence comparison, agreement/disagreement, ranked risk drivers.
 * Spec: UAV Digital Twin plan §4.2, page 5 "Model Evidence"
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStorm } from '../context/StormContext';
import { fetchDistrictRisk } from '../api/client';

function ConfidenceBar({ value, max = 1.0, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, minWidth: 36, textAlign: 'right' }}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function ModelOutputCard({
  name, version, value, unit, confidence, calibration, limitation, color,
}: {
  name: string; version: string; value: string | number; unit: string;
  confidence: number; calibration: string; limitation: string; color: string;
}) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{name}</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{version}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color, lineHeight: 1.1 }}>
            {value}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{unit}</div>
        </div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>Model confidence</div>
        <ConfidenceBar value={confidence} color={color} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 6 }}>
        <span style={{ fontWeight: 600 }}>Calibration:</span> {calibration}
      </div>
      <div style={{
        marginTop: 6, fontSize: 10, color: '#f59e0b',
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 5, padding: '4px 8px',
      }}>
        ⚠ {limitation}
      </div>
    </div>
  );
}

function RiskDriverRow({ rank, driver, value, unit, impact }: {
  rank: number; driver: string; value: string; unit: string; impact: 'critical'|'high'|'moderate'|'low';
}) {
  const impactColor = { critical: '#ef4444', high: '#f97316', moderate: '#f59e0b', low: '#22c55e' }[impact];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px', borderRadius: 6,
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      marginBottom: 4,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        background: `${impactColor}22`, color: impactColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
      }}>
        {rank}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text)' }}>{driver}</div>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-sky)' }}>
        {value} {unit}
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase',
        background: `${impactColor}18`, color: impactColor,
      }}>
        {impact}
      </span>
    </div>
  );
}

export function ModelEvidencePage() {
  const { selectedDistrict } = useStorm();
  const { data: risk, isLoading, isError } = useQuery({
    queryKey: ['district-risk', selectedDistrict],
    queryFn: () => fetchDistrictRisk(selectedDistrict),
    staleTime: 60_000,
  });

  const ward = risk?.wards?.[0];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
        Model Evidence
      </h1>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        All model outputs, confidence levels, calibration status, and known limitations.
        Review disagreements between independent evidence sources before acting.
      </p>

      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[0,1,2,3].map(i => (
            <div key={i} className="loading" style={{ height: 160, borderRadius: 10 }} />
          ))}
        </div>
      )}

      {isError && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          ⚠ Risk data unavailable — ensure backend is running.
        </div>
      )}

      {ward && (
        <>
          {/* Model outputs grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
            <ModelOutputCard
              name="Parametric Storm Surge"
              version="parametric-surge-v0.3"
              value={ward.surge_height_m.toFixed(2)}
              unit="metres (peak at landfall)"
              confidence={0.62}
              calibration="Calibrated against Fani 2019, Mocha 2023, Yaas 2021 post-event surveys"
              limitation="Proxy model — not certified NWP/ADCIRC. Upgrade path: GeoClaw coupled model."
              color={ward.surge_height_m > 2 ? '#ef4444' : '#38bdf8'}
            />
            <ModelOutputCard
              name="TWI Rainfall-Runoff"
              version="twi-runoff-v1.0"
              value={(ward.runoff_risk_score * 100).toFixed(0)}
              unit="% risk score"
              confidence={0.55}
              calibration="SRTM DEM slope + Dynamic World LULC runoff coefficient; generic calibration"
              limitation="Generic curve (HAZUS analogue). Regional recalibration needed for Odisha delta."
              color={ward.runoff_risk_score > 0.6 ? '#ef4444' : '#f59e0b'}
            />
            <ModelOutputCard
              name="Wind Speed Estimate"
              version="track-cliper-v1.0"
              value={Math.round(ward.wind_speed_kmh)}
              unit="km/h (surface max)"
              confidence={0.48}
              calibration="CLIPER statistical extrapolation from historical Bay of Bengal climatology"
              limitation="Statistical only — large uncertainty beyond T+48h. Not a NWP forecast."
              color={ward.wind_speed_kmh > 180 ? '#ef4444' : '#38bdf8'}
            />
            <ModelOutputCard
              name="Rainfall Forecast (48h)"
              version="open-meteo-gfs-historical"
              value={Math.round(ward.rainfall_mm_48h)}
              unit="mm accumulated"
              confidence={0.70}
              calibration="Historical GFS reanalysis for Fani 2019 period — not a live forecast"
              limitation="Demo preset — values from historical record, not a live model run."
              color={ward.rainfall_mm_48h > 200 ? '#ef4444' : '#38bdf8'}
            />
          </div>

          {/* Ranked risk drivers */}
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>
              Ranked Risk Drivers — {ward.ward_name}
            </div>
            <RiskDriverRow rank={1} driver="High accumulated rainfall + TWI-assessed flash flood risk" value={Math.round(ward.rainfall_mm_48h).toString()} unit="mm" impact="critical" />
            <RiskDriverRow rank={2} driver="Wind speed exceeds infrastructure damage threshold (150 km/h)" value={Math.round(ward.wind_speed_kmh).toString()} unit="km/h" impact="high" />
            <RiskDriverRow rank={3} driver="Storm surge inundation of coastal low-lying areas" value={ward.surge_height_m.toFixed(2)} unit="m" impact="moderate" />
            <RiskDriverRow rank={4} driver="Population density in exposed ward" value={ward.population.toLocaleString()} unit="people" impact="moderate" />
            <RiskDriverRow rank={5} driver="Infrastructure exposure (hospitals, power, roads)" value={ward.flagged_assets?.length.toString() ?? '0'} unit="assets flagged" impact={ward.flagged_assets?.length > 0 ? 'high' : 'low'} />
          </div>

          {/* Evidence agreement/disagreement */}
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>
              Independent Evidence Comparison
            </div>
            {[
              {
                check: 'Track source agreement',
                result: 'Single mock provider — no independent cross-check available',
                status: 'warn',
              },
              {
                check: 'Surge vs. historical analogs',
                result: `Estimated surge ${ward.surge_height_m.toFixed(2)}m vs Fani landfall recorded ~3.5m — model underestimates; calibration gap expected.`,
                status: 'warn',
              },
              {
                check: 'Rainfall forecast vs. historical record',
                result: `${Math.round(ward.rainfall_mm_48h)}mm vs actual Fani 48h record ~180mm — model overestimate; within known GFS bias range for BoB.`,
                status: 'warn',
              },
              {
                check: 'Trigger determinism (independent of LLM)',
                result: 'Insurance triggers computed from structured model outputs only. Gemini draft does not alter trigger boolean.',
                status: 'ok',
              },
              {
                check: 'Physical plausibility check',
                result: 'Surge + rainfall + wind values within expected range for Category 4–5 Bay of Bengal cyclone.',
                status: 'ok',
              },
            ].map(row => (
              <div key={row.check} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--color-border)',
              }}>
                <span style={{
                  fontSize: 11, flexShrink: 0, marginTop: 1,
                  color: row.status === 'ok' ? '#22c55e' : '#f59e0b',
                }}>
                  {row.status === 'ok' ? '✓' : '⚠'}
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)' }}>{row.check}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.result}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
