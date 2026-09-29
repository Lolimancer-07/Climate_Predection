import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Types ───────────────────────────────────────────────────────────────────

export interface FlaggedAsset {
  asset_id: string
  type: string
  name: string
  priority_score: number
  flag_reason: string
}

export interface WardRisk {
  ward_id: string
  ward_name: string
  population: number
  surge_height_m: number
  rainfall_mm_48h: number
  wind_speed_kmh: number
  runoff_risk_score: number
  severity_tier: string
  flagged_assets: FlaggedAsset[]
}

export interface DistrictRisk {
  district_id: string
  event_id: string
  cyclone_name: string
  cyclone_category: string
  wards: WardRisk[]
}

export interface TriggerRecord {
  trigger_id: string
  policy_id: string
  zone_id: string
  trigger_type: string
  threshold_value: number
  observed_value: number
  triggered: boolean
  trigger_timestamp: string
  audit_hash: string
  notes: string
}

export interface AdvisoryOut {
  advisory_id: string
  ward_id: string
  event_id: string
  severity_tier: string
  content_en: string
  content_local: string
  generated_by?: string
  validation_passed: boolean
  validation_warnings: string[]
  status: string
}

// ── API calls ────────────────────────────────────────────────────────────────

export const fetchDistrictRisk = async (districtId: string): Promise<DistrictRisk> => {
  const { data } = await api.get(`/risk/${districtId}`)
  return data
}

export const fetchTriggers = async (eventId: string): Promise<TriggerRecord[]> => {
  const { data } = await api.get(`/insurance/triggers/${eventId}`)
  return data
}

export const evaluateTriggers = async (
  eventId: string,
  hazardValues: Record<string, number>,
): Promise<any> => {
  const { data } = await api.post('/insurance/triggers/evaluate', {
    event_id: eventId,
    hazard_values: hazardValues,
    confidence: 'forecast',
  })
  return data
}

export const generateAdvisory = async (
  wardId: string,
  eventId: string,
  severityTier: string,
  riskPayload: object,
): Promise<AdvisoryOut> => {
  const { data } = await api.post('/advisory/generate', {
    ward_id: wardId,
    event_id: eventId,
    severity_tier: severityTier,
    risk_payload: riskPayload,
  })
  return data
}

export const dispatchAdvisory = async (
  advisoryId: string,
  channels: string[],
  recipients: string[],
  operatorId: string,
): Promise<any> => {
  // First approve
  await api.post(`/advisory/${advisoryId}/review`, {
    reviewed_by: operatorId,
    approved: true,
  })
  // Then dispatch
  const { data } = await api.post(`/advisory/${advisoryId}/dispatch`, {
    channels,
    recipients,
    operator_id: operatorId,
  })
  return data
}

export interface AdvisoryDraft {
  draft_id: string
  run_id?: string
  event_id: string
  district_id: string
  draft_text: string
  evidence_json: Record<string, any>
  grounding_passed: boolean
  grounding_failures?: string[]
  status: 'pending' | 'approved' | 'rejected' | 'dispatched'
  is_scenario?: boolean
  created_at: string
  latest_review?: {
    review_id: string
    actor_id: string
    actor_role: string
    decision: string
    edited_text?: string
    reason?: string
    reviewed_at: string
  }
  dispatch_attempts?: Array<{
    attempt_id: string
    channel: string
    recipient_ref: string
    status: string
    actor_id?: string
    event_id?: string
    run_id?: string
    dispatched_at: string
  }>
}

export const fetchRunAdvisories = async (runId: string): Promise<{ run_id: string; drafts: AdvisoryDraft[] }> => {
  const { data } = await api.get(`/v1/runs/${runId}/advisories`)
  return data
}

export const listAdvisoryDrafts = async (status?: string, eventId?: string): Promise<{ drafts: AdvisoryDraft[]; count: number }> => {
  const params: Record<string, string> = {}
  if (status) params.status = status
  if (eventId) params.event_id = eventId
  const { data } = await api.get('/v1/advisories', { params })
  return data
}

export const reviewAdvisoryDraft = async (
  draftId: string,
  payload: { decision: string; actor_id: string; edited_text?: string; reason?: string },
): Promise<any> => {
  const { data } = await api.post(`/v1/advisories/${draftId}/review`, payload, {
    headers: { 'X-Role': 'ddma_operator' },
  })
  return data
}

export const dispatchAdvisoryDraft = async (
  draftId: string,
  payload: { channels: string[]; recipients: string[]; operator_id: string },
): Promise<any> => {
  const { data } = await api.post(`/v1/advisories/${draftId}/dispatch`, payload, {
    headers: { 'X-Role': 'ddma_operator' },
  })
  return data
}
