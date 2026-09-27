import React, { useState, useEffect } from 'react';
import { AlertTriangle, Map, Navigation } from 'lucide-react';
import { ProviderModeBadge } from '../components/ProviderModeBadge';
import { StormTrackMap } from '../components/StormTrackMap';
import { ConeConfidenceLegend } from '../components/ConeConfidenceLegend';
import { RiskTimelineChart } from '../components/RiskTimelineChart';

interface LiveStormTrackerProps {
  onNavigateToDashboard?: () => void;
}

export const LiveStormTracker: React.FC<LiveStormTrackerProps> = ({ onNavigateToDashboard }) => {
  const [activeStorms, setActiveStorms] = useState<any[]>([]);
  const [selectedStormId, setSelectedStormId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);

  useEffect(() => {
    // In a real app, fetch from /v1/storms/active
    // Using mock data for UI visualization
    setActiveStorms([
      { storm_id: 'BOB07-2026', name: 'MOCK-NILAM', basin: 'bay_of_bengal', status: 'active_forecast' }
    ]);
  }, []);

  useEffect(() => {
    if (selectedStormId) {
      // Mock fetch timeline data
      setTimelineData([
        { hour: 24, max_surge_m: 0.5, max_wind_kmh: 65, population_exposed: 1000 },
        { hour: 48, max_surge_m: 1.2, max_wind_kmh: 85, population_exposed: 50000 },
        { hour: 72, max_surge_m: 2.5, max_wind_kmh: 140, population_exposed: 200000 },
        { hour: 96, max_surge_m: 0.0, max_wind_kmh: 60, population_exposed: 5000 }
      ]);
    }
  }, [selectedStormId]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Live Storm Tracker</h1>
          <p className="text-slate-600 max-w-2xl">Real-time prediction and risk analysis for upcoming cyclones.</p>
        </div>
        <ProviderModeBadge provider="mock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Active Storms</h2>
          {activeStorms.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-500">
              No active storms in monitored basins.
            </div>
          ) : (
            activeStorms.map(storm => (
              <div 
                key={storm.storm_id} 
                onClick={() => setSelectedStormId(storm.storm_id)}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  selectedStormId === storm.storm_id 
                    ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-500' 
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900">{storm.name}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Active
                  </span>
                </div>
                <div className="text-sm text-slate-600 flex items-center space-x-4">
                  <span className="flex items-center"><Map className="w-3 h-3 mr-1"/> {storm.basin}</span>
                  <span className="flex items-center"><Navigation className="w-3 h-3 mr-1"/> {storm.storm_id}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedStormId ? (
            <>
              <div className="relative">
                <StormTrackMap stormId={selectedStormId} />
                <div className="absolute top-4 right-4 z-10">
                  <ConeConfidenceLegend />
                </div>
              </div>
              <RiskTimelineChart data={timelineData} />
              <div className="flex justify-end">
                <button 
                  onClick={onNavigateToDashboard}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Go to Historical Replay (Dashboard)
                </button>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center text-slate-500 h-full flex flex-col items-center justify-center">
              <Map className="w-12 h-12 text-slate-300 mb-4" />
              <p>Select a storm from the list to view its track and forecasted risk timeline.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
