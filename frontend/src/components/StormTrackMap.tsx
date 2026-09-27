import React from 'react';

// Mock component since we don't have MapView easily accessible in this environment
// In a real scenario, this would overlay onto the MapLibre GL map
export const StormTrackMap: React.FC<{ stormId: string }> = ({ stormId }) => {
  return (
    <div className="w-full h-96 bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center relative overflow-hidden">
      {/* Mock map background */}
      <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-cover bg-center"></div>
      
      {/* Mock track drawing */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M 80 80 L 60 60 L 50 40" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
        <path d="M 50 40 L 40 20 L 30 10" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
        {/* Mock Cone */}
        <path d="M 50 40 C 35 15, 65 15, 50 40 Z" fill="rgba(59, 130, 246, 0.2)" stroke="none" />
      </svg>
      
      <div className="z-10 bg-white/80 p-4 rounded-lg shadow-md text-center max-w-sm">
        <h3 className="font-bold text-slate-800">Storm Track Map ({stormId})</h3>
        <p className="text-xs text-slate-600 mt-2">
          Observed track is solid blue. Forecast track is dashed red. The shaded blue area represents the cone of uncertainty.
        </p>
      </div>
    </div>
  );
};
