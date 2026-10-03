/**
 * frontend/src/pages/LiveStormTracker.tsx
 *
 * Default operational view. Wired to real API data.
 * - Storm selector with freshness/mode badge
 * - Map with observed/forecast track and uncertainty cone
 * - Threatened districts list
 * - Risk summary
 * - Run pipeline control
 *
 * Spec: UAV Digital Twin plan §4.2, page 2 "Live Storm Tracker"
 * Spec: §4.3 "First-screen composition"
 */
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useStorm, ActiveStorm } from '../context/StormContext';
import { StormTrackMap } from '../components/StormTrackMap';
import { RiskTimelineChart } from '../components/RiskTimelineChart';

interface LiveStormTrackerProps {
  onNavigateToDashboard?: () => void;
}

function DataModeBadge({ mode, provider }: { mode?: string; provider?: string }) {
  const m = mode ?? 'UNKNOWN';
  const isLive = m === 'LIVE';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      background: isLive ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
      color: isLive ? '#22c55e' : '#f59e0b',
      border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
    }}>
      {isLive ? '●' : '◎'} {m}
      {provider && <span style={{ opacity: 0.7, fontWeight: 400 }}> · {provider}</span>}
    </span>
  );
}

function StormCard({ storm, selected, onClick }: { storm: any; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
        background: selected
          ? 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(99,102,241,0.12))'
          : 'var(--color-surface)',
        border: selected ? '1px solid rgba(56,189,248,0.4)' : '1px solid var(--color-border)',
        transition: 'all var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: selected ? 'var(--color-sky)' : 'var(--color-text)' }}>
          🌀 {storm.name}
        </div>
        <DataModeBadge mode={storm.data_mode} provider={storm.provider} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
        {storm.storm_id}
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
        {storm.basin?.replace(/_/g, ' ')} · {storm.status?.replace(/_/g, ' ')}
      </div>
      {storm.freshness_seconds === 0 && (
        <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 4 }}>
          ⚠ Synthetic data — not a live provider
        </div>
      )}
    </div>
  );
}

export const LiveStormTracker: React.FC<LiveStormTrackerProps> = ({ onNavigateToDashboard }) => {
  const { activeStorm, setActiveStorm, selectedDistrict } = useStorm();
  const isStaticDemo = import.meta.env.VITE_STATIC_DEMO === 'true';
  const [selectedStormId, setSelectedStormId] = useState<string | null>(activeStorm?.storm_id ?? null);

  // Fetch active storms from real API
  const { data: fetchedStorms = [], isLoading: fetchedStormsLoading, isError: fetchedStormsError } = useQuery<any[]>({
    queryKey: ['storms-active'],
    queryFn: async () => {
      const r = await fetch('/api/v1/storms/active');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    staleTime: 30_000,
    retry: 1,
    enabled: !isStaticDemo,
    onSuccess: (data: any[]) => {
      if (data.length > 0 && !selectedStormId) {
        setSelectedStormId(data[0].storm_id);
        setActiveStorm(data[0]);
      }
    },
  } as any);

  const storms = isStaticDemo
    ? (activeStorm ? [{ ...activeStorm, data_mode: 'ILLUSTRATIVE', provider: 'Static preview', freshness_seconds: 0 }] : [])
    : fetchedStorms;
  const stormsLoading = !isStaticDemo && fetchedStormsLoading;
  const stormsError = !isStaticDemo && fetchedStormsError;

  // Fetch timeline for selected storm
  const { data: timelineData } = useQuery({
    queryKey: ['storm-timeline', selectedStormId],
    queryFn: async () => {
      const r = await fetch(`/api/v1/storms/${selectedStormId}/risk-timeline`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return j.timeline ?? [];
    },
    enabled: !!selectedStormId && !isStaticDemo,
    staleTime: 60_000,
  });

  // Fetch threatened districts
  const { data: threatenedData } = useQuery({
    queryKey: ['storm-threatened', selectedStormId],
    queryFn: async () => {
      const r = await fetch(`/api/v1/storms/${selectedStormId}/threatened-districts`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!selectedStormId && !isStaticDemo,
    staleTime: 60_000,
  });

  // Run pipeline mutation
  const runMutation = useMutation({
    mutationFn: async () => {
      if (isStaticDemo) throw new Error('The live pipeline is unavailable in this public preview.');
      const r = await fetch(`/api/v1/storms/${selectedStormId}/run-live-pipeline`, { method: 'POST' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  const handleSelectStorm = (storm: any) => {
    setSelectedStormId(storm.storm_id);
    setActiveStorm(storm);
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: storm selector + controls */}
      <div style={{
        width: 280, flexShrink: 0,
        background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
            Active Storms
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
            {isStaticDemo ? 'Static illustrative fixture · backend disconnected' : 'Source: mock provider · Bay of Bengal basin'}
          </div>
        </div>

        <div style={{ padding: '10px 10px', flex: 1 }}>
          {stormsLoading && (
            <div className="loading" style={{ height: 80, borderRadius: 8, marginBottom: 8 }} />
          )}
          {stormsError && (
            <div style={{
              padding: '12px', borderRadius: 8, fontSize: 11, color: '#f59e0b',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
            }}>
              ⚠ Could not reach /v1/storms/active
            </div>
          )}
          {storms.length === 0 && !stormsLoading && !stormsError && (
            <div style={{ padding: '12px', fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
              No active storms in monitored basin.
            </div>
          )}
          {storms.map((storm: any) => (
            <div key={storm.storm_id} style={{ marginBottom: 8 }}>
              <StormCard
                storm={storm}
                selected={selectedStormId === storm.storm_id}
                onClick={() => handleSelectStorm(storm)}
              />
            </div>
          ))}
        </div>

        {/* Threatened districts */}
        {threatenedData?.districts && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Threatened Districts
            </div>
            {threatenedData.districts.map((d: any) => (
              <div key={d.district_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '1px solid var(--color-border)',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text)' }}>{d.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{d.district_id}</div>
                </div>
                <span style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  background: 'rgba(249,115,22,0.15)', color: '#f97316',
                  fontWeight: 700,
                }}>
                  T-{d.earliest_impact_hour}h
                </span>
              </div>
            ))}
            {threatenedData.data_mode && (
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginTop: 6 }}>
                ◎ {threatenedData.data_mode} — spatial intersection not yet implemented
              </div>
            )}
          </div>
        )}

        {/* Run pipeline button */}
        {selectedStormId && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => runMutation.mutate()}
              disabled={isStaticDemo || runMutation.isPending}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 7, border: 'none',
                background: isStaticDemo || runMutation.isPending
                  ? 'var(--color-surface-2)'
                  : 'linear-gradient(135deg, var(--color-sky), var(--color-indigo))',
                color: isStaticDemo || runMutation.isPending ? 'var(--color-text-muted)' : 'white',
                fontSize: 12, fontWeight: 600, cursor: isStaticDemo || runMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isStaticDemo ? '◌ Pipeline unavailable in preview' : runMutation.isPending ? '⟳ Running…' : '▶ Run Pipeline'}
            </button>
            {runMutation.data && (
              <div style={{ fontSize: 10, color: 'var(--color-safe)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                Job: {runMutation.data.job_id} — {runMutation.data.status}
              </div>
            )}
            {onNavigateToDashboard && (
              <button
                onClick={onNavigateToDashboard}
                style={{
                  width: '100%', marginTop: 6, padding: '7px 0', borderRadius: 7,
                  background: 'transparent', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)', fontSize: 11, cursor: 'pointer',
                }}
              >
                Open Impact Map
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: map + timeline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {selectedStormId ? (
          <>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <StormTrackMap stormId={selectedStormId} />
              {/* Map overlay: data mode badge */}
              <div style={{
                position: 'absolute', top: 12, left: 12, zIndex: 10,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <DataModeBadge
                  mode={storms.find((s: any) => s.storm_id === selectedStormId)?.data_mode}
                  provider={storms.find((s: any) => s.storm_id === selectedStormId)?.provider}
                />
                <div style={{
                  background: 'rgba(8,13,26,0.85)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                  padding: '6px 10px', fontSize: 10, color: 'var(--color-text-muted)',
                }}>
                  <div style={{ color: 'var(--color-sky)', fontWeight: 600, marginBottom: 2 }}>Track</div>
                  <div>● Observed fixes</div>
                  <div>- - - Forecast extrapolation</div>
                  <div style={{ color: 'rgba(56,189,248,0.5)', marginTop: 2 }}>◎ Uncertainty cone (CLIPER)</div>
                </div>
              </div>
            </div>
            <div style={{
              height: 180, flexShrink: 0,
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface)', padding: '10px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Risk Timeline — T+24h to T+96h · Source: mock · SIMULATED
              </div>
              <RiskTimelineChart data={timelineData ?? []} />
            </div>
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-muted)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🌀</div>
            <div style={{ fontSize: 13 }}>Select a storm from the left panel to view its track.</div>
          </div>
        )}
      </div>
    </div>
  );
};
