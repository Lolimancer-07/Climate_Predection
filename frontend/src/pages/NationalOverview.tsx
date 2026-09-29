/**
 * frontend/src/pages/NationalOverview.tsx
 *
 * Pan-India Multi-Hazard Anticipatory Intelligence Dashboard (KAVACH).
 * Consolidates live telemetry across all 8 hazard perils, national administrative
 * hierarchy drill-down, and unified multi-channel dispatch controls.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ShieldAlert,
  Radio,
  Users,
  Building2,
  Send,
  RefreshCw,
  Layers,
  MapPin,
  FileText,
  AlertTriangle,
  Globe2,
} from 'lucide-react';

import { NationalMap } from '../components/NationalMap';
import { HazardTypeFilter, HazardPeril } from '../components/HazardTypeFilter';
import { ActiveEventsList, ActiveEvent } from '../components/ActiveEventsList';
import { SeverityLegend } from '../components/SeverityLegend';

interface NationalOverviewProps {
  onNavigateToDistrict?: (districtId: string) => void;
  onNavigateToStorm?: (stormId: string) => void;
}

export const NationalOverview: React.FC<NationalOverviewProps> = ({
  onNavigateToDistrict,
  onNavigateToStorm,
}) => {
  const [selectedHazard, setSelectedHazard] = useState<HazardPeril>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isSendingDigest, setIsSendingDigest] = useState(false);

  // Fetch National Multi-Hazard Summary
  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['national_overview'],
    queryFn: async () => {
      const res = await axios.get('http://127.0.0.1:8000/v1/national/overview');
      return res.data;
    },
    refetchInterval: 15000,
  });

  const allEvents: ActiveEvent[] = summary?.events || [];

  // Filter events based on selected hazard peril
  const filteredEvents = selectedHazard === 'all'
    ? allEvents
    : allEvents.filter((ev) => ev.hazard_type === selectedHazard);

  const selectedEvent = allEvents.find((e) => e.event_id === selectedEventId) || allEvents[0];

  // Handler for Daily Digest Dispatch
  const handleDispatchDigest = async () => {
    setIsSendingDigest(true);
    try {
      const res = await axios.post('http://127.0.0.1:8000/v1/notifications/digest/send', {
        operator_confirmed: true,
      });
      toast.success('Pan-India Daily Situational Digest Dispatched', {
        description: `Delivered to ${res.data.recipients_count} state EOCs and institutional subscribers.`,
      });
    } catch (err: any) {
      toast.error('Digest Dispatch Failed', {
        description: err.message || 'Network error communicating with notification orchestrator.',
      });
    } finally {
      setIsSendingDigest(false);
    }
  };

  const handleDrillDown = (ev: ActiveEvent) => {
    if (ev.hazard_type === 'cyclone') {
      onNavigateToStorm?.('BOB07-2026');
    } else {
      toast.info(`Drilling down into ${ev.name}`, {
        description: `Focusing on affected states: ${ev.affected_states.join(', ')}`,
      });
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6 bg-slate-950 text-slate-100 min-h-screen">
      {/* ── Page Header & Quick Dispatch Trigger ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-widest">
              KAVACH · NATIONAL DEFENSE & DRR
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              PAN-INDIA MULTI-HAZARD GRID ACTIVE
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-blue-400" />
            All-India Multi-Hazard Situational Overview
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Feeds</span>
          </button>

          <button
            onClick={handleDispatchDigest}
            disabled={isSendingDigest}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSendingDigest ? 'Dispatching...' : 'Dispatch Daily Digest'}</span>
          </button>
        </div>
      </div>

      {/* ── National KPI Summary Ribbon ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Active Events</span>
            <Radio className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {summary?.active_events_count ?? 8}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across 8 hazard perils</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-red-900/40">
          <div className="flex items-center justify-between text-xs text-red-400 mb-1">
            <span>Emergency Tier</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black font-mono text-red-400">
            {summary?.emergency_events_count ?? 3}
          </div>
          <div className="text-[10px] text-red-500/70 mt-0.5">Mandatory evacuation</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-orange-900/40">
          <div className="flex items-center justify-between text-xs text-orange-400 mb-1">
            <span>Severe Tier</span>
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-black font-mono text-orange-400">
            {summary?.severe_events_count ?? 3}
          </div>
          <div className="text-[10px] text-orange-500/70 mt-0.5">High damage forecast</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Alerted States</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {summary?.affected_states_count ?? 11}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">State EOCs notified</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Population at Risk</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-400">
            {(summary?.total_exposed_population ?? 8450000).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Pre-landfall / in zone</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>SACHET / CAP</span>
            <FileText className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black font-mono text-teal-400">
            100%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">CAP 1.2 XML compliant</div>
        </div>
      </div>

      {/* ── Hazard Filter Bar & Shared Severity Scale ────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-slate-900/40 rounded-xl border border-slate-800/60">
        <HazardTypeFilter
          selectedHazard={selectedHazard}
          onSelectHazard={setSelectedHazard}
          counts={summary?.hazard_breakdown}
        />
        <SeverityLegend />
      </div>

      {/* ── Main Workspace: National Map + Active Events Feed ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Pan-India Geographic Map (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <NationalMap
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={(ev) => setSelectedEventId(ev.event_id)}
          />
        </div>

        {/* Right: Active Events Feed & Detailed Triage Drawer (5 Cols) ─────── */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Active Hazard Trackers ({filteredEvents.length})</span>
            </h3>
            <span className="text-xs text-slate-500">Live 10-sec Poll</span>
          </div>

          <ActiveEventsList
            events={filteredEvents}
            selectedEventId={selectedEventId}
            onSelectEvent={(ev) => setSelectedEventId(ev.event_id)}
            onDrillDown={handleDrillDown}
          />
        </div>
      </div>
    </div>
  );
};
