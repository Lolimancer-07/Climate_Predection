/**
 * frontend/src/pages/AdminPanel.tsx
 *
 * GCS Administration & Registry Console
 * Spec: UAV Digital Twin Reference-Aligned Implementation Plan §4.2 item 11
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useRole } from '../components/RoleGate'
import { Settings, Shield, FileText, Send, Database, Layers, CheckCircle2 } from 'lucide-react'

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

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'assets' | 'policies' | 'dispatch_log' | 'basin_config'>('assets')
  const { role, setRole } = useRole()

  const { data: assets, isLoading: assetsLoading } = useQuery<AssetRow[]>({
    queryKey: ['assets', 'IN-OD-PURI'],
    queryFn: async () => {
      const { data } = await api.get('/assets/IN-OD-PURI')
      return data
    },
    staleTime: 120_000,
  })

  const tabs = [
    { id: 'assets',       label: 'Infrastructure Assets',   icon: <Layers size={14} /> },
    { id: 'policies',     label: 'Parametric Policies',     icon: <FileText size={14} /> },
    { id: 'dispatch_log', label: 'Dispatch Audit Log',      icon: <Send size={14} /> },
    { id: 'basin_config', label: 'Basin Calibration',       icon: <Database size={14} /> },
  ]

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg)',
      color: 'var(--color-text)',
      overflow: 'hidden',
    }}>
      {/* ── Subheader ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: 'rgba(13, 21, 40, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
          }}>
            <Settings size={18} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>System Administration &amp; Configuration</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Infrastructure registry, RBAC controls, and parametric policies</div>
          </div>
        </div>

        {/* Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={14} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>ACTIVE RBAC ROLE:</span>
          <select
            id="role-selector"
            value={role}
            onChange={e => setRole(e.target.value as any)}
            style={{
              background: 'rgba(18, 30, 53, 0.9)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            <option value="admin">ADMINISTRATOR</option>
            <option value="ddma_operator">DDMA_OPERATOR</option>
            <option value="insurer_viewer">INSURER_VIEWER</option>
            <option value="public">PUBLIC (READONLY)</option>
          </select>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '10px 24px 0',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(10, 16, 29, 0.8)',
        flexShrink: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontFamily: 'var(--font-mono)',
              color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
              background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              borderTopLeftRadius: '6px',
              borderTopRightRadius: '6px',
              border: '1px solid',
              borderColor: activeTab === tab.id ? 'rgba(56, 189, 248, 0.3) rgba(56, 189, 248, 0.3) transparent' : 'transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>

        {activeTab === 'assets' && (
          <div id="assets-table">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#ffffff' }}>
                  Critical Infrastructure Inventory — District: IN-OD-PURI
                </h2>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>OSM Extract &amp; OSDMA Shelters Registry with multi-factor criticality scores</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#38bdf8' }}>
                TOTAL ASSETS: {assets?.length ?? 0}
              </span>
            </div>

            {assetsLoading && <div style={{ height: 200, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />}

            {assets && (
              <div style={{
                background: 'rgba(13, 21, 40, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                }}>
                  <thead>
                    <tr style={{ background: 'rgba(18, 30, 53, 0.8)', textAlign: 'left' }}>
                      {['Type', 'Name', 'Asset ID', 'Criticality Index', 'Geometry Type'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset, i) => (
                      <tr
                        key={asset.asset_id}
                        id={`asset-row-${asset.asset_id}`}
                        style={{
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          {ASSET_TYPE_ICONS[asset.asset_type] ?? '📍'} {asset.asset_type}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#ffffff', fontWeight: 500 }}>{asset.name}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#38bdf8' }}>{asset.asset_id}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              height: 6,
                              width: 80,
                              background: 'rgba(255,255,255,0.1)',
                              borderRadius: 3,
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(100, asset.criticality * 100)}%`,
                                background: asset.criticality > 0.8 ? '#ef4444' : asset.criticality > 0.5 ? '#f59e0b' : '#34d399',
                              }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
                              {asset.criticality.toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94a3b8' }}>
                          {asset.geometry.type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'policies' && (
          <div id="policies-panel">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#ffffff' }}>
              Contractual Parametric Policies Registry
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
              {[
                { id: 'POL-ODISHA-2024-001', trigger: 'surge_height', threshold: '≥ 3.0 m', payout: '$1,250,000', underwriter: 'Swiss Re' },
                { id: 'POL-ODISHA-2024-002', trigger: 'rainfall_total', threshold: '≥ 250 mm / 48h', payout: '$500,000', underwriter: 'Munich Re' },
                { id: 'POL-ODISHA-2024-003', trigger: 'wind_speed', threshold: '≥ 200 km/h', payout: '$750,000', underwriter: 'ODSMA Contingency Fund' },
              ].map(p => (
                <div
                  key={p.id}
                  id={`policy-${p.id}`}
                  style={{
                    background: 'rgba(13, 21, 40, 0.8)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>{p.id}</span>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#34d399', fontWeight: 600 }}>ACTIVE</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Underwriter: {p.underwriter}</div>
                    <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 4 }}>
                      Contract Trigger: <strong style={{ color: '#ffffff' }}>{p.trigger} {p.threshold}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Pre-Agreed Liquidity:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: '#a855f7' }}>{p.payout}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 16,
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 11,
              color: '#d8b4fe',
            }}>
              ⚠️ <strong>Audit Grounding Rule:</strong> Parametric policies trigger strictly through deterministic physical models (inverted barometer surge deficit, rainfall accumulation). Gemini never initiates or modifies financial liquidity decisions.
            </div>
          </div>
        )}

        {activeTab === 'dispatch_log' && (
          <div id="dispatch-log-panel">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#ffffff' }}>
              Multi-Channel Dispatch &amp; Review Audit Trail
            </h2>
            <div style={{
              background: 'rgba(13, 21, 40, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              padding: 24,
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: 12,
            }}>
              <CheckCircle2 size={32} style={{ color: '#38bdf8', margin: '0 auto 8px auto', opacity: 0.7 }} />
              <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>All Dispatches Require Operator Signature</div>
              <div>Use the <strong>Advisories &amp; Review</strong> console to approve and dispatch warning packages across CAP 1.2 XML, SMS, WhatsApp, and PDF.</div>
            </div>
          </div>
        )}

        {activeTab === 'basin_config' && (
          <div id="basin-config-panel">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#ffffff' }}>
              Bay of Bengal Basin Calibration Constants (`bay_of_bengal.yaml`)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { key: 'shelf_slope', val: '0.0012', desc: 'Bathymetric shelf slope amplification' },
                { key: 'ambient_pressure_hpa', val: '1013.25', desc: 'Standard sea-level pressure baseline' },
                { key: 'drag_coefficient', val: '0.0026', desc: 'Surface wind stress factor' },
                { key: 'max_surge_cap_m', val: '7.5', desc: 'Physical upper ceiling for surge model' },
                { key: 'twi_flash_flood_threshold', val: '11.5', desc: 'Topographic Wetness Index critical value' },
                { key: 'hitl_enforce_human_confirmation', val: 'TRUE', desc: 'Mandatory human approval gate' },
              ].map(cfg => (
                <div key={cfg.key} style={{
                  background: 'rgba(13, 21, 40, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#38bdf8', marginBottom: 4 }}>{cfg.key}</div>
                  <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#ffffff', marginBottom: 4 }}>{cfg.val}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{cfg.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
