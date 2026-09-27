/**
 * frontend/src/pages/HardeningPriorityPage.tsx
 * Pre-landfall structural hardening priority list.
 * Ranked table of infrastructure assets sorted by reinforcement urgency.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Shield, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Building2, Zap, TreePine, ExternalLink
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type DamageState = 'none' | 'minor' | 'moderate' | 'severe' | 'collapse';

interface HardeningItem {
  rank: number;
  asset_id: string;
  asset_class: string;
  safety_factor: number;
  hardening_priority_score: number;
  combined_expected_damage_state: DamageState;
  recommended_action: string;
  confidence: string;
  likely_failure: boolean;
  notes: string[];
}

interface HardeningResponse {
  district_id: string;
  event_id: string;
  wind_speed_kmh: number;
  items: HardeningItem[];
  disclaimer: string;
}

const DS_COLORS: Record<DamageState, string> = {
  none:     'var(--ds-none)',
  minor:    'var(--ds-minor)',
  moderate: 'var(--ds-moderate)',
  severe:   'var(--ds-severe)',
  collapse: 'var(--ds-collapse)',
};

const DS_BG: Record<DamageState, string> = {
  none:     'hsl(142, 40%, 12%)',
  minor:    'hsl(67, 40%, 12%)',
  moderate: 'hsl(38, 45%, 12%)',
  severe:   'hsl(20, 45%, 12%)',
  collapse: 'hsl(0, 40%, 12%)',
};

const ASSET_ICON: Record<string, React.ReactNode> = {
  hospital:           <Building2 size={14} />,
  shelter:            <Shield size={14} />,
  wood_power_pole:    <Zap size={14} />,
  concrete_power_pole:<Zap size={14} />,
  steel_lattice_tower:<Zap size={14} />,
  rcc_building:       <Building2 size={14} />,
  masonry_building:   <Building2 size={14} />,
  thatched_roof_house:<TreePine size={14} />,
};

function SafetyBar({ value }: { value: number }) {
  const clamped = Math.min(value, 2.5);
  const pct = (clamped / 2.5) * 100;
  const color = value < 1.0 ? 'var(--color-danger)' : value < 1.5 ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-overlay)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color, minWidth: 32 }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function HardeningRow({ item }: { item: HardeningItem }) {
  const [expanded, setExpanded] = useState(false);
  const ds = item.combined_expected_damage_state;

  return (
    <>
      <tr
        style={{
          background: item.likely_failure ? 'hsla(0, 50%, 10%, 0.5)' : 'transparent',
          cursor: 'pointer',
          transition: 'background var(--transition-fast)',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <td style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
          #{item.rank}
        </td>
        <td style={{ padding: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)' }}>
            {ASSET_ICON[item.asset_class] ?? <Building2 size={14} />}
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                {item.asset_id}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {item.asset_class.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </td>
        <td style={{ padding: 'var(--space-3)', minWidth: 140 }}>
          <SafetyBar value={item.safety_factor} />
        </td>
        <td style={{ padding: 'var(--space-3)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)',
            background: DS_BG[ds], color: DS_COLORS[ds],
            fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'capitalize',
          }}>
            {ds === 'collapse' && <AlertTriangle size={11} />}
            {ds === 'none' && <CheckCircle2 size={11} />}
            {ds}
          </span>
        </td>
        <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
            background: item.confidence === 'region_calibrated' ? 'var(--color-success)' : 'var(--color-warning)',
          }} title={item.confidence} />
        </td>
        <td style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-muted)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: 'var(--bg-overlay)' }}>
          <td colSpan={6} style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-warning)', marginBottom: 4 }}>
                  RECOMMENDED ACTION
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  {item.recommended_action}
                </p>
              </div>
              {item.notes.length > 0 && (
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>NOTES</div>
                  {item.notes.map((note, i) => (
                    <p key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '2px 0' }}>• {note}</p>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function HardeningPriorityPage() {
  const [districtId, setDistrictId] = useState('IN-OD-PURI');
  const [windKmh, setWindKmh] = useState(220);

  const { data, isLoading, isError, refetch } = useQuery<HardeningResponse>({
    queryKey: ['hardening', districtId, windKmh],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/structural/${encodeURIComponent(districtId)}/hardening-priority`, {
        params: { wind_speed_kmh: windKmh, top_n: 20 },
      });
      return res.data;
    },
    retry: 1,
  });

  const failureCount = data?.items.filter((i) => i.likely_failure).length ?? 0;

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--color-warning), var(--color-danger))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-danger)',
          }}>
            <Shield size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
              Pre-Landfall Hardening Priority
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Ranked infrastructure reinforcement list · Screening-level only
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        {data?.disclaimer && (
          <div style={{
            background: 'var(--color-warning-muted)', borderLeft: '3px solid var(--color-warning)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-xs)', color: 'var(--color-warning)',
          }}>
            ⚠️ {data.disclaimer}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)',
        flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>District</span>
          <select
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)',
            }}
          >
            <option value="IN-OD-PURI">IN-OD-PURI (Puri, Odisha)</option>
            <option value="IN-OD-KENDRAPARA">IN-OD-KENDRAPARA</option>
            <option value="IN-AP-KRISHNA">IN-AP-KRISHNA</option>
            <option value="IN-WB-SOUTH24PGS">IN-WB-SOUTH24PGS</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Wind Speed: {windKmh} km/h</span>
          <input
            type="range" min={60} max={320} step={10} value={windKmh}
            onChange={(e) => setWindKmh(Number(e.target.value))}
            style={{ width: 200, accentColor: 'var(--color-warning)' }}
          />
        </label>

        <button
          id="hardening-run-btn"
          onClick={() => refetch()}
          style={{
            background: 'var(--color-warning)', color: 'var(--text-inverse)',
            border: 'none', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-4)', fontWeight: 600,
            fontSize: 'var(--text-sm)', cursor: 'pointer',
          }}
        >
          Run Assessment
        </button>

        {data && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                {failureCount}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Likely Failure</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {data.items.length}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total Assessed</div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)' }}>
          Loading structural assessment…
        </div>
      )}

      {isError && (
        <div style={{
          background: 'var(--color-danger-muted)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)', color: 'var(--color-danger)', textAlign: 'center',
        }}>
          Failed to load data. Backend may be offline.
        </div>
      )}

      {data && !isLoading && (
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-overlay)' }}>
                {['Rank', 'Asset', 'Safety Factor', 'Damage State', 'Curve', ''].map((h) => (
                  <th key={h} style={{
                    padding: 'var(--space-3) var(--space-3)',
                    fontSize: 'var(--text-xs)', fontWeight: 600,
                    color: 'var(--text-muted)', textAlign: 'left',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <HardeningRow key={item.asset_id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        {[
          { label: 'region_calibrated', color: 'var(--color-success)' },
          { label: 'generic_curve (HAZUS)', color: 'var(--color-warning)' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
