/**
 * frontend/src/hooks/useScenarioQuery.ts
 * TanStack Query wrapper for scenario "what-if" re-runs.
 *
 * Triggers the pipeline with a modified wind/category parameter
 * and caches results per (districtId, eventId, windKmh) triple.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface ScenarioParams {
  districtId: string;
  eventId: string;
  windSpeedKmh: number;
  maxSurgeM: number;
}

interface PipelineStatus {
  job_id: string;
  district_id: string;
  event_id: string;
  status: string;
  stage: string;
  elapsed_s: number | null;
  result_summary: Record<string, unknown> | null;
  error: string | null;
}

interface StructuralResult {
  district_id: string;
  event_id: string;
  wind_speed_kmh: number;
  assets: Array<{
    asset_id: string;
    asset_class: string;
    safety_factor: number;
    likely_failure: boolean;
    reinforcement_advisable: boolean;
    combined_expected_damage_state: string;
    confidence: string;
    hardening_priority_score: number;
  }>;
  total_at_risk: number;
  likely_failure_count: number;
  reinforcement_advisable_count: number;
}

/** Fetch structural assessment for a given scenario */
export function useStructuralScenario(params: ScenarioParams) {
  return useQuery<StructuralResult>({
    queryKey: ['structural', params.districtId, params.eventId, params.windSpeedKmh, params.maxSurgeM],
    queryFn: async () => {
      const res = await axios.get(
        `${API_BASE}/structural/${encodeURIComponent(params.districtId)}`,
        {
          params: {
            event_id: params.eventId,
            wind_speed_kmh: params.windSpeedKmh,
            max_surge_m: params.maxSurgeM,
          },
        }
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });
}

/** Trigger a full pipeline run and poll until done */
export function usePipelineRun() {
  const queryClient = useQueryClient();

  return useMutation<PipelineStatus, Error, { districtId: string; eventId: string }>({
    mutationFn: async ({ districtId, eventId }) => {
      const res = await axios.post(`${API_BASE}/pipeline/run`, {
        district_id: districtId,
        event_id: eventId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      // Invalidate all related cached data so views refresh
      queryClient.invalidateQueries({ queryKey: ['risk', data.district_id] });
      queryClient.invalidateQueries({ queryKey: ['structural', data.district_id] });
    },
  });
}

/** Poll job status */
export function useJobStatus(jobId: string | null) {
  return useQuery<PipelineStatus>({
    queryKey: ['pipeline-job', jobId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/pipeline/status/${jobId}`);
      return res.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' || status === 'queued' ? 2000 : false;
    },
  });
}
