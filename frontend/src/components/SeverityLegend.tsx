/**
 * frontend/src/components/SeverityLegend.tsx
 *
 * Unified Multi-Hazard Severity Scale Legend for KAVACH.
 * Defines the shared 4-tier alerting standard applied across all 8 peril types:
 * Watch (Sky), Warning (Amber), Severe (Orange), Emergency (Red).
 */
import React from 'react';
import { AlertCircle, AlertTriangle, Flame, ShieldAlert } from 'lucide-react';

export interface SeverityTierConfig {
  tier: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
  actionSummary: string;
}

export const SEVERITY_TIERS: Record<string, SeverityTierConfig> = {
  Emergency: {
    tier: 'Emergency',
    label: 'Emergency / Order',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.4)',
    description: 'Life-safety threshold exceeded. Catastrophic damage forecast.',
    actionSummary: 'Mandatory evacuation and preemptive utility shutdown.',
  },
  Severe: {
    tier: 'Severe',
    label: 'Severe Impact',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.15)',
    border: 'rgba(249, 115, 22, 0.4)',
    description: 'High destructive potential. Severe infrastructure disruption.',
    actionSummary: 'Move vulnerable populations to shelters; stage NDRF teams.',
  },
  Warning: {
    tier: 'Warning',
    label: 'Warning',
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.15)',
    border: 'rgba(234, 179, 8, 0.4)',
    description: 'Dangerous conditions developing within 24-48h window.',
    actionSummary: 'Verify backup diesel supplies; inspect coastal sluice gates.',
  },
  Watch: {
    tier: 'Watch',
    label: 'Watch / Monitored',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    border: 'rgba(56, 189, 248, 0.4)',
    description: 'Physical anomaly detected; trajectory under tracking.',
    actionSummary: 'Continuous monitoring of weather radar & satellite feeds.',
  },
};

interface SeverityLegendProps {
  compact?: boolean;
}

export const SeverityLegend: React.FC<SeverityLegendProps> = ({ compact = false }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {Object.values(SEVERITY_TIERS).map((s) => (
        <div
          key={s.tier}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border"
          style={{ backgroundColor: s.bg, borderColor: s.border, color: s.color }}
          title={`${s.label}: ${s.description} → ${s.actionSummary}`}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: s.color }}
          />
          <span className="font-semibold tracking-wide uppercase text-[10px]">
            {compact ? s.tier : s.label}
          </span>
        </div>
      ))}
    </div>
  );
};
