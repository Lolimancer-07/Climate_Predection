import { useQuery } from '@tanstack/react-query'
import { fetchTriggers, type TriggerRecord } from '../api/client'

interface Props {
  eventId: string
  onEvaluate: () => void
  isEvaluating: boolean
  evaluationResult: any
}

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  surge_height:          'Storm Surge Height',
  rainfall_total:        'Rainfall Total',
  wind_speed:            'Wind Speed',
  composite_loss_index:  'Composite Loss Index',
}

export default function InsuranceTriggerPanel({ eventId, onEvaluate, isEvaluating, evaluationResult }: Props) {
  const { data: triggers, isLoading } = useQuery<TriggerRecord[]>({
    queryKey: ['triggers', eventId],
    queryFn: () => fetchTriggers(eventId),
    enabled: !!evaluationResult,
    refetchInterval: evaluationResult ? 5000 : false,
  })

  const firedCount = triggers?.filter(t => t.triggered).length ?? 0

  return (
    <div className="panel-section fade-in" id="insurance-trigger-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div className="panel-label" style={{ marginBottom: 0 }}>Parametric Insurance Triggers</div>
        {firedCount > 0 && (
          <span className="severity-badge" style={{
            background: 'rgba(168,85,247,0.15)',
            color: 'var(--color-trigger-fired)',
            border: '1px solid rgba(168,85,247,0.3)',
          }}>
            {firedCount} FIRED
          </span>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <button
          id="btn-evaluate-triggers"
          className="btn btn-primary btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={onEvaluate}
          disabled={isEvaluating}
        >
          {isEvaluating ? '⏳ Evaluating…' : '🔍 Evaluate All Policies'}
        </button>
      </div>

      {!evaluationResult && !isLoading && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px 0' }}>
          Click "Evaluate All Policies" to check parametric trigger conditions against current hazard values.
        </div>
      )}

      {triggers && triggers.map((trigger) => (
        <div
          key={trigger.trigger_id}
          className={`trigger-row ${trigger.triggered ? 'fired' : ''}`}
          id={`trigger-${trigger.policy_id}`}
        >
          <div className={`trigger-dot ${trigger.triggered ? 'fired' : ''}`} />
          <div className="trigger-info">
            <div className="trigger-name">
              {TRIGGER_TYPE_LABELS[trigger.trigger_type] ?? trigger.trigger_type}
            </div>
            <div className="trigger-values">
              Threshold: {trigger.threshold_value} · Observed: {trigger.observed_value.toFixed(1)}
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 1 }}>
              {trigger.policy_id}
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: trigger.triggered ? 'var(--color-trigger-fired)' : 'var(--color-text-muted)' }}>
            {trigger.triggered ? '⚡ FIRED' : '—'}
          </div>
        </div>
      ))}

      {triggers && triggers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="hitl-banner">
            <span>🔒</span>
            <span>Trigger dispatch requires explicit operator confirmation</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            Trigger logic: deterministic only — no LLM involvement in financial decisions
          </div>
        </div>
      )}
    </div>
  )
}
