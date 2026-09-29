import { useState } from 'react'
import type { AdvisoryOut } from '../api/client'
import { dispatchAdvisory } from '../api/client'

interface Props {
  advisory: AdvisoryOut
  onDispatched: (result: any) => void
}

const CHANNELS = [
  { id: 'sms',         label: '📱 SMS',          desc: 'Twilio sandbox' },
  { id: 'whatsapp',    label: '💬 WhatsApp',      desc: 'Meta Cloud API test' },
  { id: 'cap_xml',     label: '📡 CAP XML',       desc: 'Common Alerting Protocol 1.2' },
  { id: 'pdf',         label: '📄 PDF Report',    desc: 'Formal institutional record' },
]

export default function DispatchControls({ advisory, onDispatched }: Props) {
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['sms'])
  const [recipient,        setRecipient]         = useState('+15005550006')
  const [operatorId,       setOperatorId]         = useState('DEMO_OPERATOR')
  const [loading,          setLoading]            = useState(false)
  const [result,           setResult]             = useState<any>(null)
  const [confirmed,        setConfirmed]           = useState(false)

  const toggleChannel = (ch: string) => {
    setSelectedChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    )
  }

  const handleDispatch = async () => {
    if (!confirmed) {
      alert('Please confirm the dispatch. This will send the advisory to real (sandbox) channels.')
      return
    }
    setLoading(true)
    try {
      const res = await dispatchAdvisory(
        advisory.advisory_id,
        selectedChannels,
        [recipient],
        operatorId,
      )
      setResult(res)
      onDispatched(res)
    } catch (e: any) {
      setResult({ error: e?.response?.data?.detail ?? String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel-section fade-in" id="dispatch-controls">
      <div className="panel-label">Dispatch Controls — Human-in-the-Loop Gate</div>

      <div className="hitl-banner" style={{ marginBottom: 12 }}>
        <span>🔒</span>
        <span>No advisory leaves without your explicit confirmation below</span>
      </div>

      {/* Channel selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
          Select dispatch channels:
        </div>
        {CHANNELS.map(ch => (
          <label
            key={ch.id}
            id={`channel-${ch.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: selectedChannels.includes(ch.id)
                ? 'rgba(56,189,248,0.08)' : 'var(--color-surface-2)',
              border: `1px solid ${selectedChannels.includes(ch.id) ? 'var(--color-border-accent)' : 'var(--color-border)'}`,
            }}
          >
            <input
              type="checkbox"
              checked={selectedChannels.includes(ch.id)}
              onChange={() => toggleChannel(ch.id)}
              style={{ accentColor: 'var(--color-sky)' }}
            />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{ch.label}</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{ch.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Recipient */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Recipient (sandbox number / test):
        </div>
        <input
          id="input-recipient"
          type="text"
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          style={{
            width: '100%', padding: '6px 10px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)', fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        />
      </div>

      {/* Operator ID */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
          Operator ID:
        </div>
        <input
          id="input-operator-id"
          type="text"
          value={operatorId}
          onChange={e => setOperatorId(e.target.value)}
          style={{
            width: '100%', padding: '6px 10px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)', fontSize: 12,
          }}
        />
      </div>

      {/* Confirmation */}
      <label
        id="confirm-dispatch-checkbox"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 12, cursor: 'pointer',
          fontSize: 11, color: confirmed ? 'var(--color-warning)' : 'var(--color-text-muted)',
        }}
      >
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          style={{ accentColor: 'var(--color-warning)' }}
        />
        I confirm this advisory has been reviewed and is ready for dispatch.
        I understand this will send to sandbox channels.
      </label>

      <button
        id="btn-confirm-dispatch"
        className={`btn ${confirmed ? 'btn-danger' : 'btn-ghost'}`}
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={handleDispatch}
        disabled={!confirmed || loading || selectedChannels.length === 0}
      >
        {loading ? '⏳ Dispatching…' : `🚨 Dispatch via ${selectedChannels.length} channel(s)`}
      </button>

      {result && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: result.error ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
          border: `1px solid ${result.error ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          borderRadius: 'var(--radius-sm)', fontSize: 11,
          color: result.error ? 'var(--color-evacuation)' : 'var(--color-safe)',
          fontFamily: 'var(--font-mono)',
        }}>
          {result.error ? (
            <div>🚨 Error: {result.error}</div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#22c55e' }}>
                ✓ Dispatch record #{result.attempt_id?.slice(0, 8) || result.advisory_id?.slice(0, 8) || 'D-REC'}
              </div>
              <div style={{ color: 'var(--color-text)', display: 'grid', gridTemplateColumns: '80px 1fr', gap: '2px 8px', fontSize: 10 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Actor:</span>
                <span>{operatorId} (ddma_operator)</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Time:</span>
                <span>{new Date().toISOString()}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Event:</span>
                <span>{advisory.event_id || 'BOB07-2026'}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Channels:</span>
                <span>
                  {selectedChannels.map(c => `${c.toUpperCase()} (${result.status === 'failed' ? 'failed ✗' : 'sent ✓'})`).join(' · ')}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
