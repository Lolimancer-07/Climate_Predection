/**
 * frontend/src/App.tsx
 *
 * Cyclone Operations Digital Twin — GCS-style operator shell.
 * Layout: collapsible left sidebar + top status strip + main workspace.
 * Spec: UAV Digital Twin Reference-Aligned Implementation Plan §4.1–4.2
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RoleProvider, useRole, UserRole } from './components/RoleGate';
import { StormProvider, useStorm } from './context/StormContext';

// ── Pages ────────────────────────────────────────────────────────────────────
import { OperationsOverview }    from './pages/OperationsOverview';
import { LiveStormTracker }      from './pages/LiveStormTracker';
import Dashboard                 from './pages/Dashboard';
import { HardeningPriorityPage } from './pages/HardeningPriorityPage';
import { DamageAssessmentPage }  from './pages/DamageAssessmentPage';
import { InsurerDashboard }      from './pages/InsurerDashboard';
import { HistoricalTrendsPage }  from './pages/HistoricalTrendsPage';
import AdminPanel                from './pages/AdminPanel';
import { AdvisoryReviewPage }    from './pages/AdvisoryReviewPage';
import { ModelEvidencePage }     from './pages/ModelEvidencePage';
import { ScenarioLabPage }       from './pages/ScenarioLabPage';

// ── Types ────────────────────────────────────────────────────────────────────
type Page =
  | 'overview'
  | 'live_tracker'
  | 'dashboard'
  | 'model_evidence'
  | 'scenario_lab'
  | 'advisories'
  | 'insurance'
  | 'hardening'
  | 'damage'
  | 'trends'
  | 'insurer'
  | 'admin';

interface NavItem {
  id: Page;
  label: string;
  icon: string;
  group: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  // Operational
  { id: 'overview',       label: 'Operations Overview',  icon: '⬡',  group: 'Operational', roles: ['ddma_operator','admin','insurer_viewer','public'] },
  { id: 'live_tracker',   label: 'Live Storm Tracker',   icon: '🌀', group: 'Operational', roles: ['ddma_operator','admin','insurer_viewer','public'] },
  { id: 'dashboard',      label: 'Impact Map',           icon: '🗺️', group: 'Operational', roles: ['ddma_operator','admin'] },
  // Analysis
  { id: 'model_evidence', label: 'Model Evidence',       icon: '🔬', group: 'Analysis',    roles: ['ddma_operator','admin'] },
  { id: 'scenario_lab',   label: 'Scenario Lab',         icon: '⚗️', group: 'Analysis',    roles: ['ddma_operator','admin'] },
  { id: 'trends',         label: 'Historical Trends',    icon: '📈', group: 'Analysis',    roles: ['ddma_operator','admin','insurer_viewer'] },
  // Actions
  { id: 'advisories',     label: 'Advisories & Review',  icon: '📋', group: 'Actions',     roles: ['ddma_operator','admin'] },
  { id: 'insurance',      label: 'Insurance Triggers',   icon: '💰', group: 'Actions',     roles: ['insurer_viewer','admin','ddma_operator'] },
  { id: 'hardening',      label: 'Assets & Hardening',   icon: '🛡️', group: 'Actions',     roles: ['ddma_operator','admin'] },
  { id: 'damage',         label: 'After-Action / Damage',icon: '📡', group: 'Actions',     roles: ['ddma_operator','admin'] },
  // System
  { id: 'insurer',        label: 'Insurer Dashboard',    icon: '📊', group: 'System',      roles: ['insurer_viewer','admin'] },
  { id: 'admin',          label: 'Administration',       icon: '⚙️', group: 'System',      roles: ['admin'] },
];

const ROLE_OPTIONS: UserRole[] = ['ddma_operator', 'insurer_viewer', 'admin', 'public'];

// ── Status strip helpers ─────────────────────────────────────────────────────
function DataModeBadge({ mode }: { mode: string }) {
  const isLive = mode === 'LIVE';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4, fontSize: 10,
      fontWeight: 700, letterSpacing: '0.06em',
      background: isLive ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
      color: isLive ? 'var(--color-safe)' : 'var(--color-watch)',
      border: `1px solid ${isLive ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
    }}>
      {isLive ? '●' : '◎'} {mode}
    </span>
  );
}

function WsStatusDot({ status }: { status: 'connected'|'connecting'|'disconnected'|'error' }) {
  const colors = {
    connected: 'var(--color-safe)',
    connecting: 'var(--color-watch)',
    disconnected: 'var(--color-text-muted)',
    error: 'var(--color-evacuation)',
  };
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
      background: colors[status],
      boxShadow: status === 'connected' ? `0 0 6px ${colors.connected}` : undefined,
    }} title={`WS: ${status}`} />
  );
}

// ── Main AppContent ──────────────────────────────────────────────────────────
function AppContent() {
  const [activePage, setActivePage]     = useState<Page>('overview');
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [wsStatus, setWsStatus]         = useState<'connected'|'connecting'|'disconnected'|'error'>('disconnected');
  const { role, setRole }               = useRole();
  const { activeStorm, selectedDistrict, setActiveStorm } = useStorm();

  // Fetch active storms on load to populate the storm context
  const { data: storms } = useQuery<any[]>({
    queryKey: ['storms-active'],
    queryFn: async () => {
      const r = await fetch('/api/v1/storms/active', { headers: { 'Content-Type': 'application/json' } });
      if (!r.ok) throw new Error('Failed to fetch');
      return r.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  // When the storm is first available, set it as the active storm
  useEffect(() => {
    if (storms && storms.length > 0 && !activeStorm) {
      setActiveStorm(storms[0]);
    }
  }, [storms, activeStorm, setActiveStorm]);

  // Open a WebSocket to track connection health for the status strip
  useEffect(() => {
    if (!activeStorm) return;
    setWsStatus('connecting');
    const wsBase = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000');
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket(`${wsBase}/v1/storms/ws/${activeStorm.storm_id}`);
        ws.onopen  = () => setWsStatus('connected');
        ws.onerror = () => setWsStatus('error');
        ws.onclose = () => {
          setWsStatus('disconnected');
          retryTimer = setTimeout(connect, 8_000);
        };
      } catch {
        setWsStatus('error');
      }
    };
    connect();
    return () => {
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [activeStorm?.storm_id]);

  const visibleNav = NAV_ITEMS.filter(n => n.roles.includes(role));
  const safeActivePage = visibleNav.find(n => n.id === activePage)?.id ?? visibleNav[0]?.id ?? 'overview';

  // Group nav items
  const groups = Array.from(new Set(visibleNav.map(n => n.group)));

  const renderPage = () => {
    switch (safeActivePage) {
      case 'overview':       return <OperationsOverview onNavigate={setActivePage} />;
      case 'live_tracker':   return <LiveStormTracker onNavigateToDashboard={() => setActivePage('dashboard')} />;
      case 'dashboard':      return <Dashboard />;
      case 'model_evidence': return <ModelEvidencePage />;
      case 'scenario_lab':   return <ScenarioLabPage />;
      case 'advisories':     return <AdvisoryReviewPage />;
      case 'insurance':      return <InsurerDashboard />;
      case 'hardening':      return <HardeningPriorityPage />;
      case 'damage':         return <DamageAssessmentPage />;
      case 'trends':         return <HistoricalTrendsPage />;
      case 'insurer':        return <InsurerDashboard />;
      case 'admin':          return <AdminPanel />;
      default:               return <OperationsOverview onNavigate={setActivePage} />;
    }
  };

  const S = sidebarOpen ? 220 : 52;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${S}px 1fr`,
      gridTemplateRows: '48px 32px 1fr',
      height: '100vh', width: '100vw',
      overflow: 'hidden',
      background: 'var(--color-bg)',
      fontFamily: 'var(--font-sans)',
      transition: 'grid-template-columns var(--transition-med)',
    }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        gridRow: '1 / 4', gridColumn: '1',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width var(--transition-med)',
        width: S,
      }}>
        {/* Brand header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 12px', height: 48, flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--color-sky), var(--color-indigo))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>🌀</div>
          {sidebarOpen && (
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-sky)', whiteSpace: 'nowrap' }}>
                CYCLONE AAP
              </div>
              <div style={{ fontSize: 9, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                Bay of Bengal · Coastal APAC
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: 12, padding: 4, flexShrink: 0,
            }}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Active storm/event context */}
        {sidebarOpen && activeStorm && (
          <div style={{
            margin: '8px', padding: '8px 10px',
            background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(99,102,241,0.08))',
            border: '1px solid rgba(56,189,248,0.25)',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Active Event
              </span>
              <DataModeBadge mode={activeStorm.data_mode ?? 'MOCK'} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-sky)' }}>{activeStorm.name}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{activeStorm.storm_id}</div>
          </div>
        )}
        {sidebarOpen && !activeStorm && (
          <div style={{ margin: '8px', padding: '8px 10px', background: 'var(--color-surface-2)', borderRadius: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
            No active event
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {groups.map(group => {
            const items = visibleNav.filter(n => n.group === group);
            return (
              <div key={group}>
                {sidebarOpen && (
                  <div style={{
                    padding: '8px 14px 4px',
                    fontSize: 9, fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    {group}
                  </div>
                )}
                {items.map(item => {
                  const isActive = safeActivePage === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`nav-${item.id}`}
                      onClick={() => setActivePage(item.id)}
                      title={item.label}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: sidebarOpen ? '7px 14px' : '7px 0',
                        justifyContent: sidebarOpen ? 'flex-start' : 'center',
                        background: isActive ? 'rgba(56,189,248,0.12)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        borderLeft: isActive ? '3px solid var(--color-sky)' : '3px solid transparent',
                        borderRadius: '0 6px 6px 0',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{item.icon}</span>
                      {sidebarOpen && (
                        <span style={{
                          fontSize: 12, fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--color-sky)' : 'var(--color-text-dim)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Role switcher at bottom */}
        <div style={{
          padding: '10px 12px', borderTop: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {sidebarOpen && (
            <div style={{ fontSize: 9, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Role
            </div>
          )}
          <select
            id="role-switcher"
            value={role}
            onChange={e => setRole(e.target.value as UserRole)}
            title="Switch role (UI demo only — not server-side auth)"
            style={{
              background: 'var(--color-surface-2)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', borderRadius: 6,
              padding: '4px 6px', fontSize: 10, cursor: 'pointer',
              width: '100%',
            }}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </aside>

      {/* ── Top status strip (spans all columns right of sidebar) ────────────── */}
      <header style={{
        gridRow: '1', gridColumn: '2',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px',
        background: 'rgba(8,13,26,0.96)',
        borderBottom: '1px solid var(--color-border)',
        backdropFilter: 'blur(16px)',
        zIndex: 100, flexShrink: 0,
      }}>
        {activeStorm ? (
          <>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-sky)' }}>
              🌀 {activeStorm.name}
            </span>
            <DataModeBadge mode={activeStorm.data_mode ?? 'MOCK'} />
            {activeStorm.provider && (
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                src:{activeStorm.provider}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>No active event</span>
        )}

        <span style={{ color: 'var(--color-border)', marginLeft: 4 }}>|</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          District: <span style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
            {selectedDistrict}
          </span>
        </span>

        <span style={{ color: 'var(--color-border)' }}>|</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <WsStatusDot status={wsStatus} />
          {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Offline'}
        </span>

        <div style={{ flex: 1 }} />

        {/* Page title */}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>
          {visibleNav.find(n => n.id === safeActivePage)?.label ?? ''}
        </span>
      </header>

      {/* ── Pipeline/data mode strip ────────────────────────────────────────── */}
      <div style={{
        gridRow: '2', gridColumn: '2',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        fontSize: 10, color: 'var(--color-text-muted)',
      }}>
        <span>⚠ SYNTHETIC DATA — All values are from mock/demo providers. Not for operational use.</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {new Date().toLocaleTimeString()} IST
        </span>
      </div>

      {/* ── Main workspace ───────────────────────────────────────────────────── */}
      <main style={{
        gridRow: '3', gridColumn: '2',
        overflow: 'auto', minHeight: 0,
        background: 'var(--color-bg)',
      }}>
        {renderPage()}
      </main>
    </div>
  );
}

// ── Root app with all providers ──────────────────────────────────────────────
export default function App() {
  return (
    <RoleProvider>
      <StormProvider>
        <AppContent />
      </StormProvider>
    </RoleProvider>
  );
}
