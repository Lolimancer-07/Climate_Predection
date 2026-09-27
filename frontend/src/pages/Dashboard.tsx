import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MapView from '../components/MapView'
import RiskPanel from '../components/RiskPanel'
import AdvisoryPreview from '../components/AdvisoryPreview'
import DispatchControls from '../components/DispatchControls'
import InsuranceTriggerPanel from '../components/InsuranceTriggerPanel'
import {
  fetchDistrictRisk, evaluateTriggers, generateAdvisory,
  type DistrictRisk, type AdvisoryOut,
} from '../api/client'

const DEMO_DISTRICT = 'IN-OD-PURI'
const DEMO_EVENT    = 'CYCLONE-FANI-2019'

export default function Dashboard() {
  const [selectedWard,   setSelectedWard]   = useState<string | null>(null)
  const [advisory,       setAdvisory]       = useState<AdvisoryOut | null>(null)
  const [showDispatch,   setShowDispatch]   = useState(false)
  const [dispatchResult, setDispatchResult] = useState<any>(null)
  const queryClient = useQueryClient()

  // ── Fetch risk data ────────────────────────────────────────
  const { data: risk, isLoading } = useQuery<DistrictRisk>({
    queryKey: ['district-risk', DEMO_DISTRICT],
    queryFn: () => fetchDistrictRisk(DEMO_DISTRICT),
    staleTime: 60_000,
  })

  const ward = risk?.wards.find(
    w => w.ward_id === (selectedWard ?? risk.wards[0]?.ward_id)
  )

  // ── Evaluate triggers ──────────────────────────────────────
  const triggerMutation = useMutation({
    mutationFn: () => evaluateTriggers(DEMO_EVENT, {
      surge_height:   ward?.surge_height_m ?? 0,
      rainfall_total: ward?.rainfall_mm_48h ?? 0,
      wind_speed:     ward?.wind_speed_kmh ?? 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triggers', DEMO_EVENT] })
    },
  })

  // ── Generate advisory ──────────────────────────────────────
  const advisoryMutation = useMutation({
    mutationFn: () => generateAdvisory(
      ward!.ward_id,
      DEMO_EVENT,
      ward!.severity_tier,
      ward as unknown as object,
    ),
    onSuccess: (data) => {
      setAdvisory(data)
      setShowDispatch(false)
    },
  })

  const severityClass = (ward?.severity_tier ?? 'watch')
    .toLowerCase().replace(' ', '-') === 'evacuation-order'
    ? 'evacuation'
    : (ward?.severity_tier ?? 'watch').toLowerCase().replace(' ', '-')

  return (
    <div className="app-shell">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="app-header">
        <div className="logo-mark">🌀</div>
        <div>
          <div className="header-title">Cyclone Anticipatory Action Platform</div>
          <div className="header-subtitle">
            Bay of Bengal &amp; Coastal APAC — AI-Powered Early Warning &amp; Parametric Insurance
          </div>
        </div>

        <div className="header-spacer" />

        {risk && (
          <>
            <span className={`severity-badge ${severityClass}`} id="header-severity-badge">
              {ward?.severity_tier ?? '…'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {risk.cyclone_name} · {risk.cyclone_category}
            </span>
          </>
        )}

        <div className="live-badge">
          <div className="live-dot" />
          DEMO — Cyclone Fani 2019 · T-72h
        </div>
      </header>

      {/* ── Left panel ────────────────────────────────── */}
      <aside className="left-panel">
        <div className="panel-section">
          <div className="panel-label">Active Cyclone</div>
          <div className="cyclone-card active" id="cyclone-card-fani">
            <div className="cyclone-name">🌀 Cyclone Fani (2019)</div>
            <div className="cyclone-meta">
              ESCS · Bay of Bengal · Landfall: Puri, Odisha
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Event ID: CYCLONE-FANI-2019
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="panel-section">
            <div className="loading" style={{ height: 140, borderRadius: 12 }} />
            <div className="loading" style={{ height: 80, borderRadius: 12, marginTop: 8 }} />
          </div>
        )}

        {ward && (
          <RiskPanel
            ward={ward}
            onGenerateAdvisory={() => advisoryMutation.mutate()}
            isGenerating={advisoryMutation.isPending}
          />
        )}
      </aside>

      {/* ── Map ───────────────────────────────────────── */}
      <main className="map-container">
        <MapView ward={ward ?? null} onWardSelect={setSelectedWard} />
      </main>

      {/* ── Right panel ───────────────────────────────── */}
      <aside className="right-panel">
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
          <div className="panel-section fade-in">
            <div className="panel-label">Dispatch Result</div>
            <div style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: 11,
              color: 'var(--color-safe)',
              fontFamily: 'var(--font-mono)',
            }}>
              ✅ Advisory dispatched successfully.<br />
              ID: {dispatchResult.advisory_id}
            </div>
          </div>
        )}

        {!advisory && (
          <div className="panel-section" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11, padding: 32 }}>
            Generate an AI advisory from the left panel to see it here.
          </div>
        )}

        <InsuranceTriggerPanel
          eventId={DEMO_EVENT}
          onEvaluate={() => triggerMutation.mutate()}
          isEvaluating={triggerMutation.isPending}
          evaluationResult={triggerMutation.data}
        />
      </aside>
    </div>
  )
}
