/**
 * frontend/src/pages/OperationsOverview.tsx
 *
 * Default landing page — information-dense KPI overview.
 * Shows: active storms, model/provider health, approvals waiting,
 * highest-risk districts, pipeline freshness.
 * Spec: UAV Digital Twin plan §4.2, page 1 "Operations Overview"
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStorm } from '../context/StormContext';
import { fetchDistrictRisk } from '../api/client';

interface OperationsOverviewProps {
  onNavigate?: (page: any) => void;
}

function KpiCard({
  label, value, unit, color, note,
}: {
  label: string; value: string | number; unit?: string;
  color?: string; note?: string;
}) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
      transition: 'border-color var(--transition-fast)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)',
        color: color ?? 'var(--color-sky)', lineHeight: 1.1,
      }}>
        {value}
        {unit && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
      {note && <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{note}</div>}
    </div>
  );
}

function SeverityBadge({ tier }: { tier: string }) {
  const t = tier.toLowerCase();
  const map: Record<string, { bg: string; color: string }> = {
    watch:            { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
    warning:          { bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
    'evacuation order':{ bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
    safe:             { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  };
  const style = map[t] ?? { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      background: style.bg, color: style.color,
      border: `1px solid ${style.color}44`,
    }}>
      {tier}
    </span>
  );
}

export function OperationsOverview({ onNavigate }: OperationsOverviewProps) {
  const { activeStorm, selectedDistrict } = useStorm();

  const { data: risk, isLoading, isError } = useQuery({
    queryKey: ['district-risk', selectedDistrict],
    queryFn: () => fetchDistrictRisk(selectedDistrict),
    staleTime: 60_000,
    retry: 1,
  });

  const ward = risk?.wards?.[0];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
          Operations Overview
        </h1>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Situational summary for Bay of Bengal cyclone anticipatory action.
          All values are from mock/demo providers unless otherwise stated.
        </p>
      </div>

      {/* Active event banner */}
      {activeStorm ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(135deg, rgba(56,189,248,0.07), rgba(99,102,241,0.07))',
          border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10,
          padding: '12px 16px', marginBottom: 20,
        }}>
          <span style={{ fontSize: 24 }}>🌀</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-sky)' }}>
              {activeStorm.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              {activeStorm.storm_id} · {activeStorm.basin.replace(/_/g, ' ')} · {activeStorm.status.replace(/_/g, ' ')}
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.3)',
          }}>
            ◎ {activeStorm.data_mode ?? 'MOCK'}
          </span>
          {onNavigate && (
            <button
              onClick={() => onNavigate('live_tracker')}
              style={{
                marginLeft: 'auto', padding: '6px 14px', borderRadius: 6,
                background: 'linear-gradient(135deg, var(--color-sky), var(--color-indigo))',
                border: 'none', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Open Live Tracker →
            </button>
          )}
        </div>
      ) : (
        <div style={{
          padding: '16px', borderRadius: 10, marginBottom: 20,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          fontSize: 12, color: 'var(--color-text-muted)',
        }}>
          No active storm in the monitored basin. Showing demo data for Fani 2019 replay.
        </div>
      )}

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="loading" style={{ height: 90, borderRadius: 10 }} />
          ))
        ) : isError ? (
          <div style={{ gridColumn: '1/-1', color: 'var(--color-text-muted)', fontSize: 12 }}>
            ⚠ Risk data unavailable — backend may not be running or district not found.
          </div>
        ) : ward ? (
          <>
            <KpiCard label="Surge Height" value={ward.surge_height_m.toFixed(1)} unit="m"
              color={ward.surge_height_m > 2 ? '#ef4444' : ward.surge_height_m > 1 ? '#f97316' : '#38bdf8'}
              note="Peak parametric proxy estimate"
            />
            <KpiCard label="Rainfall 48h" value={Math.round(ward.rainfall_mm_48h)} unit="mm"
              color={ward.rainfall_mm_48h > 200 ? '#ef4444' : '#38bdf8'}
              note="GFS open-meteo forecast"
            />
            <KpiCard label="Wind Speed" value={Math.round(ward.wind_speed_kmh)} unit="km/h"
              color={ward.wind_speed_kmh > 180 ? '#ef4444' : ward.wind_speed_kmh > 120 ? '#f97316' : '#38bdf8'}
              note="Max sustained surface wind"
            />
            <KpiCard label="Population Exposed" value={ward.population.toLocaleString()} unit="people"
              note={ward.ward_name}
            />
            <KpiCard label="Runoff Risk" value={(ward.runoff_risk_score * 100).toFixed(0)} unit="%"
              color={ward.runoff_risk_score > 0.6 ? '#ef4444' : '#f59e0b'}
              note="TWI + LULC model"
            />
            <KpiCard label="Severity" value={ward.severity_tier} color="#f59e0b" note="District tier" />
          </>
        ) : null}
      </div>

      {/* Ward risk table */}
      {risk && (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 10, overflow: 'hidden', marginBottom: 24,
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
              District Risk — {risk.cyclone_name} ({risk.cyclone_category})
            </div>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              {risk.district_id} · {risk.event_id}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)' }}>
                  {['Ward', 'Population', 'Surge (m)', 'Rainfall (mm)', 'Wind (km/h)', 'Runoff', 'Tier', 'Flagged Assets'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left',
                      color: 'var(--color-text-muted)', fontWeight: 600,
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em',
                      borderBottom: '1px solid var(--color-border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risk.wards.map((w: any) => (
                  <tr key={w.ward_id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background var(--transition-fast)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-text)' }}>{w.ward_name}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{w.population.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: w.surge_height_m > 2 ? '#ef4444' : 'inherit' }}>{w.surge_height_m.toFixed(2)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{Math.round(w.rainfall_mm_48h)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{Math.round(w.wind_speed_kmh)}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{(w.runoff_risk_score * 100).toFixed(0)}%</td>
                    <td style={{ padding: '8px 12px' }}><SeverityBadge tier={w.severity_tier} /></td>
                    <td style={{ padding: '8px 12px', color: w.flagged_assets.length > 0 ? '#f97316' : 'var(--color-text-muted)' }}>
                      {w.flagged_assets.length > 0 ? `⚠ ${w.flagged_assets.length} flagged` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
            Pipeline / Model Status
          </div>
          {[
            { name: 'Parametric Surge Model', status: 'operational', note: 'v0.3 · Bay of Bengal calibrated' },
            { name: 'TWI Runoff Model', status: 'operational', note: 'LULC + slope TWI scoring' },
            { name: 'Track Forecast (CLIPER)', status: 'mock', note: 'Statistical extrapolation — not NWP' },
            { name: 'Gemini Advisory Draft', status: 'disabled', note: 'API key required' },
            { name: 'Dispatch / SMS / WhatsApp', status: 'disabled', note: 'Twilio key required' },
          ].map(m => (
            <div key={m.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 0', borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: m.status === 'operational' ? '#22c55e' : m.status === 'mock' ? '#f59e0b' : '#64748b',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text)' }}>{m.name}</div>
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{m.note}</div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                background: m.status === 'operational' ? 'rgba(34,197,94,0.12)' : m.status === 'mock' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
                color: m.status === 'operational' ? '#22c55e' : m.status === 'mock' ? '#f59e0b' : '#64748b',
              }}>
                {m.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
            Data Sources &amp; Provenance
          </div>
          {[
            { source: 'Mock Cyclone Provider', type: 'Track/Intensity', freshness: 'Synthetic — seeded fixture', mode: 'MOCK' },
            { source: 'Open-Meteo (GFS)', type: 'Rainfall Forecast', freshness: 'Historical preset', mode: 'DEMO' },
            { source: 'OSM Overpass', type: 'Infrastructure Assets', freshness: 'Snapshot ~2023', mode: 'DEMO' },
            { source: 'OSDMA Registry', type: 'Cyclone Shelters', freshness: 'Seeded fixture', mode: 'DEMO' },
            { source: 'SRTM DEM (GEE)', type: 'Terrain / TWI', freshness: 'Static ~2000', mode: 'DEMO' },
          ].map(d => (
            <div key={d.source} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '6px 0', borderBottom: '1px solid var(--color-border)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text)' }}>{d.source}</div>
                <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>{d.type} · {d.freshness}</div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
              }}>
                {d.mode}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
