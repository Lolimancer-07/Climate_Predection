/**
 * frontend/src/components/StormTrackMap.tsx
 *
 * Real-time dynamic cyclone track map component.
 * Fetches observed fixes, forecast trajectory, and uncertainty cone from backend APIs:
 *   - /v1/storms/{id}/track?fix_type=observed
 *   - /v1/storms/{id}/track?fix_type=forecast
 *   - /v1/storms/{id}/cone
 *
 * Renders data-driven SVG geometry with dynamic coordinate projection,
 * uncertainty cone, hover/click fix telemetry HUD, and tactical GIS styling.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Compass, Wind, Gauge, Calendar, ShieldAlert } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface TrackFix {
  lat: number;
  lon: number;
  timestamp?: string;
  central_pressure_hpa?: number;
  max_wind_kmh?: number;
  category?: string;
  fix_type?: 'observed' | 'forecast';
}

interface TrackGeoJSON {
  type: string;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: [number, number];
    };
    properties: TrackFix;
  }>;
  metadata?: {
    storm_id?: string;
    fix_type?: string;
    data_mode?: string;
    source?: string;
  };
}

interface ConeGeoJSON {
  type: string;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: number[][][];
    };
    properties?: Record<string, unknown>;
  }>;
}

export const StormTrackMap: React.FC<{ stormId: string }> = ({ stormId }) => {
  const [selectedFix, setSelectedFix] = useState<TrackFix | null>(null);
  const [hoveredFix, setHoveredFix] = useState<TrackFix | null>(null);

  // 1. Fetch observed track
  const { data: observedData, isLoading: observedLoading } = useQuery<TrackGeoJSON>({
    queryKey: ['storm-track', stormId, 'observed'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/storms/${stormId}/track?fix_type=observed`);
      if (!res.ok) throw new Error(`Track fetch failed: ${res.statusText}`);
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!stormId,
  });

  // 2. Fetch forecast track
  const { data: forecastData } = useQuery<TrackGeoJSON>({
    queryKey: ['storm-track', stormId, 'forecast'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/storms/${stormId}/track?fix_type=forecast`);
      if (!res.ok) throw new Error(`Forecast track fetch failed: ${res.statusText}`);
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!stormId,
  });

  // 3. Fetch cone of uncertainty
  const { data: coneData } = useQuery<ConeGeoJSON>({
    queryKey: ['storm-cone', stormId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/v1/storms/${stormId}/cone`);
      if (!res.ok) throw new Error(`Cone fetch failed: ${res.statusText}`);
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!stormId,
  });

  // Extract all points for bounds calculation
  const observedFixes = useMemo(() => {
    if (!observedData?.features) return [];
    return observedData.features
      .filter((f) => f.geometry?.type === 'Point')
      .map((f) => ({
        ...f.properties,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        fix_type: 'observed' as const,
      }));
  }, [observedData]);

  const forecastFixes = useMemo(() => {
    if (!forecastData?.features) return [];
    return forecastData.features
      .filter((f) => f.geometry?.type === 'Point')
      .map((f) => ({
        ...f.properties,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        fix_type: 'forecast' as const,
      }));
  }, [forecastData]);

  // Compute dynamic bounding box with padding
  const bounds = useMemo(() => {
    const all = [...observedFixes, ...forecastFixes];
    if (all.length === 0) {
      return { minLon: 83.0, maxLon: 88.0, minLat: 16.0, maxLat: 21.5 };
    }
    const lons = all.map((p) => p.lon);
    const lats = all.map((p) => p.lat);
    const minLon = Math.min(...lons) - 1.2;
    const maxLon = Math.max(...lons) + 1.2;
    const minLat = Math.min(...lats) - 1.0;
    const maxLat = Math.max(...lats) + 1.0;
    return { minLon, maxLon, minLat, maxLat };
  }, [observedFixes, forecastFixes]);

  // Transform lon, lat to SVG viewbox [0, 1000] x [0, 600]
  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 600;

  const project = (lon: number, lat: number) => {
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * SVG_WIDTH;
    const y = SVG_HEIGHT - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * SVG_HEIGHT;
    return { x, y };
  };

  const activeFix = hoveredFix || selectedFix || observedFixes[observedFixes.length - 1] || null;

  // Grid line coordinates
  const gridLons = useMemo(() => {
    const lines = [];
    const start = Math.ceil(bounds.minLon);
    const end = Math.floor(bounds.maxLon);
    for (let lon = start; lon <= end; lon += 1) {
      lines.push(lon);
    }
    return lines;
  }, [bounds]);

  const gridLats = useMemo(() => {
    const lines = [];
    const start = Math.ceil(bounds.minLat);
    const end = Math.floor(bounds.maxLat);
    for (let lat = start; lat <= end; lat += 1) {
      lines.push(lat);
    }
    return lines;
  }, [bounds]);

  const getIntensityColor = (windKmh?: number) => {
    if (!windKmh) return '#38bdf8';
    if (windKmh >= 220) return '#ef4444'; // Super / Extr. Severe
    if (windKmh >= 165) return '#f97316'; // Very Severe
    if (windKmh >= 118) return '#eab308'; // Severe
    if (windKmh >= 62) return '#06b6d4';  // Cyclonic Storm
    return '#38bdf8';
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 380, background: '#070c18', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Dynamic SVG Tactical Map Canvas */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        style={{ width: '100%', height: '100%', display: 'block', background: '#080e1e' }}
      >
        <defs>
          <radialGradient id="oceanGlow" cx="60%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#0f1d38" />
            <stop offset="100%" stopColor="#060b17" />
          </radialGradient>
          <linearGradient id="coneGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.08)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0.22)" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ocean Background */}
        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#oceanGlow)" />

        {/* Longitude Grid lines */}
        {gridLons.map((lon) => {
          const { x } = project(lon, bounds.minLat);
          return (
            <g key={`lon-${lon}`}>
              <line x1={x} y1={0} x2={x} y2={SVG_HEIGHT} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 4" strokeWidth={1} />
              <text x={x + 4} y={SVG_HEIGHT - 8} fill="rgba(148,163,184,0.4)" fontSize={11} fontFamily="monospace">
                {lon}°E
              </text>
            </g>
          );
        })}

        {/* Latitude Grid lines */}
        {gridLats.map((lat) => {
          const { y } = project(bounds.minLon, lat);
          return (
            <g key={`lat-${lat}`}>
              <line x1={0} y1={y} x2={SVG_WIDTH} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 4" strokeWidth={1} />
              <text x={8} y={y - 4} fill="rgba(148,163,184,0.4)" fontSize={11} fontFamily="monospace">
                {lat}°N
              </text>
            </g>
          );
        })}

        {/* Coastline reference (Odisha / Bay of Bengal arc) */}
        <path
          d={`M ${project(84.8, 18.5).x} ${project(84.8, 18.5).y} 
             Q ${project(85.8, 19.8).x} ${project(85.8, 19.8).y} 
               ${project(87.2, 21.4).x} ${project(87.2, 21.4).y} 
             L ${project(87.2, 22.0).x} 0 L 0 0 L 0 ${SVG_HEIGHT} Z`}
          fill="rgba(16, 32, 24, 0.35)"
          stroke="rgba(34, 197, 94, 0.3)"
          strokeWidth={1.5}
        />

        {/* Uncertainty Cone polygon */}
        {coneData?.features?.[0]?.geometry?.coordinates && (
          <polygon
            points={coneData.features[0].geometry.coordinates[0]
              .map(([lon, lat]) => {
                const pt = project(lon, lat);
                return `${pt.x},${pt.y}`;
              })
              .join(' ')}
            fill="url(#coneGrad)"
            stroke="rgba(56, 189, 248, 0.45)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {/* Observed Track Line */}
        {observedFixes.length > 1 && (
          <polyline
            points={observedFixes
              .map((f) => {
                const pt = project(f.lon, f.lat);
                return `${pt.x},${pt.y}`;
              })
              .join(' ')}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
        )}

        {/* Forecast Track Line (dashed) */}
        {forecastFixes.length > 0 && observedFixes.length > 0 && (
          <polyline
            points={[
              `${project(observedFixes[observedFixes.length - 1].lon, observedFixes[observedFixes.length - 1].lat).x},${project(observedFixes[observedFixes.length - 1].lon, observedFixes[observedFixes.length - 1].lat).y}`,
              ...forecastFixes.map((f) => {
                const pt = project(f.lon, f.lat);
                return `${pt.x},${pt.y}`;
              }),
            ].join(' ')}
            fill="none"
            stroke="#7dd3fc"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            strokeLinecap="round"
            opacity={0.85}
          />
        )}

        {/* Observed Fix Markers */}
        {observedFixes.map((fix, idx) => {
          const pt = project(fix.lon, fix.lat);
          const isLatest = idx === observedFixes.length - 1;
          const isSelected = selectedFix === fix || hoveredFix === fix;
          const markerColor = getIntensityColor(fix.max_wind_kmh);

          return (
            <g
              key={`obs-${idx}`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredFix(fix)}
              onMouseLeave={() => setHoveredFix(null)}
              onClick={() => setSelectedFix(fix)}
            >
              {isLatest && (
                <circle cx={pt.x} cy={pt.y} r={16} fill="none" stroke={markerColor} strokeWidth={1.5} opacity={0.4}>
                  <animate attributeName="r" values="8;20" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 9 : isLatest ? 7 : 5}
                fill={markerColor}
                stroke="#080e1e"
                strokeWidth={2}
              />
            </g>
          );
        })}

        {/* Forecast Fix Markers */}
        {forecastFixes.map((fix, idx) => {
          const pt = project(fix.lon, fix.lat);
          const isSelected = selectedFix === fix || hoveredFix === fix;
          const markerColor = getIntensityColor(fix.max_wind_kmh);

          return (
            <g
              key={`fcst-${idx}`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredFix(fix)}
              onMouseLeave={() => setHoveredFix(null)}
              onClick={() => setSelectedFix(fix)}
            >
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 8 : 4.5}
                fill="#080e1e"
                stroke={markerColor}
                strokeWidth={2}
              />
              <circle cx={pt.x} cy={pt.y} r={2} fill={markerColor} />
            </g>
          );
        })}
      </svg>

      {/* Floating Tactical Telemetry HUD */}
      {activeFix && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 10,
            background: 'rgba(8, 14, 28, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 6,
            padding: '10px 14px',
            minWidth: 260,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 3,
                background: activeFix.fix_type === 'forecast' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                color: activeFix.fix_type === 'forecast' ? '#eab308' : '#38bdf8',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
              }}
            >
              {activeFix.fix_type} Fix
            </span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>
              {activeFix.lat.toFixed(2)}°N, {activeFix.lon.toFixed(2)}°E
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
              <Wind size={13} style={{ color: '#38bdf8' }} />
              <span>
                <strong>{activeFix.max_wind_kmh ?? 'N/A'}</strong> <small style={{ color: '#64748b' }}>km/h</small>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
              <Gauge size={13} style={{ color: '#f59e0b' }} />
              <span>
                <strong>{activeFix.central_pressure_hpa ?? 'N/A'}</strong> <small style={{ color: '#64748b' }}>hPa</small>
              </span>
            </div>
          </div>

          {activeFix.timestamp && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={11} />
              <span>{activeFix.timestamp}</span>
            </div>
          )}
        </div>
      )}

      {/* Top Header Badge */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 10,
          background: 'rgba(8, 14, 28, 0.85)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 10,
          color: '#94a3b8',
          display: 'flex',
          gap: 12,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />
          Observed ({observedFixes.length})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 2, background: '#7dd3fc' }} />
          Forecast ({forecastFixes.length})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(56, 189, 248, 0.25)', border: '1px dashed #38bdf8' }} />
          Uncertainty Cone
        </span>
      </div>

      {observedLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7, 12, 24, 0.8)' }}>
          <span style={{ fontSize: 12, color: '#38bdf8', fontFamily: 'monospace' }}>Streaming track fixes…</span>
        </div>
      )}
    </div>
  );
};
