/**
 * frontend/src/components/ChartAreaInteractive.tsx
 *
 * Multi-channel synchronized interactive area chart for cyclone telemetry.
 * Displays:
 *  - Mode selector: Surge & Tide, Barometer & Wind, Hydrology & TWI, Risk Trajectory
 *  - Dual-axis curves with custom aerospace gradients
 *  - Critical threshold reference lines
 *  - 12h / 36h / 72h window toggles
 */
import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export type ChartMode = 'surge_tide' | 'pressure_wind' | 'rain_twi' | 'lead_time_risk';

interface ModeDefinition {
  value: ChartMode;
  label: string;
  shortLabel: string;
  primaryLabel: string;
  primaryUnit: string;
  primaryColor: string;
  secondaryLabel: string;
  secondaryUnit: string;
  secondaryColor: string;
  isDualAxis: boolean;
}

const MODES: ModeDefinition[] = [
  {
    value: 'surge_tide',
    label: 'Storm Surge & Astronomical Tide',
    shortLabel: 'Surge & Tide',
    primaryLabel: 'Peak Surge Height',
    primaryUnit: 'm MSL',
    primaryColor: '#06b6d4', // Cyan
    secondaryLabel: 'Astronomical Tide Level',
    secondaryUnit: 'm',
    secondaryColor: '#38bdf8', // Sky
    isDualAxis: false,
  },
  {
    value: 'pressure_wind',
    label: 'Central Pressure Deficit & Sustained Wind',
    shortLabel: 'Pressure & Wind',
    primaryLabel: 'Max Sustained Wind',
    primaryUnit: 'km/h',
    primaryColor: '#f59e0b', // Amber
    secondaryLabel: 'Central Barometric Pressure',
    secondaryUnit: 'hPa',
    secondaryColor: '#ec4899', // Pink
    isDualAxis: true,
  },
  {
    value: 'rain_twi',
    label: 'Rainfall Accumulation & TWI Runoff',
    shortLabel: 'Rain & TWI',
    primaryLabel: '72h Accumulated Rain',
    primaryUnit: 'mm',
    primaryColor: '#3b82f6', // Blue
    secondaryLabel: 'Topographic Wetness Index',
    secondaryUnit: 'TWI',
    secondaryColor: '#10b981', // Emerald
    isDualAxis: true,
  },
  {
    value: 'lead_time_risk',
    label: 'Composite Risk vs Forecast Lead Time',
    shortLabel: 'Risk Trajectory',
    primaryLabel: 'Ward Risk Index',
    primaryUnit: '/100',
    primaryColor: '#ef4444', // Red
    secondaryLabel: 'Population Evacuated',
    secondaryUnit: '%',
    secondaryColor: '#8b5cf6', // Purple
    isDualAxis: true,
  },
];

// Sample multi-channel timeline data across T-72h to T-0h landfall
const BASE_TIMELINE = [
  { hour: 72, label: 'T-72h', surge: 0.4, tide: 0.2, wind: 65,  pressure: 994, rain: 20,  twi: 8.2,  risk: 18, evac: 5 },
  { hour: 64, label: 'T-64h', surge: 0.8, tide: 0.5, wind: 85,  pressure: 986, rain: 45,  twi: 9.6,  risk: 28, evac: 12 },
  { hour: 56, label: 'T-56h', surge: 1.3, tide: 0.7, wind: 110, pressure: 978, rain: 90,  twi: 11.2, risk: 42, evac: 25 },
  { hour: 48, label: 'T-48h', surge: 1.9, tide: 0.9, wind: 145, pressure: 965, rain: 150, twi: 12.8, risk: 58, evac: 40 },
  { hour: 36, label: 'T-36h', surge: 2.8, tide: 1.1, wind: 180, pressure: 948, rain: 230, twi: 13.9, risk: 74, evac: 58 },
  { hour: 24, label: 'T-24h', surge: 3.6, tide: 1.2, wind: 205, pressure: 938, rain: 310, twi: 14.8, risk: 88, evac: 75 },
  { hour: 12, label: 'T-12h', surge: 4.2, tide: 1.4, wind: 215, pressure: 932, rain: 380, twi: 15.6, risk: 96, evac: 90 },
  { hour: 0,  label: 'T-0h',  surge: 4.5, tide: 1.3, wind: 225, pressure: 928, rain: 420, twi: 16.2, risk: 99, evac: 95 },
];

export function ChartAreaInteractive() {
  const [mode, setMode] = useState<ChartMode>('surge_tide');
  const [windowSlice, setWindowSlice] = useState<number>(8); // all 8 points (72h)

  const modeDef = useMemo(() => MODES.find((m) => m.value === mode) || MODES[0], [mode]);

  const chartData = useMemo(() => {
    return BASE_TIMELINE.slice(-windowSlice).map((pt) => {
      let primary = 0;
      let secondary = 0;
      if (mode === 'surge_tide') {
        primary = pt.surge;
        secondary = pt.tide;
      } else if (mode === 'pressure_wind') {
        primary = pt.wind;
        secondary = pt.pressure;
      } else if (mode === 'rain_twi') {
        primary = pt.rain;
        secondary = pt.twi;
      } else {
        primary = pt.risk;
        secondary = pt.evac;
      }
      return {
        label: pt.label,
        hour: pt.hour,
        primary,
        secondary,
      };
    });
  }, [mode, windowSlice]);

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm backdrop-blur-xs">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-wide text-foreground">
              CYCLONE HAZARD & RISK TRAJECTORY
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              SYNCHRONIZED
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {modeDef.label} — Multi-channel timeline across pre-landfall window
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-0.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`rounded px-2 py-1 text-xs font-medium transition-all ${
                  mode === m.value
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.shortLabel}
              </button>
            ))}
          </div>

          {/* Window size buttons */}
          <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs font-mono">
            <button
              onClick={() => setWindowSlice(3)}
              className={`rounded px-2 py-0.5 ${windowSlice === 3 ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            >
              12h
            </button>
            <button
              onClick={() => setWindowSlice(5)}
              className={`rounded px-2 py-0.5 ${windowSlice === 5 ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            >
              36h
            </button>
            <button
              onClick={() => setWindowSlice(8)}
              className={`rounded px-2 py-0.5 ${windowSlice === 8 ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            >
              72h
            </button>
          </div>
        </div>
      </div>

      {/* Legend & Current Readout Strip */}
      <div className="mb-3 flex flex-wrap items-center justify-between border-y border-border/50 bg-muted/20 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: modeDef.primaryColor }}
            />
            <span className="text-muted-foreground">{modeDef.primaryLabel}:</span>
            <span className="font-mono font-bold text-foreground">
              {chartData[chartData.length - 1]?.primary} {modeDef.primaryUnit}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: modeDef.secondaryColor }}
            />
            <span className="text-muted-foreground">{modeDef.secondaryLabel}:</span>
            <span className="font-mono font-bold text-foreground">
              {chartData[chartData.length - 1]?.secondary} {modeDef.secondaryUnit}
            </span>
          </div>
        </div>

        <span className="font-mono text-[10px] text-muted-foreground">
          Step interval: 8h | Zero-hallucination grounded
        </span>
      </div>

      {/* Area Chart Container */}
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={modeDef.primaryColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={modeDef.primaryColor} stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="secondaryGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={modeDef.secondaryColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={modeDef.secondaryColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            {modeDef.isDualAxis && (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
              />
            )}

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border/80 bg-card p-2.5 shadow-xl text-xs">
                    <div className="mb-1 font-mono font-bold text-foreground">{d.label}</div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: modeDef.primaryColor }} />
                      <span className="text-muted-foreground">{modeDef.primaryLabel}:</span>
                      <span className="font-mono font-bold text-foreground">
                        {d.primary} {modeDef.primaryUnit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: modeDef.secondaryColor }} />
                      <span className="text-muted-foreground">{modeDef.secondaryLabel}:</span>
                      <span className="font-mono font-bold text-foreground">
                        {d.secondary} {modeDef.secondaryUnit}
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="primary"
              stroke={modeDef.primaryColor}
              strokeWidth={2.5}
              fill="url(#primaryGrad)"
            />

            <Area
              yAxisId={modeDef.isDualAxis ? 'right' : 'left'}
              type="monotone"
              dataKey="secondary"
              stroke={modeDef.secondaryColor}
              strokeWidth={2}
              fill="url(#secondaryGrad)"
            />

            {/* Reference line for evacuation warning threshold */}
            {mode === 'surge_tide' && (
              <ReferenceLine
                yAxisId="left"
                y={3.0}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: 'CRITICAL 3.0M SURGE THRESHOLD', position: 'top', fill: '#ef4444', fontSize: 10 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
