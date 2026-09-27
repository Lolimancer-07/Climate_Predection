import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MapView from './components/MapView'
import RiskPanel from './components/RiskPanel'
import AdvisoryPreview from './components/AdvisoryPreview'
import InsuranceTriggerPanel from './components/InsuranceTriggerPanel'
import {
  fetchDistrictRisk, evaluateTriggers, generateAdvisory,
  type DistrictRisk, type AdvisoryOut,
} from './api/client'

const DEMO_DISTRICT = 'IN-OD-PURI'
const DEMO_EVENT    = 'CYCLONE-FANI-2019'

export default function App() {
  const [selectedWard, setSelectedWard]   = useState<string | null>(null)
  const [advisory, setAdvisory]           = useState<AdvisoryOut | null>(null)
  const [showDispatch, setShowDispatch]   = useState(false)
  const queryClient = useQueryClient()

  // ── Fetch risk data ────────────────────────────────────────
  const { data: risk, isLoading } = useQuery<DistrictRisk>({
    queryKey: ['district-risk', DEMO_DISTRICT],
    queryFn: () => fetchDistrictRisk(DEMO_DISTRICT),
    staleTime: 60_000,
  })

  const ward = risk?.wards.find(w => w.ward_id === (selectedWard ?? risk.wards[0]?.ward_id))

  // ── Evaluate triggers ──────────────────────────────────────
  const triggerMutation = useMutation({
    mutationFn: () => evaluateTriggers(DEMO_EVENT, {
      surge_height: ward?.surge_height_m ?? 0,
      rainfall_total: ward?.rainfall_mm_48h ?? 0,
      wind_speed: ward?.wind_speed_kmh ?? 0,
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
    onSuccess: (data) => setAdvisory(data),
  })

  const severityClass = ward?.severity_tier.toLowerCase().replace(' ', '-') === 'evacuation order'
    ? 'evacuation'
    : ward?.severity_tier.toLowerCase() ?? 'watch'

  return (
    <div className="app-shell">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="app-header">
        <div className="logo-mark">🌀</div>
        <div>
          <div className="header-title">Cyclone Anticipatory Action Platform</div>
          <div className="header-subtitle">Bay of Bengal & Coastal APAC — AI-Powered Early Warning</div>
        </div>
        <div className="header-spacer" />

        {risk && (
          <span className={`severity-badge ${severityClass}`} id="severity-header-badge">
            {ward?.severity_tier ?? 'Loading…'}
          </span>
        )}

        <div className="live-badge">
          <div className="live-dot" />
          DEMO MODE — Cyclone Fani 2019
        </div>
      </header>

      {/* ── Left panel: Risk data ─────────────────────── */}
      <aside className="left-panel">
        <div className="panel-section">
          <div className="panel-label">Active Cyclone</div>
          <div className="cyclone-card active" id="cyclone-fani-card">
            <div className="cyclone-name">🌀 Cyclone Fani (2019)</div>
            <div className="cyclone-meta">
              ESCS · Landfall: Puri, Odisha · T-72h simulation
            </div>
          </div>
        </div>

        {ward && (
          <RiskPanel
            ward={ward}
            onGenerateAdvisory={() => advisoryMutation.mutate()}
            isGenerating={advisoryMutation.isPending}
          />
        )}

        {isLoading && (
          <div className="panel-section">
            <div className="loading" style={{ height: 120, borderRadius: 12 }} />
          </div>
        )}
      </aside>

      {/* ── Map ──────────────────────────────────────── */}
      <main className="map-container">
        <MapView
          ward={ward ?? null}
          onWardSelect={setSelectedWard}
        />
      </main>

      {/* ── Right panel: Advisory + Insurance ────────── */}
      <aside className="right-panel">
        {advisory && (
          <AdvisoryPreview
            advisory={advisory}
            onDispatch={() => setShowDispatch(true)}
          />
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
