/**
 * frontend/src/pages/Dashboard.tsx
 *
 * Cyclone Operations Digital Twin — Impact Map & Operations Console
 * Spec: UAV Digital Twin Reference-Aligned Implementation Plan §4.3
 *
 * Layout:
 * - Top telemetry ribbon: storm metadata, lead time, peak hazard readings
 * - Left panel: Ward selection, vulnerability metrics, critical facilities
 * - Center map: MapLibre interactive canvas with surge, rainfall, shelters, routes
 * - Right panel: Grounded advisory preview, HITL dispatch, parametric trigger
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MapView from '../components/MapView'
import RiskPanel from '../components/RiskPanel'
import AdvisoryPreview from '../components/AdvisoryPreview'
import DispatchControls from '../components/DispatchControls'
import InsuranceTriggerPanel from '../components/InsuranceTriggerPanel'
import { useStorm } from '../context/StormContext'
import {
  fetchDistrictRisk, evaluateTriggers, generateAdvisory,
  type DistrictRisk, type AdvisoryOut,
} from '../api/client'
import {
  ShieldAlert, Waves, Wind, CloudRain, Users, Radio, CheckCircle2,
  Layers, MapPin, AlertTriangle, Cpu
} from 'lucide-react'

export default function Dashboard() {
  const { activeStorm, selectedDistrict } = useStorm()
  const districtId = selectedDistrict || 'IN-OD-PURI'
  const eventId = activeStorm?.storm_id || 'CYCLONE-FANI-2019'

  const [selectedWard, setSelectedWard] = useState<string | null>(null)
  const [advisory, setAdvisory] = useState<AdvisoryOut | null>(null)
  const [showDispatch, setShowDispatch] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<any>(null)
  const queryClient = useQueryClient()

  // ── Fetch risk data ────────────────────────────────────────
  const { data: risk, isLoading } = useQuery<DistrictRisk>({
    queryKey: ['district-risk', districtId],
    queryFn: () => fetchDistrictRisk(districtId),
    staleTime: 60_000,
  })

  const ward = risk?.wards.find(
    w => w.ward_id === (selectedWard ?? risk.wards[0]?.ward_id)
  )

  // ── Evaluate triggers ──────────────────────────────────────
  const triggerMutation = useMutation({
    mutationFn: () => evaluateTriggers(eventId, {
      surge_height: ward?.surge_height_m ?? 0,
      rainfall_total: ward?.rainfall_mm_48h ?? 0,
      wind_speed: ward?.wind_speed_kmh ?? 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers', eventId] })
    },
  })

  // ── Generate advisory ──────────────────────────────────────
  const advisoryMutation = useMutation({
    mutationFn: () => generateAdvisory(
      ward!.ward_id,
      eventId,
      ward!.severity_tier,
      ward as unknown as object,
    ),
    onSuccess: (data) => {
      setAdvisory(data)
      setShowDispatch(false)
    },
  })

  const severityClass = (ward?.severity_tier ?? 'watch')
    .toLowerCase().replace(/\s+/g, '-') === 'evacuation-order'
    ? 'evacuation'
    : (ward?.severity_tier ?? 'watch').toLowerCase().replace(/\s+/g, '-')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'var(--color-bg)',
      color: 'var(--color-text)',
      overflow: 'hidden',
    }}>
      {/* ── Top HUD Telemetry Ribbon ─────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        background: 'rgba(13, 21, 40, 0.95)',
        borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
        backdropFilter: 'blur(12px)',
        fontSize: '12px',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {/* Status / Category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '4px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: '11px',
            color: '#38bdf8',
          }}>
            <Radio size={12} style={{ animation: 'pulse 1.5s infinite' }} />
            {activeStorm?.data_mode ?? 'HISTORICAL REPLAY'}
          </span>

          <span style={{ fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>
            {risk ? `${risk.cyclone_name} (${risk.cyclone_category})` : activeStorm?.name ?? 'Cyclone Fani (2019)'}
          </span>
        </div>

        <div style={{ height: '16px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />

        {/* Severity Badge */}
        {ward && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: ward.severity_tier === 'Evacuation Order' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: ward.severity_tier === 'Evacuation Order' ? '#ef4444' : '#f59e0b',
            border: `1px solid ${ward.severity_tier === 'Evacuation Order' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
          }}>
            <AlertTriangle size={12} />
            {ward.severity_tier}
          </span>
        )}

        {/* Metric Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
            <Waves size={13} style={{ color: '#38bdf8' }} />
            <span>SURGE:</span>
            <strong style={{ color: '#ffffff' }}>{ward ? `${ward.surge_height_m.toFixed(2)} m` : '3.84 m'}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
            <Wind size={13} style={{ color: '#fbbf24' }} />
            <span>WIND:</span>
            <strong style={{ color: '#ffffff' }}>{ward ? `${ward.wind_speed_kmh} km/h` : '250 km/h'}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
            <CloudRain size={13} style={{ color: '#60a5fa' }} />
            <span>PRECIP 48H:</span>
            <strong style={{ color: '#ffffff' }}>{ward ? `${ward.rainfall_mm_48h} mm` : '312 mm'}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
            <Users size={13} style={{ color: '#34d399' }} />
            <span>EXPOSED POP:</span>
            <strong style={{ color: '#ffffff' }}>{ward ? ward.population.toLocaleString() : '84,500'}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
            <Cpu size={13} style={{ color: '#a855f7' }} />
            <span>SYS:</span>
            <span style={{ color: '#34d399', fontWeight: 700 }}>NOMINAL</span>
          </div>
        </div>
      </div>

      {/* ── Main Workspace: 3-Panel GCS Layout ──────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '360px 1fr 360px',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* ── Left Rail: Ward Selection & Risk Panel ─────────────────── */}
        <aside style={{
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(10, 16, 29, 0.95)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px',
        }}>
          {/* Active Cyclone Header */}
          <div style={{
            background: 'rgba(18, 30, 53, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                TARGET SECTOR
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                {districtId}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>
              🌀 {risk?.cyclone_name ?? 'Cyclone Fani (2019)'}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Landfall: Puri, Odisha · Shelf Deficit Modeling Active
            </div>
          </div>

          {/* Ward Selector Chips */}
          {risk?.wards && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
                Operational Wards ({risk.wards.length})
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {risk.wards.map(w => {
                  const isSelected = w.ward_id === (ward?.ward_id ?? risk.wards[0]?.ward_id)
                  const isCrit = w.severity_tier === 'Evacuation Order'
                  return (
                    <button
                      key={w.ward_id}
                      onClick={() => setSelectedWard(w.ward_id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '4px',
                        border: isSelected
                          ? '1px solid #38bdf8'
                          : '1px solid rgba(255,255,255,0.08)',
                        background: isSelected
                          ? 'rgba(56, 189, 248, 0.2)'
                          : 'rgba(18, 30, 53, 0.5)',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isCrit ? '#ef4444' : '#f59e0b',
                      }} />
                      {w.ward_name.replace('Puri Ward ', 'W-')}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />
              <div style={{ height: 90, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />
            </div>
          )}

          {/* Risk Breakdown Panel */}
          {ward && (
            <RiskPanel
              ward={ward}
              onGenerateAdvisory={() => advisoryMutation.mutate()}
              isGenerating={advisoryMutation.isPending}
            />
          )}
        </aside>

        {/* ── Center: Interactive MapView ────────────────────────────── */}
        <main style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
          <MapView ward={ward ?? null} onWardSelect={setSelectedWard} />

          {/* Tactical Map Overlay Header */}
          <div style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            background: 'rgba(8, 13, 26, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '6px',
            padding: '6px 12px',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: '#38bdf8',
          }}>
            <Layers size={13} />
            <span>GEO-RADAR: PURI COASTLINE [19.81° N, 85.83° E]</span>
          </div>

          {/* Map Layer Legend Overlay */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 10,
            background: 'rgba(8, 13, 26, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            padding: '8px 12px',
            backdropFilter: 'blur(8px)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Active Layers
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, background: '#ef4444', opacity: 0.8, borderRadius: 2 }} />
              <span style={{ color: '#e2e8f0' }}>Parametric Surge Inundation (&gt; 3.0m)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 10, background: '#f97316', opacity: 0.6, borderRadius: 2 }} />
              <span style={{ color: '#e2e8f0' }}>Rainfall Flash Flood / TWI Runoff</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏠</span>
              <span style={{ color: '#e2e8f0' }}>Designated Cyclone Shelters (OSDMA)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏥</span>
              <span style={{ color: '#e2e8f0' }}>Critical Health Facilities</span>
            </div>
          </div>
        </main>

        {/* ── Right Rail: Grounded Advisory & Trigger Artifact ────────── */}
        <aside style={{
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(10, 16, 29, 0.95)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: '16px',
        }}>
          {/* Advisory Preview / Dispatch */}
          {advisory && !showDispatch && (
            <AdvisoryPreview
              advisory={advisory}
              onDispatch={() => setShowDispatch(true)}
            />
          )}

          {advisory && showDispatch && (
            <DispatchControls
              advisory={advisory}
              onDispatched={(r) => {
                setDispatchResult(r)
                setShowDispatch(false)
              }}
            />
          )}

          {dispatchResult && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '11px',
              color: '#4ade80',
              fontFamily: 'var(--font-mono)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
                <CheckCircle2 size={14} />
                DISPATCH EXECUTED (HITL CONFIRMED)
              </div>
              <div>ID: {dispatchResult.advisory_id}</div>
              <div>Channels: CAP 1.2 XML, SMS, WhatsApp, PDF</div>
            </div>
          )}

          {!advisory && (
            <div style={{
              background: 'rgba(18, 30, 53, 0.6)',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '24px 16px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '12px',
            }}>
              <ShieldAlert size={28} style={{ color: '#38bdf8', margin: '0 auto 8px auto', opacity: 0.6 }} />
              <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>No Active Advisory Draft</div>
              <div>Click &ldquo;Generate AI Advisory&rdquo; on the left panel to trigger Gemini multimodal reasoning with numeric grounding validation.</div>
            </div>
          )}

          {/* Parametric Insurance Trigger Card */}
          <InsuranceTriggerPanel
            eventId={eventId}
            onEvaluate={() => triggerMutation.mutate()}
            isEvaluating={triggerMutation.isPending}
            evaluationResult={triggerMutation.data}
          />
        </aside>
      </div>
    </div>
  )
}
