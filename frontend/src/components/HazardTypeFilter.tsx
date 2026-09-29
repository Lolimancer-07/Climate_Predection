/**
 * frontend/src/components/HazardTypeFilter.tsx
 *
 * Multi-Hazard Peril Filter Bar.
 * Allows toggling across all 8 hazard types with live active count badges
 * and clear peril-specific visual iconography.
 */
import React from 'react';
import {
  Wind,
  Droplets,
  Zap,
  Mountain,
  Sun,
  Flame,
  Waves,
  Layers,
  Thermometer,
} from 'lucide-react';

export type HazardPeril =
  | 'all'
  | 'cyclone'
  | 'flood'
  | 'earthquake'
  | 'landslide'
  | 'heatwave'
  | 'drought'
  | 'wildfire'
  | 'tsunami';

export interface HazardConfig {
  id: HazardPeril;
  label: string;
  icon: React.ReactNode;
  color: string;
  badgeTooltip?: string;
}

export const HAZARD_CONFIGS: HazardConfig[] = [
  { id: 'all',        label: 'All Perils',    icon: <Layers className="w-3.5 h-3.5" />,      color: '#94a3b8' },
  { id: 'cyclone',    label: 'Cyclone',       icon: <Wind className="w-3.5 h-3.5" />,        color: '#38bdf8' },
  { id: 'flood',      label: 'River Flood',   icon: <Droplets className="w-3.5 h-3.5" />,    color: '#60a5fa' },
  { id: 'earthquake', label: 'Earthquake',    icon: <Zap className="w-3.5 h-3.5" />,         color: '#f87171', badgeTooltip: 'Post-event triage only' },
  { id: 'landslide',  label: 'Landslide',     icon: <Mountain className="w-3.5 h-3.5" />,    color: '#fb923c' },
  { id: 'heatwave',   label: 'Heatwave',      icon: <Thermometer className="w-3.5 h-3.5" />, color: '#facc15' },
  { id: 'drought',    label: 'Drought',       icon: <Sun className="w-3.5 h-3.5" />,         color: '#eab308' },
  { id: 'wildfire',   label: 'Forest Fire',   icon: <Flame className="w-3.5 h-3.5" />,       color: '#f97316' },
  { id: 'tsunami',    label: 'Tsunami',       icon: <Waves className="w-3.5 h-3.5" />,       color: '#2dd4bf' },
];

interface HazardTypeFilterProps {
  selectedHazard: HazardPeril;
  onSelectHazard: (hazard: HazardPeril) => void;
  counts?: Record<string, number>;
}

export const HazardTypeFilter: React.FC<HazardTypeFilterProps> = ({
  selectedHazard,
  onSelectHazard,
  counts = {},
}) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-800">
      {HAZARD_CONFIGS.map((h) => {
        const isSelected = selectedHazard === h.id;
        const count = h.id === 'all' 
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[h.id] ?? 0);

        return (
          <button
            key={h.id}
            onClick={() => onSelectHazard(h.id)}
            title={h.badgeTooltip || h.label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              isSelected
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <span style={{ color: h.color }}>{h.icon}</span>
            <span>{h.label}</span>
            {count > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isSelected
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
