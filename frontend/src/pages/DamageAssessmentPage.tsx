/**
 * frontend/src/pages/DamageAssessmentPage.tsx
 * Post-event damage assessment — pre/post imagery comparison + validation records.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface ValidationRecord {
  record_id: string;
  event_id: string;
  asset_id: string;
  asset_class: string;
  predicted_damage_state: string;
  observed_damage_state: string;
  match: boolean;
  model_under_predicted: boolean;
  observation_confidence: string;
  observation_caveat: string;
  predicted_safety_factor: number;
  human_confirmed: boolean;
  notes: string[];
}

const DS_COLOR: Record<string, string> = {
  none: 'var(--ds-none)', minor: 'var(--ds-minor)',
  moderate: 'var(--ds-moderate)', severe: 'var(--ds-severe)', collapse: 'var(--ds-collapse)',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'var(--color-success)', medium: 'var(--color-warning)', low: 'var(--color-danger)',
};

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)', border: '1px solid var(--border-subtle)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function DamageAssessmentPage() {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState('FANI-2019');
  const [districtId, setDistrictId] = useState('IN-OD-PURI');
  const [landfallDate, setLandfallDate] = useState('2019-05-03');

  const { data: records, isLoading, isError, error } = useQuery<ValidationRecord[]>({
    queryKey: ['damage-assessment', eventId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/damage-assessment/${encodeURIComponent(eventId)}`);
      return res.data;
    },
    retry: false,
    enabled: true,
  });

  const { data: summary } = useQuery({
    queryKey: ['damage-summary', eventId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/damage-assessment/${encodeURIComponent(eventId)}/summary`);
      return res.data;
    },
    enabled: !!records && records.length > 0,
  });

  const runAssessment = useMutation({
    mutationFn: async () => {
      await axios.post(`${API_BASE}/damage-assessment/${encodeURIComponent(eventId)}/run`, {
        district_id: districtId,
        landfall_date: landfallDate,
      });
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['damage-assessment', eventId] });
        queryClient.invalidateQueries({ queryKey: ['damage-summary', eventId] });
      }, 3000);
    },
  });

  const matchCount = records?.filter((r) => r.match).length ?? 0;
  const underPredCount = records?.filter((r) => r.model_under_predicted).length ?? 0;

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow-primary)',
        }}>
          <Camera size={20} style={{ color: 'white' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
            Rapid Post-Event Damage Assessment
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Gemini Vision pre/post imagery comparison · Human review required
          </p>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)', padding: 'var(--space-4) var(--space-5)',
        display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end',
        marginBottom: 'var(--space-5)',
      }}>
        {[
          { label: 'Event ID', value: eventId, set: setEventId, type: 'text' },
          { label: 'District', value: districtId, set: setDistrictId, type: 'text' },
          { label: 'Landfall Date', value: landfallDate, set: setLandfallDate, type: 'date' },
        ].map(({ label, value, set, type }) => (
          <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</span>
            <input
              type={type}
              value={value}
              onChange={(e) => set(e.target.value)}
              style={{
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)',
              }}
            />
          </label>
        ))}

        <button
          id="damage-assess-btn"
          onClick={() => runAssessment.mutate()}
          disabled={runAssessment.isPending}
          style={{
            background: 'var(--color-primary)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-4)', fontWeight: 600,
            fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <RefreshCw size={14} style={{ animation: runAssessment.isPending ? 'spin 1s linear infinite' : 'none' }} />
          Run Assessment
        </button>
      </div>

      {/* Stats */}
      {records && records.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <StatCard label="Total Records" value={records.length} />
          <StatCard label="Match Rate" value={`${Math.round(matchCount / records.length * 100)}%`} color="var(--color-success)" />
          <StatCard label="Under-Predicted" value={underPredCount} color={underPredCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)'} />
          <StatCard label="Unconfirmed" value={records.filter((r) => !r.human_confirmed).length} color="var(--color-warning)" />
        </div>
      )}

      {summary?.recalibration_recommended && (
        <div style={{
          background: 'var(--color-danger-muted)', borderLeft: '3px solid var(--color-danger)',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
          fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          <AlertTriangle size={16} />
          <strong>Model Recalibration Recommended:</strong> {summary.note}
        </div>
      )}

      {/* Loading/error states */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)' }}>
          Loading validation records…
        </div>
      )}

      {runAssessment.isPending && (
        <div style={{
          background: 'var(--color-primary-muted)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)', color: 'var(--color-primary)', textAlign: 'center', marginBottom: 'var(--space-4)',
        }}>
          🛰 Assessment running in background (fetching imagery + Gemini analysis)…
        </div>
      )}

      {/* Records table */}
      {records && records.length > 0 && (
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-overlay)', borderBottom: '1px solid var(--border-default)' }}>
                {['Asset', 'Predicted DS', 'Observed DS', 'Match', 'Confidence', 'Confirmed'].map((h) => (
                  <th key={h} style={{
                    padding: 'var(--space-3)', fontSize: 'var(--text-xs)', fontWeight: 600,
                    color: 'var(--text-muted)', textAlign: 'left',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.record_id} style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: r.model_under_predicted ? 'hsla(0, 50%, 8%, 0.5)' : 'transparent',
                }}>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{r.asset_id}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{r.asset_class.replace(/_/g, ' ')}</div>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ color: DS_COLOR[r.predicted_damage_state] ?? 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {r.predicted_damage_state}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ color: DS_COLOR[r.observed_damage_state] ?? 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {r.observed_damage_state}
                    </span>
                    {r.model_under_predicted && (
                      <span style={{ marginLeft: 6, fontSize: '10px', color: 'var(--color-danger)', fontWeight: 700 }}>⚠ UNDER-PRED</span>
                    )}
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    {r.match
                      ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                      : <XCircle size={16} style={{ color: 'var(--color-danger)' }} />}
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    <span style={{ color: CONFIDENCE_COLOR[r.observation_confidence] ?? 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize', fontSize: 'var(--text-xs)' }}>
                      {r.observation_confidence}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3)' }}>
                    {r.human_confirmed
                      ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                      : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {records?.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)' }}>
          No validation records yet. Click "Run Assessment" to start.
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
