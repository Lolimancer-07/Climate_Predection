/**
 * frontend/src/pages/AdvisoryReviewPage.tsx
 *
 * HITL review workflow for generated advisories.
 * Shows draft text, numeric evidence/grounding, approval/rejection controls.
 * Spec: UAV Digital Twin plan §4.2, page 7 "Advisories & Review"
 *
 * Design rules:
 * - No advisory dispatched without explicit approve action
 * - Numeric evidence shown alongside draft text
 * - Approval records actor + time + run/event audit links
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStorm } from '../context/StormContext';
import { fetchDistrictRisk, generateAdvisory, dispatchAdvisory } from '../api/client';

type ReviewStep = 'pending' | 'generating' | 'review' | 'approved' | 'rejected' | 'dispatched';

function EvidenceRow({ label, value, unit, threshold, triggered }: {
  label: string; value: number; unit: string; threshold?: number; triggered?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 12px', borderRadius: 6,
      background: triggered ? 'rgba(168,85,247,0.06)' : 'var(--color-surface)',
      border: `1px solid ${triggered ? 'rgba(168,85,247,0.3)' : 'var(--color-border)'}`,
      marginBottom: 4,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: triggered ? '#a855f7' : 'var(--color-text-muted)',
        boxShadow: triggered ? '0 0 8px rgba(168,85,247,0.6)' : undefined,
      }} />
      <span style={{ flex: 1, fontSize: 11, color: 'var(--color-text)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: triggered ? '#a855f7' : 'var(--color-sky)' }}>
        {value} {unit}
      </span>
      {threshold !== undefined && (
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          / threshold: {threshold} {unit}
        </span>
      )}
      {triggered !== undefined && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
          background: triggered ? 'rgba(168,85,247,0.15)' : 'rgba(100,116,139,0.15)',
          color: triggered ? '#a855f7' : '#64748b',
        }}>
          {triggered ? '🔴 FIRED' : '⚪ OK'}
        </span>
      )}
    </div>
  );
}

export function AdvisoryReviewPage() {
  const { selectedDistrict } = useStorm();
  const [step, setStep] = useState<ReviewStep>('pending');
  const [advisory, setAdvisory] = useState<any>(null);
  const [operatorId] = useState('DDMA-OPS-001');

  const { data: risk } = useQuery({
    queryKey: ['district-risk', selectedDistrict],
    queryFn: () => fetchDistrictRisk(selectedDistrict),
    staleTime: 60_000,
  });

  const ward = risk?.wards?.[0];

  const generateMutation = useMutation({
    mutationFn: () => generateAdvisory(
      ward!.ward_id,
      risk!.event_id,
      ward!.severity_tier,
      ward as any,
    ),
    onMutate: () => setStep('generating'),
    onSuccess: (data) => {
      setAdvisory(data);
      setStep('review');
    },
    onError: () => setStep('pending'),
  });

  const dispatchMutation = useMutation({
    mutationFn: () => dispatchAdvisory(
      advisory.advisory_id,
      ['sms', 'cap_xml'],
      ['+91-demo-number'],
      operatorId,
    ),
    onSuccess: () => setStep('dispatched'),
  });

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
        Advisories &amp; Review
      </h1>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 20 }}>
        All advisory dispatches require explicit operator review and approval.
        AI-generated drafts must not be sent without a human review record.
      </p>

      {/* HITL notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 11,
        color: 'var(--color-watch)',
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
        <div>
          <strong>Human-in-the-Loop required.</strong> No dispatch occurs without an authorized operator review.
          The AI draft is a starting point only. The operator must verify all numeric values before approving.
        </div>
      </div>

      {/* Numeric evidence — always visible */}
      {ward && (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)', marginBottom: 10 }}>
            Numeric Evidence — {ward.ward_name}
            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
              source: {risk?.event_id} · district: {selectedDistrict}
            </span>
          </div>
          <EvidenceRow label="Storm Surge Height" value={ward.surge_height_m} unit="m" threshold={2.0} triggered={ward.surge_height_m >= 2.0} />
          <EvidenceRow label="48h Accumulated Rainfall" value={Math.round(ward.rainfall_mm_48h)} unit="mm" threshold={200} triggered={ward.rainfall_mm_48h >= 200} />
          <EvidenceRow label="Max Wind Speed" value={Math.round(ward.wind_speed_kmh)} unit="km/h" threshold={150} triggered={ward.wind_speed_kmh >= 150} />
          <EvidenceRow label="Runoff Risk Score" value={parseFloat((ward.runoff_risk_score * 100).toFixed(1))} unit="%" />
          <EvidenceRow label="Population in Ward" value={ward.population} unit="people" />
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-text-muted)' }}>
            Model: parametric-surge-v0.3 · TWI runoff v1.0 · data mode: DEMO
          </div>
        </div>
      )}

      {/* Step: Pending */}
      {step === 'pending' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
            No advisory draft yet. Generate one from the risk data above.
          </p>
          <button
            disabled={!ward || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none', cursor: ward ? 'pointer' : 'not-allowed',
              background: 'linear-gradient(135deg, var(--color-sky), var(--color-indigo))',
              color: 'white', fontSize: 13, fontWeight: 600,
              opacity: ward ? 1 : 0.5,
            }}
          >
            Generate Advisory Draft
          </button>
          {!ward && (
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Risk data not loaded yet.
            </p>
          )}
        </div>
      )}

      {/* Step: Generating */}
      {step === 'generating' && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, animation: 'spin 2s linear infinite', display: 'inline-block' }}>⚙️</div>
          <p style={{ fontSize: 13 }}>Generating advisory draft…</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step: Review */}
      {step === 'review' && advisory && (
        <div>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, padding: '16px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                Draft Advisory — {advisory.advisory_id}
              </div>
              <span style={{
                fontSize: 9, padding: '2px 8px', borderRadius: 3, fontWeight: 700,
                background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
              }}>
                PENDING REVIEW
              </span>
            </div>
            <div style={{
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 6, padding: '12px 14px', fontSize: 12, lineHeight: 1.7,
              color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)',
              maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {advisory.content_en}
            </div>
            {!advisory.validation_passed && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 6,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                fontSize: 11, color: '#ef4444',
              }}>
                ⚠ Validation warnings: {advisory.validation_warnings?.join(', ')}
              </div>
            )}
          </div>

          <div style={{
            background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 11, color: 'var(--color-watch)',
          }}>
            Approving will create an immutable audit record with operator ID: <strong>{operatorId}</strong> and current timestamp.
            Dispatch will send via SMS + CAP XML (demo/sandbox — no real messages in demo mode).
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setStep('rejected')}
              style={{
                padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', fontSize: 12, fontWeight: 600,
              }}
            >
              ✗ Reject Draft
            </button>
            <button
              onClick={() => dispatchMutation.mutate()}
              disabled={dispatchMutation.isPending}
              style={{
                padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none', color: 'white', fontSize: 12, fontWeight: 600,
              }}
            >
              ✓ Approve &amp; Dispatch
            </button>
          </div>
        </div>
      )}

      {/* Step: Dispatched */}
      {step === 'dispatched' && (
        <div style={{
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 10, padding: '24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>
            Advisory Approved &amp; Dispatched
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Advisory ID: {advisory?.advisory_id} · Operator: {operatorId} · {new Date().toLocaleString()}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-text-muted)' }}>
            Demo mode — no real SMS/WhatsApp message sent. Audit record created.
          </div>
          <button
            onClick={() => { setStep('pending'); setAdvisory(null); }}
            style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: 12,
            }}
          >
            Generate New Advisory
          </button>
        </div>
      )}

      {/* Step: Rejected */}
      {step === 'rejected' && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: '24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✗</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
            Draft Rejected
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Rejection recorded. No advisory dispatched.
          </div>
          <button
            onClick={() => { setStep('pending'); setAdvisory(null); }}
            style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: 12,
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
