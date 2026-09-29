/**
 * frontend/src/components/ActiveEventsList.tsx
 *
 * Feed of active national disaster events across India.
 * Formatted with institutional tags, severity tiers, and drill-down controls.
 */
import React from 'react';
import { SEVERITY_TIERS } from './SeverityLegend';
import { HAZARD_CONFIGS } from './HazardTypeFilter';
import { ChevronRight, Clock, MapPin, AlertCircle, Shield, CheckCircle } from 'lucide-react';

export interface ActiveEvent {
  event_id: string;
  hazard_type: string;
  name: string;
  status: string;
  severity: string;
  coordinates: { lat: number; lon: number };
  affected_states: string[];
  detected_at: string;
  origin_event_id?: string | null;
  metadata?: Record<string, any>;
}

interface ActiveEventsListProps {
  events: ActiveEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: ActiveEvent) => void;
  onDrillDown?: (event: ActiveEvent) => void;
}

export const ActiveEventsList: React.FC<ActiveEventsListProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  onDrillDown,
}) => {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500">
        <CheckCircle className="w-10 h-10 text-emerald-500/50 mb-3" />
        <h4 className="text-sm font-semibold text-slate-300">All Sectors Clear</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          No severe physical hazard anomalies exceeding baseline trigger thresholds in this category.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[620px] pr-1">
      {events.map((ev) => {
        const isSelected = selectedEventId === ev.event_id;
        const sevTier = SEVERITY_TIERS[ev.severity] || SEVERITY_TIERS.Watch;
        const hazardConfig = HAZARD_CONFIGS.find((h) => h.id === ev.hazard_type);

        return (
          <div
            key={ev.event_id}
            onClick={() => onSelectEvent(ev)}
            className={`cursor-pointer p-3.5 rounded-xl border transition-all duration-150 ${
              isSelected
                ? 'bg-slate-800/90 border-blue-500/60 shadow-lg shadow-blue-500/10'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
            }`}
          >
            {/* Header: Hazard Type Badge & Severity Badge */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="p-1 rounded-md bg-slate-800 border border-slate-700"
                  style={{ color: hazardConfig?.color || '#38bdf8' }}
                >
                  {hazardConfig?.icon}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {ev.hazard_type}
                </span>
              </div>

              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border flex items-center gap-1"
                style={{
                  backgroundColor: sevTier.bg,
                  borderColor: sevTier.border,
                  color: sevTier.color,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: sevTier.color }}
                />
                {ev.severity}
              </span>
            </div>

            {/* Event Name */}
            <h4 className="text-sm font-bold text-slate-100 mb-1 leading-snug">
              {ev.name}
            </h4>

            {/* Location & Status Info */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" />
                {ev.affected_states.join(', ')} ({ev.coordinates.lat.toFixed(1)}°N, {ev.coordinates.lon.toFixed(1)}°E)
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {ev.status.replace('_', ' ')}
              </span>
            </div>

            {/* Scientific Governance Disclaimer for Earthquake */}
            {ev.hazard_type === 'earthquake' && (
              <div className="mb-2 px-2 py-1 bg-red-950/30 border border-red-900/40 rounded text-[11px] text-red-400/90 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                <span>Post-event triage: Earthquakes cannot be predicted in advance.</span>
              </div>
            )}

            {/* Primary Physical Metric Highlight */}
            {ev.metadata && Object.keys(ev.metadata).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5 text-[11px] font-mono text-slate-300">
                {ev.metadata.max_wind_kmh && (
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    Wind: {ev.metadata.max_wind_kmh} km/h
                  </span>
                )}
                {ev.metadata.magnitude_mw && (
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    Mw {ev.metadata.magnitude_mw} (Depth: {ev.metadata.depth_km}km)
                  </span>
                )}
                {ev.metadata.current_water_level_m && (
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    River Level: {ev.metadata.current_water_level_m}m
                  </span>
                )}
                {ev.metadata.max_forecast_temp_c && (
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    Peak Temp: {ev.metadata.max_forecast_temp_c}°C
                  </span>
                )}
                {ev.metadata.estimated_runup_height_m && (
                  <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                    Run-up: {ev.metadata.estimated_runup_height_m}m
                  </span>
                )}
              </div>
            )}

            {/* Drill Down Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
              <span className="text-[11px] text-slate-500 font-mono">
                ID: {ev.event_id}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDrillDown?.(ev);
                }}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                <span>Inspect Impact</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
