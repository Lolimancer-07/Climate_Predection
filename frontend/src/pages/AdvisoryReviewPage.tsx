/**
 * frontend/src/pages/AdvisoryReviewPage.tsx
 *
 * Phase 3 — Human-in-the-Loop (HITL) Advisory Review & Secure Dispatch Console.
 *
 * Invariants & Gates:
 * 1. Server-side RBAC: require_permission("dispatch:advisory") (ddma_operator / admin).
 * 2. Scenario Immutability: Scenario-derived drafts (SIMULATED data) are rejected from review.
 * 3. Strict Numeric Grounding: Displays validator results; alerts if ungrounded claims detected.
 * 4. Two-step HITL Gate: Review/Approve is distinct from Dispatch.
 * 5. Full Audit Trail: Actor, time, run ID, and channel attempt statuses displayed.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStorm } from '../context/StormContext';
import { useRunContext } from '../hooks/useRunContext';
import {
  listAdvisoryDrafts,
  reviewAdvisoryDraft,
  dispatchAdvisoryDraft,
  AdvisoryDraft,
} from '../api/client';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Send,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Radio,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';

export function AdvisoryReviewPage() {
  const queryClient = useQueryClient();
  const { activeStorm, selectedDistrict } = useStorm();
  const stormId = activeStorm?.storm_id || 'BOB07-2026';
  const { run, activeRunId } = useRunContext(stormId);

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [operatorId, setOperatorId] = useState('DDMA-OFFICER-01');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Dispatch form state
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['sms', 'cap_xml']);
  const [recipient, setRecipient] = useState('+91-9437000000');
  const [dispatchConfirmed, setDispatchConfirmed] = useState(false);

  // Fetch drafts
  const { data: draftsData, isLoading } = useQuery({
    queryKey: ['advisories-list'],
    queryFn: () => listAdvisoryDrafts(),
    refetchInterval: 6000,
  });

  const drafts: AdvisoryDraft[] = draftsData?.drafts || [];

  // Pick selected draft or default to latest
  const activeDraft = drafts.find((d) => d.draft_id === selectedDraftId) || drafts[0] || null;

  // Sync edited text when draft changes
  React.useEffect(() => {
    if (activeDraft) {
      setEditedText(activeDraft.draft_text);
    }
  }, [activeDraft?.draft_id]);

  // Review mutation (Approve / Reject / Edit)
  const reviewMutation = useMutation({
    mutationFn: (payload: { decision: string; edited_text?: string; reason?: string }) =>
      reviewAdvisoryDraft(activeDraft!.draft_id, {
        decision: payload.decision,
        actor_id: operatorId,
        edited_text: payload.edited_text,
        reason: payload.reason,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['advisories-list'] });
      setIsEditing(false);
      setShowRejectModal(false);
      toast.success(`Advisory ${data.decision.toUpperCase()} recorded by ${operatorId}`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message;
      toast.error(`Review action failed: ${msg}`);
    },
  });

  // Dispatch mutation
  const dispatchMutation = useMutation({
    mutationFn: () =>
      dispatchAdvisoryDraft(activeDraft!.draft_id, {
        channels: selectedChannels,
        recipients: [recipient],
        operator_id: operatorId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisories-list'] });
      setDispatchConfirmed(false);
      toast.success(`Advisory successfully dispatched via ${selectedChannels.join(', ')}`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message;
      toast.error(`Dispatch failed: ${msg}`);
    },
  });

  const toggleChannel = (ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const evidence = activeDraft?.evidence_json || {};
  const surgeM = evidence.surge_result?.max_surge_height_m ?? 2.5;
  const floodRisk = evidence.flood_result?.flash_flood_risk_score ?? 0.65;
  const triggerFired = evidence.trigger_result?.triggered ?? false;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Advisories &amp; Human-in-the-Loop Review
            </h1>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'monospace',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(56,189,248,0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56,189,248,0.3)',
              }}
            >
              HITL GATE ENFORCED
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0 0' }}>
            All public warning bulletins and OASIS CAP 1.2 feeds require explicit authorized verification.
            AI models draft; operators decide.
          </p>
        </div>

        {/* Operator Profile Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(30,41,59,0.7)',
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <User size={14} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Operator:</span>
          <input
            type="text"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontWeight: 600,
              fontSize: 12,
              fontFamily: 'monospace',
              width: 130,
            }}
          />
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* Left: Draft Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Draft Queue ({drafts.length})
          </div>

          {isLoading && drafts.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
              Loading drafts…
            </div>
          )}

          {!isLoading && drafts.length === 0 && (
            <div
              style={{
                background: 'rgba(30,41,59,0.4)',
                border: '1px dashed rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '24px 16px',
                textAlign: 'center',
              }}
            >
              <FileText size={24} style={{ color: '#64748b', margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>No Drafts Queued</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Run pipeline for {stormId} to generate a grounded draft.
              </div>
            </div>
          )}

          {drafts.map((d) => {
            const isSelected = d.draft_id === activeDraft?.draft_id;
            const statusColors: Record<string, string> = {
              pending: '#eab308',
              approved: '#22c55e',
              rejected: '#ef4444',
              dispatched: '#38bdf8',
            };
            const col = statusColors[d.status] || '#94a3b8';

            return (
              <div
                key={d.draft_id}
                onClick={() => setSelectedDraftId(d.draft_id)}
                style={{
                  background: isSelected ? 'rgba(30,41,59,0.9)' : 'rgba(15,23,42,0.6)',
                  border: `1px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>
                    {d.event_id} · {d.district_id}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: `${col}18`,
                      color: col,
                      border: `1px solid ${col}44`,
                      textTransform: 'uppercase',
                    }}
                  >
                    {d.status}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: '#e2e8f0', lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {d.draft_text}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#64748b' }}>
                  <span>{new Date(d.created_at).toLocaleTimeString()}</span>
                  {d.is_scenario && (
                    <span style={{ color: '#eab308', fontWeight: 600 }}>SIMULATED</span>
                  )}
                  {d.grounding_passed ? (
                    <span style={{ color: '#22c55e' }}>● Grounded</span>
                  ) : (
                    <span style={{ color: '#ef4444' }}>⚠ Grounding Alert</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Active Draft Inspection & Controls */}
        {activeDraft ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Simulation Warning Banner if scenario */}
            {activeDraft.is_scenario && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(234,179,8,0.12)',
                  border: '1px solid rgba(234,179,8,0.4)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#fef08a',
                  fontSize: 12,
                }}
              >
                <AlertTriangle size={18} style={{ color: '#eab308', flexShrink: 0 }} />
                <div>
                  <strong>SIMULATED DATASET (SCENARIO OUTPUT):</strong> This draft was generated from counterfactual scenario parameters.
                  In accordance with disaster safety invariants, scenario-derived advisories cannot enter the review queue or be dispatched.
                </div>
              </div>
            )}

            {/* Grounding Verification Card */}
            <div
              style={{
                background: activeDraft.grounding_passed ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${activeDraft.grounding_passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.4)'}`,
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              {activeDraft.grounding_passed ? (
                <ShieldCheck size={20} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
              ) : (
                <ShieldAlert size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: activeDraft.grounding_passed ? '#22c55e' : '#ef4444' }}>
                  {activeDraft.grounding_passed
                    ? 'Strict Numeric Grounding Verified'
                    : 'Grounding Alert — Numeric Discrepancies Detected'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {activeDraft.grounding_passed
                    ? 'All hazard quantities (surge height, wind speed, precipitation) in draft match physical model output without hallucination.'
                    : 'The generated text contains numbers that diverge from structured model outputs. Operator review required before approval.'}
                </div>
                {activeDraft.grounding_failures && activeDraft.grounding_failures.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#fca5a5', fontFamily: 'monospace' }}>
                    {activeDraft.grounding_failures.map((f, i) => (
                      <div key={i}>• {f}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Numeric Evidence Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '12px 14px',
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Surge Height</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                  {surgeM.toFixed(2)} m
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>Threshold: 2.0 m</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Runoff Risk</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#eab308', fontFamily: 'monospace' }}>
                  {(floodRisk * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>TWI Score</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Trigger Status</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: triggerFired ? '#a855f7' : '#22c55e', fontFamily: 'monospace' }}>
                  {triggerFired ? 'FIRED' : 'NORMAL'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>Parametric</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Run Reference</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeDraft.run_id ? activeDraft.run_id.slice(0, 10) + '…' : 'N/A'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>Audit bound</div>
              </div>
            </div>

            {/* Draft Content Panel */}
            <div
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
                  Advisory Text (ID: {activeDraft.draft_id})
                </span>
                {!activeDraft.is_scenario && activeDraft.status === 'pending' && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#94a3b8',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={12} />
                    {isEditing ? 'Cancel Edit' : 'Edit Draft'}
                  </button>
                )}
              </div>

              {isEditing ? (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%',
                    background: 'rgba(8,13,26,0.9)',
                    border: '1px solid #38bdf8',
                    borderRadius: 6,
                    padding: 12,
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.6,
                    resize: 'vertical',
                  }}
                />
              ) : (
                <div
                  style={{
                    background: 'rgba(8,13,26,0.5)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: 6,
                    padding: 14,
                    color: '#e2e8f0',
                    fontSize: 12,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                  }}
                >
                  {activeDraft.draft_text}
                </div>
              )}

              {/* Review Actions (Pending State) */}
              {activeDraft.status === 'pending' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                  <button
                    disabled={activeDraft.is_scenario || reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({
                        decision: isEditing ? 'edited' : 'approved',
                        edited_text: isEditing ? editedText : undefined,
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: activeDraft.is_scenario
                        ? '#334155'
                        : 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: 'white',
                      border: 'none',
                      padding: '8px 18px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: activeDraft.is_scenario ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <CheckCircle size={14} />
                    {isEditing ? 'Save & Approve Edited' : 'Approve Draft'}
                  </button>

                  <button
                    disabled={activeDraft.is_scenario || reviewMutation.isPending}
                    onClick={() => setShowRejectModal(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#ef4444',
                      padding: '8px 16px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: activeDraft.is_scenario ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <XCircle size={14} />
                    Reject Draft
                  </button>
                </div>
              )}

              {/* Latest Review Info if already approved/rejected */}
              {activeDraft.latest_review && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.03)',
                    fontSize: 11,
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span>
                    Reviewed by: <strong>{activeDraft.latest_review.actor_id}</strong> ({activeDraft.latest_review.actor_role})
                  </span>
                  <span>•</span>
                  <span>Decision: <strong>{activeDraft.latest_review.decision}</strong></span>
                  <span>•</span>
                  <span>{new Date(activeDraft.latest_review.reviewed_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Dispatch Gate Section (Visible once Approved) */}
            {activeDraft.status === 'approved' && (
              <div
                style={{
                  background: 'rgba(15,23,42,0.85)',
                  border: '1px solid rgba(56,189,248,0.3)',
                  borderRadius: 8,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Send size={16} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                    Multi-Channel Dispatch Execution
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { id: 'sms', label: 'SMS Sandbox', desc: 'Twilio Gateway' },
                    { id: 'whatsapp', label: 'WhatsApp API', desc: 'Meta Business Cloud' },
                    { id: 'cap_xml', label: 'CAP 1.2 XML', desc: 'NDMA SACHET Feed' },
                    { id: 'pdf', label: 'PDF Dispatch', desc: 'Institutional Archive' },
                  ].map((ch) => (
                    <label
                      key={ch.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: selectedChannels.includes(ch.id)
                          ? 'rgba(56,189,248,0.1)'
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selectedChannels.includes(ch.id) ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selectedChannels.includes(ch.id)}
                          onChange={() => toggleChannel(ch.id)}
                        />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{ch.label}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{ch.desc}</span>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Recipient Gateway:</div>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(8,13,26,0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        color: '#f8fafc',
                        fontFamily: 'monospace',
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 14,
                    fontSize: 11,
                    color: dispatchConfirmed ? '#f59e0b' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dispatchConfirmed}
                    onChange={(e) => setDispatchConfirmed(e.target.checked)}
                  />
                  I certify that I have verified all numerical facts, and authorize broadcast to selected emergency channels.
                </label>

                <button
                  disabled={!dispatchConfirmed || selectedChannels.length === 0 || dispatchMutation.isPending}
                  onClick={() => dispatchMutation.mutate()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: dispatchConfirmed ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#334155',
                    color: 'white',
                    border: 'none',
                    padding: '9px 20px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: dispatchConfirmed ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send size={13} />
                  {dispatchMutation.isPending ? 'Executing Dispatch…' : `Dispatch to ${selectedChannels.length} Channel(s)`}
                </button>
              </div>
            )}

            {/* Dispatch Audit Trail */}
            {activeDraft.dispatch_attempts && activeDraft.dispatch_attempts.length > 0 && (
              <div
                style={{
                  background: 'rgba(15,23,42,0.6)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase' }}>
                  Dispatch Audit Trail ({activeDraft.dispatch_attempts.length} attempts)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeDraft.dispatch_attempts.map((att, i) => (
                    <div
                      key={att.attempt_id || i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: 'monospace',
                      }}
                    >
                      <span style={{ color: '#38bdf8' }}>#{att.attempt_id?.slice(0, 8)}</span>
                      <span style={{ color: '#e2e8f0', textTransform: 'uppercase' }}>{att.channel}</span>
                      <span style={{ color: '#94a3b8' }}>{att.recipient_ref}</span>
                      <span
                        style={{
                          color: att.status === 'sent' || att.status === 'sandbox' ? '#22c55e' : '#ef4444',
                          fontWeight: 700,
                        }}
                      >
                        {att.status.toUpperCase()}
                      </span>
                      <span style={{ color: '#64748b' }}>{new Date(att.dispatched_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 8,
              padding: 24,
              maxWidth: 420,
              width: '90%',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#ef4444' }}>Reject Advisory Draft</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px 0' }}>
              Please state the reason for rejecting this advisory draft for the permanent audit trail.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Surge estimate requires recalibration against radar observations..."
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(8,13,26,0.9)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                padding: 10,
                color: '#f8fafc',
                fontSize: 12,
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#cbd5e1',
                  padding: '6px 14px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  reviewMutation.mutate({
                    decision: 'rejected',
                    reason: rejectReason,
                  })
                }
                style={{
                  background: '#ef4444',
                  border: 'none',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
