/**
 * frontend/src/pages/HistoricalTrendsPage.tsx
 * Historical risk/damage trend analytics across past cyclone events.
 * Uses recharts for visualization.
 */
import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, Activity, BarChart2 } from 'lucide-react';

// Historical demo dataset — real implementation queries /analytics/{district_id}/history
const HISTORICAL_DATA = [
  { event: 'Phailin-2013', year: 2013, max_surge_m: 3.2, max_wind_kmh: 215, rainfall_mm: 280, affected_assets: 12, triggered: true },
  { event: 'HudHud-2014',  year: 2014, max_surge_m: 2.1, max_wind_kmh: 185, rainfall_mm: 195, affected_assets: 7,  triggered: false },
  { event: 'Fani-2019',    year: 2019, max_surge_m: 3.84,max_wind_kmh: 250, rainfall_mm: 312, affected_assets: 18, triggered: true },
  { event: 'Amphan-2020',  year: 2020, max_surge_m: 4.2, max_wind_kmh: 260, rainfall_mm: 385, affected_assets: 22, triggered: true },
  { event: 'Yaas-2021',    year: 2021, max_surge_m: 3.6, max_wind_kmh: 230, rainfall_mm: 295, affected_assets: 15, triggered: true },
  { event: 'Sitrang-2022', year: 2022, max_surge_m: 1.8, max_wind_kmh: 160, rainfall_mm: 210, affected_assets: 5,  triggered: false },
  { event: 'Mocha-2023',   year: 2023, max_surge_m: 4.5, max_wind_kmh: 280, rainfall_mm: 420, affected_assets: 25, triggered: true },
];

const CHART_STYLE = {
  background: 'transparent',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--text-muted)',
};

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
};

type Tab = 'surge' | 'wind' | 'assets';

export function HistoricalTrendsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('surge');
  const [districtId, setDistrictId] = useState('IN-OD-PURI');

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'surge',  label: 'Surge Height',    icon: <Activity size={14} /> },
    { id: 'wind',   label: 'Wind & Rainfall', icon: <TrendingUp size={14} /> },
    { id: 'assets', label: 'Asset Impact',    icon: <BarChart2 size={14} /> },
  ];

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingUp size={20} style={{ color: 'white' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
            Historical Risk Trends
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Bay of Bengal cyclone impacts across past events · {districtId}
          </p>
        </div>
        <select
          value={districtId}
          onChange={(e) => setDistrictId(e.target.value)}
          style={{
            marginLeft: 'auto',
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)',
          }}
        >
          <option value="IN-OD-PURI">Puri, Odisha</option>
          <option value="IN-OD-KENDRAPARA">Kendrapara, Odisha</option>
          <option value="IN-AP-KRISHNA">Krishna, AP</option>
        </select>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)',
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-1)', border: '1px solid var(--border-subtle)',
        width: 'fit-content',
      }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: 500, transition: 'all var(--transition-base)',
              background: activeTab === t.id ? 'var(--color-primary)' : 'transparent',
              color: activeTab === t.id ? 'white' : 'var(--text-muted)',
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)', padding: 'var(--space-6)',
        minHeight: 380,
      }}>
        {activeTab === 'surge' && (
          <>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Max Storm Surge Height (m)
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Parametric trigger threshold: 3.0m
              </p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={HISTORICAL_DATA} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="event" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <ReferenceLine y={3.0} stroke="var(--color-danger)" strokeDasharray="4 4" label={{ value: 'Trigger', fill: 'var(--color-danger)', fontSize: 10 }} />
                <Line
                  type="monotone" dataKey="max_surge_m" name="Surge (m)"
                  stroke="var(--color-primary)" strokeWidth={2.5} dot={{ fill: 'var(--color-primary)', r: 5 }}
                  activeDot={{ r: 7, fill: 'var(--color-primary-light)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}

        {activeTab === 'wind' && (
          <>
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Wind Speed & 72h Rainfall
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={HISTORICAL_DATA} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="event" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="max_wind_kmh" name="Wind (km/h)"
                  stroke="var(--color-warning)" strokeWidth={2.5} dot={{ fill: 'var(--color-warning)', r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="rainfall_mm" name="Rainfall (mm)"
                  stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: 'var(--color-primary)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}

        {activeTab === 'assets' && (
          <>
            <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Affected Infrastructure Assets per Event
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={HISTORICAL_DATA} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="event" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="affected_assets" name="Affected Assets"
                  fill="var(--color-primary)" radius={[4, 4, 0, 0]}
                  label={{ position: 'top', fill: 'var(--text-muted)', fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Summary table */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)', overflow: 'hidden', marginTop: 'var(--space-5)',
      }}>
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>Event Summary</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-overlay)' }}>
              {['Event', 'Year', 'Max Surge', 'Max Wind', 'Rainfall 72h', 'Assets Affected', 'Triggered'].map((h) => (
                <th key={h} style={{ padding: 'var(--space-3)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HISTORICAL_DATA.map((d) => (
              <tr key={d.event} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: 'var(--space-3)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>{d.event}</td>
                <td style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{d.year}</td>
                <td style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: d.max_surge_m >= 3 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>{d.max_surge_m}m</td>
                <td style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{d.max_wind_kmh} km/h</td>
                <td style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{d.rainfall_mm} mm</td>
                <td style={{ padding: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{d.affected_assets}</td>
                <td style={{ padding: 'var(--space-3)' }}>
                  {d.triggered
                    ? <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>✓ TRIGGERED</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
