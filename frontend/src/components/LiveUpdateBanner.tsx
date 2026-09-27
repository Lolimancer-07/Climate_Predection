/**
 * frontend/src/components/LiveUpdateBanner.tsx
 * Surfaces WebSocket connection status and push update notifications.
 */
import React, { useState } from 'react';
import { Wifi, WifiOff, Loader2, Bell, X } from 'lucide-react';
import { useRiskWebSocket } from '../hooks/useRiskWebSocket';

interface LiveUpdateBannerProps {
  districtId: string;
}

export function LiveUpdateBanner({ districtId }: LiveUpdateBannerProps) {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const { connectionStatus } = useRiskWebSocket({
    districtId,
    onMessage: (msg) => {
      if (msg.type === 'risk_update' || msg.type === 'pipeline_stage') {
        setLastUpdate(new Date().toLocaleTimeString());
        setDismissed(false);
      }
    },
  });

  const statusConfig = {
    connected:    { icon: <Wifi size={14} />,    color: 'var(--color-success)',  label: 'Live' },
    connecting:   { icon: <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />, color: 'var(--color-warning)', label: 'Connecting…' },
    disconnected: { icon: <WifiOff size={14} />, color: 'var(--color-danger)',   label: 'Offline' },
    error:        { icon: <WifiOff size={14} />, color: 'var(--color-danger)',   label: 'Error' },
  };

  const cfg = statusConfig[connectionStatus];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
      padding: 'var(--space-2) var(--space-4)',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 'var(--text-xs)',
    }}>
      {/* Connection status */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', color: cfg.color }}>
        {cfg.icon}
        <span>{cfg.label}</span>
      </span>
      <span style={{ color: 'var(--border-default)' }}>|</span>
      <span style={{ color: 'var(--text-muted)' }}>District: {districtId}</span>

      {/* Last update toast */}
      {lastUpdate && !dismissed && (
        <span style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          background: 'var(--color-primary-muted)', borderRadius: 'var(--radius-full)',
          padding: '2px var(--space-3)', color: 'var(--color-primary-light)',
        }}>
          <Bell size={11} />
          <span>Updated {lastUpdate}</span>
          <button
            onClick={() => setDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', lineHeight: 1, padding: 0 }}
          >
            <X size={11} />
          </button>
        </span>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
