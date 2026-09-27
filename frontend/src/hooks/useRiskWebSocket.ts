/**
 * frontend/src/hooks/useRiskWebSocket.ts
 * WebSocket subscription hook for live risk/pipeline updates per district.
 *
 * On receiving a push update, invalidates the relevant TanStack Query cache
 * entries so components re-fetch automatically — avoids separate state stores.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type WsMessage =
  | { type: 'connected'; district_id: string }
  | { type: 'pong' }
  | { type: 'risk_update'; district_id: string; payload: unknown }
  | { type: 'pipeline_stage'; job_id: string; stage: string; status: string };

interface UseRiskWebSocketOptions {
  districtId: string;
  enabled?: boolean;
  onMessage?: (msg: WsMessage) => void;
}

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000';

export function useRiskWebSocket({
  districtId,
  enabled = true,
  onMessage,
}: UseRiskWebSocketOptions) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('disconnected');

  const connect = useCallback(() => {
    if (!enabled || !districtId) return;

    const url = `${WS_BASE}/pipeline/ws/risk/${encodeURIComponent(districtId)}`;
    setConnectionStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        onMessage?.(msg);

        // On risk update, invalidate relevant query cache
        if (msg.type === 'risk_update') {
          queryClient.invalidateQueries({ queryKey: ['risk', districtId] });
          queryClient.invalidateQueries({ queryKey: ['structural', districtId] });
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wsRef.current = null;
      // Reconnect after 5s
      reconnectTimer.current = setTimeout(connect, 5_000);
    };
  }, [districtId, enabled, onMessage, queryClient]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('ping');
    }
  }, []);

  return { connectionStatus, sendPing };
}
