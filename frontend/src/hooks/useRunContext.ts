/**
 * frontend/src/hooks/useRunContext.ts
 *
 * Shared run state hook — subscribes to WebSocket stage events and
 * falls back to REST polling when socket is unavailable.
 *
 * Usage:
 *   const { run, stageProgress, isConnected } = useRunContext(stormId);
 *
 * Design rules:
 *  - WebSocket events invalidate TanStack Query cache for the run
 *  - On disconnect, REST poll every 10s until reconnect
 *  - Never show stale data as current without a visible staleness badge
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface StageStatus {
  stage_name: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  model_version?: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface RunState {
  run_id: string;
  event_id: string;
  district_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stages: Record<string, StageStatus>;
  advisory_draft_id?: string;
  result_summary?: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
  is_scenario?: boolean;
}

export interface UseRunContextReturn {
  run: RunState | null;
  activeRunId: string | null;
  stageProgress: StageStatus[];
  isConnected: boolean;
  lastMessage: { type: string; [key: string]: unknown } | null;
  setActiveRunId: (id: string | null) => void;
}

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const IS_STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const POLL_INTERVAL_MS = 10000;

export function useRunContext(stormId: string | null): UseRunContextReturn {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const reconnectAttempts = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<{ type: string; [key: string]: unknown } | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);

  // Derived: ordered stage list from run.stages
  const stageProgress: StageStatus[] = run
    ? [
        'track_ingestion', 'rainfall_forecast', 'surge_modeling',
        'flash_flood_modeling', 'exposure_scoring', 'structural_assessment',
        'insurance_trigger', 'ai_advisory',
      ].map((name) => run.stages?.[name] ?? { stage_name: name, status: 'queued' })
    : [];

  const fetchRunFromRest = useCallback(async (runId: string) => {
    if (IS_STATIC_DEMO || !mountedRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/v1/storms/runs/${runId}`);
      if (!res.ok) return;
      const data: RunState = await res.json();
      if (!mountedRef.current) return;
      setRun(data);
      queryClient.setQueryData(['run', runId], data);
    } catch {
      // Network error — keep last known state
    }
  }, [queryClient]);

  const connect = useCallback(() => {
    if (IS_STATIC_DEMO || !stormId || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_BASE}/v1/storms/ws/${stormId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setIsConnected(true);
      reconnectAttempts.current = 0;
      // Stop REST polling — WS is live
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      // Recover state from REST on reconnect
      if (activeRunId) {
        fetchRunFromRest(activeRunId);
      }
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(evt.data) as { type: string; run_id?: string; [key: string]: unknown };
        setLastMessage(msg);

        switch (msg.type) {
          case 'stage_started':
          case 'stage_completed':
          case 'stage_failed':
          case 'stage_skipped': {
            const runId = msg.run_id as string;
            if (runId) {
              if (!activeRunId) setActiveRunId(runId);
              // Invalidate so TanStack Query refetches
              queryClient.invalidateQueries({ queryKey: ['run', runId] });
              // Optimistically update local stage state
              setRun((prev) => {
                if (!prev || prev.run_id !== runId) return prev;
                const stageName = msg.stage as string;
                const status = msg.type === 'stage_started'
                  ? 'running'
                  : msg.type === 'stage_completed'
                  ? 'completed'
                  : msg.type === 'stage_failed'
                  ? 'failed'
                  : 'skipped';
                return {
                  ...prev,
                  stages: {
                    ...prev.stages,
                    [stageName]: {
                      ...prev.stages?.[stageName],
                      stage_name: stageName,
                      status,
                      model_version: msg.model_version as string | undefined,
                    },
                  },
                };
              });
            }
            break;
          }
          case 'completed': {
            const runId = msg.run_id as string;
            if (runId) {
              setActiveRunId(runId);
              queryClient.invalidateQueries({ queryKey: ['run', runId] });
              queryClient.invalidateQueries({ queryKey: ['advisories'] });
              fetchRunFromRest(runId);
            }
            break;
          }
          case 'review_required': {
            queryClient.invalidateQueries({ queryKey: ['advisories'] });
            break;
          }
          case 'connected': {
            // Server sent active runs — adopt latest
            const activeRuns = msg.active_runs as Array<{ run_id: string; status: string }> | undefined;
            if (activeRuns?.length) {
              const latest = activeRuns[0];
              setActiveRunId(latest.run_id);
              fetchRunFromRest(latest.run_id);
            }
            break;
          }
          default:
            break;
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      wsRef.current = null;

      // Start REST polling as fallback
      if (!pollTimerRef.current && activeRunId) {
        pollTimerRef.current = setInterval(() => {
          if (activeRunId) fetchRunFromRest(activeRunId);
        }, POLL_INTERVAL_MS);
      }

      // Exponential backoff reconnect
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** reconnectAttempts.current,
        RECONNECT_MAX_MS,
      );
      reconnectAttempts.current += 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [stormId, activeRunId, fetchRunFromRest, queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [stormId]); // only re-connect when stormId changes

  // Sync run state when activeRunId changes
  useEffect(() => {
    if (activeRunId) fetchRunFromRest(activeRunId);
  }, [activeRunId, fetchRunFromRest]);

  return { run, activeRunId, stageProgress, isConnected, lastMessage, setActiveRunId };
}
