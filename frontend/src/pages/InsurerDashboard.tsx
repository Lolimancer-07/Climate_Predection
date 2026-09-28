/**
 * frontend/src/pages/InsurerDashboard.tsx
 * Insurer-facing dashboard — trigger status, audit trail, payout summary.
 * Role-gated to insurer_viewer and admin only.
 * No citizen contact data is shown.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { DollarSign, ShieldCheck, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { RoleGate } from '../components/RoleGate';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

// Demo trigger data (maps to real /insurance endpoint when live)
const DEMO_TRIGGER = {
  event_id: 'FANI-2019',
  district_id: 'IN-OD-PURI',
  triggered: true,
  trigger_timestamp: '2019-05-02T20:31:00Z',
  surge_height_m: 3.84,
  wind_speed_kmh: 250.0,
  rainfall_72h_mm: 312.5,
  payout_usd: 1_250_000,
  policy_id: 'OSDMA-2019-FANI',
  audit_hash: 'sha256:a7b3c...f4e9d',
  hmac_valid: true,
};

const DEMO_AUDIT_LOG = [
  { time: '2019-05-02 20:31', action: 'Trigger computed', actor: 'system', detail: 'Surge 3.84m > 3.0m threshold' },
  { time: '2019-05-02 20:32', action: 'HMAC signed', actor: 'system', detail: 'SHA-256 canonical payload signed' },
  { time: '2019-05-02 20:45', action: 'Operator reviewed', actor: 'operator_01', detail: 'HITL confirmation received' },
  { time: '2019-05-02 20:46', action: 'Webhook dispatched', actor: 'system', detail: 'POST → insurer endpoint' },
  { time: '2019-05-02 20:46', action: 'Webhook acknowledged', actor: 'insurer_api', detail: 'HTTP 200 received' },
];

function MetricCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)', padding: 'var(--space-5)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, fontFamily: 'var(--font-mono)', color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function InsurerContent() {
  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, hsl(142, 72%, 38%), hsl(162, 80%, 35%))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <DollarSign size={20} style={{ color: 'white' }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
            Parametric Insurance Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Trigger status · Audit trail · Payout record — Insurer view only
          </p>
        </div>
        {DEMO_TRIGGER.triggered && (
          <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--color-success-muted)', color: 'var(--color-success)',
            padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-sm)', fontWeight: 700, animation: 'pulse 2s infinite',
          }}>
            <CheckCircle2 size={16} />
            TRIGGER ACTIVE
          </div>
        )}
      </div>

      {/* Disclaimer Banner */}
      <div style={{
        background: 'rgba(168, 85, 247, 0.1)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        marginBottom: 'var(--space-6)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        <ShieldCheck size={20} style={{ color: '#c084fc', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.8rem', color: '#e9d5ff', lineHeight: 1.5 }}>
          <strong style={{ color: '#ffffff' }}>PARAMETRIC TRIGGER ARTIFACT — NOT AN EXECUTED PAYMENT:</strong> This platform computes deterministic numerical threshold proofs and cryptographically signed (HMAC-SHA256) trigger payloads for authorized underwriter and government review. No banking rails or automated funds transfers are executed by this platform.
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <MetricCard label="Policy Entitlement" value={`$${(DEMO_TRIGGER.payout_usd / 1e6).toFixed(2)}M`} sub="Subject to human underwriter review" color="var(--color-success)" icon={<DollarSign size={13} />} />
        <MetricCard label="Surge Trigger" value={`${DEMO_TRIGGER.surge_height_m} m`} sub="Threshold: 3.0m" color="var(--color-primary)" icon={<ShieldCheck size={13} />} />
        <MetricCard label="Wind Speed" value={`${DEMO_TRIGGER.wind_speed_kmh} km/h`} color="var(--color-warning)" icon={<Clock size={13} />} />
        <MetricCard label="Rainfall 72h" value={`${DEMO_TRIGGER.rainfall_72h_mm} mm`} color="var(--color-primary)" icon={<Clock size={13} />} />
      </div>

      {/* Policy Card */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)', padding: 'var(--space-5)',
        marginBottom: 'var(--space-5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <FileText size={16} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>Policy & Signature</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          {[
            { label: 'Policy ID', value: DEMO_TRIGGER.policy_id },
            { label: 'Event ID', value: DEMO_TRIGGER.event_id },
            { label: 'District', value: DEMO_TRIGGER.district_id },
            { label: 'Trigger Timestamp', value: DEMO_TRIGGER.trigger_timestamp },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {DEMO_TRIGGER.hmac_valid
            ? <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
            : <XCircle size={16} style={{ color: 'var(--color-danger)' }} />}
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>HMAC-SHA256 signature:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
            {DEMO_TRIGGER.audit_hash} ✓ valid
          </span>
        </div>
      </div>

      {/* Audit Trail */}
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)', overflow: 'hidden',
      }}>
        <div style={{
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          <Clock size={15} style={{ color: 'var(--color-primary)' }} />
          <h2 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>Audit Trail</h2>
        </div>
        <div style={{ padding: 'var(--space-2) 0' }}>
          {DEMO_AUDIT_LOG.map((entry, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 1fr',
              padding: 'var(--space-3) var(--space-5)',
              borderBottom: i < DEMO_AUDIT_LOG.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              alignItems: 'center', gap: 'var(--space-4)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {entry.time}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                {entry.action}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {entry.detail}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }`}</style>
    </div>
  );
}

export function InsurerDashboard() {
  return (
    <RoleGate allowed={['insurer_viewer', 'admin']}>
      <InsurerContent />
    </RoleGate>
  );
}
