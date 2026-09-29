/**
 * frontend/src/components/NationalMap.tsx
 *
 * Interactive Pan-India Multi-Hazard Geographic Visualization.
 * Projects geospatial hazard markers and state alert polygons across India,
 * Bay of Bengal, Arabian Sea, and the Himalayan Arc with live pulse effects.
 */
import React, { useState } from 'react';
import { ActiveEvent } from './ActiveEventsList';
import { SEVERITY_TIERS } from './SeverityLegend';
import { HAZARD_CONFIGS } from './HazardTypeFilter';
import { MapPin, Navigation, Eye, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface NationalMapProps {
  events: ActiveEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: ActiveEvent) => void;
  selectedState?: string | null;
}

// Bounding box for India coordinate projection
// Lon: 68.0 to 97.5 (Width: 29.5)
// Lat: 8.0 to 37.0  (Height: 29.0)
const LON_MIN = 67.0;
const LON_MAX = 98.0;
const LAT_MIN = 7.0;
const LAT_MAX = 36.5;

function projectCoords(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * 100;
  // Invert Y because SVG coordinates increase downwards
  const y = (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100;
  return { x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) };
}

export const NationalMap: React.FC<NationalMapProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  selectedState,
}) => {
  const [hoveredEvent, setHoveredEvent] = useState<ActiveEvent | null>(null);

  // Approximate representative boundary points for India polygon visualization
  const indiaOutlinePoints = [
    projectCoords(35.5, 74.8), // Kashmir North
    projectCoords(34.3, 78.5), // Ladakh East
    projectCoords(31.5, 78.8), // Himachal
    projectCoords(30.2, 80.8), // Uttarakhand
    projectCoords(27.4, 88.5), // Sikkim
    projectCoords(28.2, 96.5), // Arunachal NE
    projectCoords(24.5, 93.5), // Manipur
    projectCoords(22.0, 92.8), // Mizoram
    projectCoords(21.8, 89.0), // Bengal Sunderbans
    projectCoords(19.8, 85.8), // Odisha Puri Coast
    projectCoords(17.7, 83.3), // Vizag
    projectCoords(13.1, 80.3), // Chennai Coast
    projectCoords(8.1, 77.5),  // Kanyakumari Tip
    projectCoords(9.9, 76.2),  // Kerala Kochi
    projectCoords(15.4, 73.8), // Goa
    projectCoords(18.9, 72.8), // Mumbai Coast
    projectCoords(21.0, 72.8), // Surat
    projectCoords(23.0, 68.8), // Kutch West
    projectCoords(27.0, 71.0), // Rajasthan Thar
    projectCoords(30.0, 74.0), // Punjab
    projectCoords(33.0, 74.5), // Jammu
  ]
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="relative w-full h-[620px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center select-none">
      {/* Background Geo Radar Sweep / Gridlines */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />
      
      {/* Sea & Basin Annotations */}
      <div className="absolute left-6 bottom-20 text-[11px] font-mono tracking-widest uppercase text-slate-600 pointer-events-none">
        Arabian Sea Basin
      </div>
      <div className="absolute right-12 bottom-20 text-[11px] font-mono tracking-widest uppercase text-slate-600 pointer-events-none">
        Bay of Bengal Basin
      </div>
      <div className="absolute left-1/3 top-6 text-[11px] font-mono tracking-widest uppercase text-slate-600 pointer-events-none">
        Himalayan Arc (Zone IV-V)
      </div>

      {/* SVG Map Canvas */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full max-w-[620px] max-h-[620px] p-2"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="oceanGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.8" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Ocean Background Tint */}
        <rect width="100" height="100" fill="url(#oceanGlow)" />

        {/* India Territorial Geometry Polygon */}
        <polygon
          points={indiaOutlinePoints}
          className="fill-slate-900/90 stroke-slate-700/80 stroke-[0.8] hover:stroke-slate-500 transition-colors"
        />

        {/* Maritime Exclusive Economic Zone Boundary (Dotted) */}
        <path
          d="M 20 85 Q 50 100 85 80"
          fill="none"
          stroke="#1e293b"
          strokeWidth="0.6"
          strokeDasharray="2,2"
        />

        {/* Live Active Hazard Event Pulsing Anchors */}
        {events.map((ev) => {
          const pt = projectCoords(ev.coordinates.lat, ev.coordinates.lon);
          const isSelected = selectedEventId === ev.event_id;
          const sevTier = SEVERITY_TIERS[ev.severity] || SEVERITY_TIERS.Watch;
          const hazardConfig = HAZARD_CONFIGS.find((h) => h.id === ev.hazard_type);
          const color = sevTier.color;

          return (
            <g
              key={ev.event_id}
              onClick={() => onSelectEvent(ev)}
              onMouseEnter={() => setHoveredEvent(ev)}
              onMouseLeave={() => setHoveredEvent(null)}
              className="cursor-pointer group"
              transform={`translate(${pt.x}, ${pt.y})`}
            >
              {/* Outer Pulsing Wave Ring */}
              <circle
                r={isSelected ? "5" : "3.5"}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? "0.8" : "0.5"}
                className="animate-ping origin-center opacity-75"
              />

              {/* Inundation / Footprint Radius Indicator */}
              <circle
                r={isSelected ? "4" : "2.6"}
                fill={color}
                fillOpacity="0.25"
                stroke={color}
                strokeWidth="0.6"
              />

              {/* Core Anchor Dot */}
              <circle
                r="1.4"
                fill={color}
                filter="url(#glow)"
              />

              {/* Event Label Tag */}
              <text
                x="2.4"
                y="0.6"
                fontSize="2.2"
                fontWeight="bold"
                fill="#f8fafc"
                className="pointer-events-none drop-shadow-md select-none font-sans"
              >
                {ev.name.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Inspection Card */}
      {hoveredEvent && (
        <div
          className="absolute z-20 top-6 right-6 p-4 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md max-w-xs animate-in fade-in zoom-in-95 pointer-events-none"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              {hoveredEvent.hazard_type} Peril
            </span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: (SEVERITY_TIERS[hoveredEvent.severity] || SEVERITY_TIERS.Watch).bg,
                color: (SEVERITY_TIERS[hoveredEvent.severity] || SEVERITY_TIERS.Watch).color,
              }}
            >
              {hoveredEvent.severity}
            </span>
          </div>
          <h4 className="text-sm font-bold text-white mb-1">{hoveredEvent.name}</h4>
          <p className="text-xs text-slate-400 mb-2">
            Target States: {hoveredEvent.affected_states.join(', ')}
          </p>
          <div className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-2 rounded border border-slate-800">
            Coordinates: {hoveredEvent.coordinates.lat.toFixed(2)}°N, {hoveredEvent.coordinates.lon.toFixed(2)}°E
          </div>
        </div>
      )}

      {/* Map Control HUD */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-1 text-slate-400">
        <button
          className="p-1.5 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Pan-India Extent Reset"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-3 bg-slate-700" />
        <span className="text-[10px] font-mono px-2 text-slate-500">
          PROJECTION: WGS84
        </span>
      </div>
    </div>
  );
};
