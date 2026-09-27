import React from 'react';
import { Info } from 'lucide-react';

export const ConeConfidenceLegend: React.FC = () => {
  return (
    <div className="bg-white/90 backdrop-blur p-3 rounded-lg border border-slate-200 shadow-sm max-w-sm">
      <div className="flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-slate-900 mb-1">Cone of Uncertainty</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            The shaded area represents the probable track of the storm center. It widens over time because long-range forecasts have lower confidence.
          </p>
          <div className="mt-2 flex items-center space-x-2 text-xs text-slate-500">
            <span className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500 block"></span>
            <span>70% historical probability area</span>
          </div>
        </div>
      </div>
    </div>
  );
};
