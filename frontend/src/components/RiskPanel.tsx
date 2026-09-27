import type { WardRisk } from '../api/client'

interface Props {
  ward: WardRisk
  onGenerateAdvisory: () => void
  isGenerating: boolean
}

const ASSET_ICONS: Record<string, string> = {
  shelter:    '🏠',
  hospital:   '🏥',
  road:       '🛣️',
  power_line: '🔌',
  substation: '⚡',
}

export default function RiskPanel({ ward, onGenerateAdvisory, isGenerating }: Props) {
  const severityClass = ward.severity_tier === 'Evacuation Order'
    ? 'evacuation'
    : ward.severity_tier.toLowerCase()

  return (
    <>
      <div className="panel-section fade-in">
        <div className="panel-label">Ward-Level Risk — {ward.ward_name}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className={`severity-badge ${severityClass}`} id="severity-ward-badge">
            {ward.severity_tier}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Pop. {ward.population.toLocaleString()}
          </span>
        </div>

        <div className="metrics-grid">
          <div className="metric-card" id="metric-surge">
            <div className="metric-label">Storm Surge</div>
            <div className="metric-value">
              {ward.surge_height_m.toFixed(1)}
              <span className="metric-unit"> m</span>
            </div>
          </div>

          <div className="metric-card" id="metric-rainfall">
            <div className="metric-label">Rainfall 48h</div>
            <div className="metric-value">
              {ward.rainfall_mm_48h.toFixed(0)}
              <span className="metric-unit"> mm</span>
            </div>
          </div>

          <div className="metric-card" id="metric-wind">
            <div className="metric-label">Wind Speed</div>
            <div className="metric-value">
              {ward.wind_speed_kmh.toFixed(0)}
              <span className="metric-unit"> km/h</span>
            </div>
          </div>

          <div className="metric-card" id="metric-runoff">
            <div className="metric-label">Runoff Risk</div>
            <div className="metric-value">
              {Math.round(ward.runoff_risk_score * 100)}
              <span className="metric-unit"> %</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Flagged infrastructure ───────────────────────── */}
      {ward.flagged_assets.length > 0 && (
        <div className="panel-section fade-in">
          <div className="panel-label">
            Flagged Infrastructure ({ward.flagged_assets.length})
          </div>

          {ward.flagged_assets.map((asset) => {
            const isCritical = asset.flag_reason.includes('CRITICAL')
            return (
              <div
                key={asset.asset_id}
                className={`asset-flag ${isCritical ? 'critical' : ''}`}
                id={`asset-flag-${asset.asset_id}`}
              >
                <div className="asset-icon">
                  {ASSET_ICONS[asset.type] ?? '📍'}
                </div>
                <div>
                  <div className="asset-name">{asset.name}</div>
                  <div className="asset-reason">{asset.flag_reason}</div>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    Priority: {(asset.priority_score * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Generate advisory button ─────────────────── */}
      <div className="panel-section">
        <div className="hitl-banner" style={{ marginBottom: 10 }}>
          <span>⚠️</span>
          Human review required before dispatch
        </div>

        <button
          id="btn-generate-advisory"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={onGenerateAdvisory}
          disabled={isGenerating}
        >
          {isGenerating ? '⏳ Generating with Gemini…' : '✨ Generate AI Advisory'}
        </button>
      </div>
    </>
  )
}
