import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

interface TimelineData {
  hour: number;
  max_surge_m: number;
  max_wind_kmh: number;
  population_exposed: number;
}

interface RiskTimelineChartProps {
  data: TimelineData[];
}

export const RiskTimelineChart: React.FC<RiskTimelineChartProps> = ({ data }) => {
  if (!data || data.length === 0) return <div>No data available</div>;

  return (
    <div className="w-full h-64 bg-white rounded-lg shadow p-4 border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Forecasted Risk Timeline (Next 120h)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="hour" 
            tickFormatter={(val) => `+${val}h`} 
            stroke="#64748b" 
            fontSize={12} 
          />
          <YAxis yAxisId="left" stroke="#3b82f6" fontSize={12} domain={[0, 'auto']} />
          <YAxis yAxisId="right" orientation="right" stroke="#ef4444" fontSize={12} domain={[0, 'auto']} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
            labelFormatter={(val) => `Lead time: +${val}h`}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <ReferenceLine yAxisId="left" y={2.5} label="Severe Surge (2.5m)" stroke="#ef4444" strokeDasharray="3 3" />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="max_surge_m" 
            name="Max Surge (m)" 
            stroke="#3b82f6" 
            strokeWidth={3} 
            dot={{ r: 4 }} 
            activeDot={{ r: 6 }} 
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="max_wind_kmh" 
            name="Max Wind (km/h)" 
            stroke="#ef4444" 
            strokeWidth={3} 
            dot={{ r: 4 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
