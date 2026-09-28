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

  useEffect(() => {
    let unmounted = false;
    let retryCount = 0;

    const connect = () => {
      if (unmounted || !enabled || !districtId) return;

      const url = `${WS_BASE}/pipeline/ws/risk/${encodeURIComponent(districtId)}`;
      setConnectionStatus('connecting');

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) {
          ws.close();
          return;
        }
        retryCount = 0;
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
        if (!unmounted) setConnectionStatus('error');
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnectionStatus('disconnected');
        wsRef.current = null;
        // Exponential backoff: 3s -> 4.5s -> 6.75s ... max 30s
        const delay = Math.min(30_000, 3_000 * Math.pow(1.5, retryCount));
        retryCount += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [districtId, enabled, onMessage, queryClient]);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('ping');
    }
  }, []);

  return { connectionStatus, sendPing };
}
