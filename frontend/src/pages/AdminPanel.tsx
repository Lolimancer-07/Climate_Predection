import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'


interface AssetRow {
  asset_id: string
  asset_type: string
  name: string
  criticality: number
  geometry: { type: string; coordinates: any }
}

const ASSET_TYPE_ICONS: Record<string, string> = {
  hospital:    '🏥',
  shelter:     '🏠',
  road:        '🛣️',
  power_line:  '🔌',
  substation:  '⚡',
}

const ROLE_COLORS: Record<string, string> = {
  admin:          '#38bdf8',
  ddma_operator:  '#22c55e',
  insurer_viewer: '#a855f7',
  readonly:       '#94a3b8',
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'assets' | 'policies' | 'dispatch_log'>('assets')
  const [currentRole, setCurrentRole] = useState('admin')

  const { data: assets, isLoading: assetsLoading } = useQuery<AssetRow[]>({
    queryKey: ['assets', 'IN-OD-PURI'],
    queryFn: async () => {
      const { data } = await api.get('/assets/IN-OD-PURI')
      return data
    },
    staleTime: 120_000,
  })

  const tabs = [
    { id: 'assets',      label: '🏗️  Infrastructure Assets' },
    { id: 'policies',    label: '📋  Insurance Policies' },
    { id: 'dispatch_log', label: '📡  Dispatch Log' },
  ]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', color: 'var(--color-text)' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <header className="app-header">
        <div className="logo-mark">⚙️</div>
        <div>
          <div className="header-title">Admin Panel — Cyclone Platform</div>
          <div className="header-subtitle">Data management, RBAC, and audit log</div>
        </div>
        <div className="header-spacer" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Role:</span>
          <select
            id="role-selector"
            value={currentRole}
            onChange={e => setCurrentRole(e.target.value)}
            style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              color: ROLE_COLORS[currentRole] ?? 'var(--color-text)',
              borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <option value="admin">admin</option>
            <option value="ddma_operator">ddma_operator</option>
            <option value="insurer_viewer">insurer_viewer</option>
            <option value="readonly">readonly</option>
          </select>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => window.location.href = '/'}
          id="btn-back-dashboard"
        >
          ← Dashboard
        </button>
      </header>

      {/* ── Tabs ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '12px 20px 0',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

        {activeTab === 'assets' && (
          <div id="assets-table">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--color-sky)' }}>
              Infrastructure Assets — IN-OD-PURI
            </h2>
            {assetsLoading && <div className="loading" style={{ height: 200, borderRadius: 12 }} />}
            {assets && (
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 12,
              }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-2)', textAlign: 'left' }}>
                    {['Type', 'Name', 'Asset ID', 'Criticality', 'Geometry'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', color: 'var(--color-text-muted)', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset, i) => (
                    <tr
                      key={asset.asset_id}
                      id={`asset-row-${asset.asset_id}`}
                      style={{
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <td style={{ padding: '8px 12px' }}>
                        {ASSET_TYPE_ICONS[asset.asset_type] ?? '📍'} {asset.asset_type}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text)' }}>{asset.name}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}>{asset.asset_id}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            height: 6, width: `${asset.criticality * 60}px`,
                            background: `hsl(${(1 - asset.criticality) * 120}deg 70% 55%)`,
                            borderRadius: 3,
                          }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{asset.criticality.toFixed(2)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}>
                        {asset.geometry.type}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'policies' && (
          <div id="policies-panel">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--color-sky)' }}>
              Parametric Insurance Policies — Demo Dataset
            </h2>
            {[
              { id: 'POL-ODISHA-2024-001', trigger: 'surge_height',    threshold: '≥ 2.0 m',    payout: '$500,000' },
              { id: 'POL-ODISHA-2024-002', trigger: 'rainfall_total',  threshold: '≥ 200 mm',   payout: '$250,000' },
              { id: 'POL-ODISHA-2024-003', trigger: 'wind_speed',      threshold: '≥ 150 km/h', payout: '$750,000' },
            ].map((p, i) => (
              <div
                key={p.id}
                id={`policy-${p.id}`}
                style={{
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 16,
                }}
              >
                <div style={{ fontSize: 20 }}>📋</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Zone: IN-OD-PURI · Trigger: {p.trigger} {p.threshold}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
                  color: 'var(--color-trigger-fired)',
                }}>
                  {p.payout}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 12 }}>
              ⚠️ Demo policies only. No real financial exposure. Trigger boolean is computed from structured hazard data; no LLM involvement.
            </div>
          </div>
        )}

        {activeTab === 'dispatch_log' && (
          <div id="dispatch-log-panel">
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--color-sky)' }}>
              Dispatch Log
            </h2>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: 40 }}>
              No dispatches yet in this session.<br />
              Generate and dispatch an advisory from the Dashboard to see records here.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
