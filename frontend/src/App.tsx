/**
 * frontend/src/App.tsx
 *
 * Cyclone Operations Digital Twin — Full Aerospace GCS Workstation.
 * Aligned with Lolimancer-07/UAV_Digital_Twin console architecture:
 *  - Collapsible left sidebar with telemetry context, active bar indicators,
 *    operational groups, and dedicated Cyclone Nexus Copilot trigger
 *  - Top status strip (SiteHeader) with data mode, provider, WS health,
 *    district, role switcher, and theme switcher
 *  - GcsMissionStatusBar with multi-parameter telemetry HUD ribbon
 *  - Main workspace routing 12 operational views
 *  - Persistent bottom CommandDock with scenario injection, sim speed,
 *    playback controls, and scripted demo runner
 *  - Dedicated sliding Cyclone Nexus AI Copilot right panel
 *  - BackendGate radar sweep connection overlay
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RoleProvider, useRole, UserRole } from './components/RoleGate';
import { StormProvider, useStorm } from './context/StormContext';
import { Toaster } from 'sonner';

// ── Shared GCS Components ──────────────────────────────────────────────────
import { SiteHeader } from './components/SiteHeader';
import { CommandDock } from './components/CommandDock';
import { GcsMissionStatusBar } from './components/GcsMissionStatusBar';
import { AICopilotRightPanel } from './components/AICopilotRightPanel';
import { BackendGate } from './components/BackendGate';
import { AlarmSoundManager } from './components/AlarmSoundManager';
import { TelemetryFdrMonitor } from './components/TelemetryFdrMonitor';

// ── Pages ──────────────────────────────────────────────────────────────────
import { OperationsOverview }    from './pages/OperationsOverview';
import { LiveStormTracker }      from './pages/LiveStormTracker';
import { NationalOverview }      from './pages/NationalOverview';
import Dashboard                 from './pages/Dashboard';
import { HardeningPriorityPage } from './pages/HardeningPriorityPage';
import { DamageAssessmentPage }  from './pages/DamageAssessmentPage';
import { InsurerDashboard }      from './pages/InsurerDashboard';
import { HistoricalTrendsPage }  from './pages/HistoricalTrendsPage';
import AdminPanel                from './pages/AdminPanel';
import { AdvisoryReviewPage }    from './pages/AdvisoryReviewPage';
import { ModelEvidencePage }     from './pages/ModelEvidencePage';
import { ScenarioLabPage }       from './pages/ScenarioLabPage';
import StaticPublicDemo          from './pages/StaticPublicDemo';

// ── Icons ──────────────────────────────────────────────────────────────────
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  Camera,
  ChevronLeft,
  ChevronRight,
  Database,
  FileCheck,
  FileText,
  Gauge,
  Globe2,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Map,
  Radio,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

export type Page =
  | 'national_overview'
  | 'overview'
  | 'live_tracker'
  | 'dashboard'
  | 'telemetry_fdr'
  | 'model_evidence'
  | 'scenario_lab'
  | 'advisories'
  | 'insurance'
  | 'hardening'
  | 'damage'
  | 'trends'
  | 'admin';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  group: 'Operations' | 'Actions & Response' | 'Intelligence & System';
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  // Operations
  { id: 'national_overview',label: 'National Multi-Hazard', icon: <Globe2 className="h-4 w-4 text-blue-400" />, group: 'Operations', roles: ['ddma_operator','admin','insurer_viewer','public'] },
  { id: 'overview',       label: 'District Digital Twin', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Operations', roles: ['ddma_operator','admin','insurer_viewer','public'] },
  { id: 'live_tracker',   label: 'Live Storm Tracker',    icon: <Radio className="h-4 w-4" />,           group: 'Operations', roles: ['ddma_operator','admin','insurer_viewer','public'] },
  { id: 'dashboard',      label: 'Impact Map & Inundation',icon: <Map className="h-4 w-4" />,             group: 'Operations', roles: ['ddma_operator','admin'] },
  { id: 'telemetry_fdr',  label: 'Telemetry FDR & Sniffer',icon: <Database className="h-4 w-4" />,        group: 'Operations', roles: ['ddma_operator','admin','insurer_viewer'] },
  { id: 'model_evidence', label: 'Model Evidence & Proof',icon: <FileCheck className="h-4 w-4" />,       group: 'Operations', roles: ['ddma_operator','admin'] },
  { id: 'scenario_lab',   label: 'Scenario Lab (What-If)',icon: <Sliders className="h-4 w-4" />,         group: 'Operations', roles: ['ddma_operator','admin'] },

  // Actions & Response
  { id: 'advisories',     label: 'Advisories & HITL Review',icon: <FileText className="h-4 w-4" />,       group: 'Actions & Response', roles: ['ddma_operator','admin'] },
  { id: 'insurance',      label: 'Parametric Triggers',    icon: <Zap className="h-4 w-4" />,            group: 'Actions & Response', roles: ['insurer_viewer','admin','ddma_operator'] },
  { id: 'hardening',      label: 'Assets & Hardening',    icon: <Shield className="h-4 w-4" />,         group: 'Actions & Response', roles: ['ddma_operator','admin'] },
  { id: 'damage',         label: 'After-Action Damage',   icon: <Camera className="h-4 w-4" />,         group: 'Actions & Response', roles: ['ddma_operator','admin'] },

  // Intelligence & System
  { id: 'trends',         label: 'Historical Backtests',  icon: <TrendingUp className="h-4 w-4" />,     group: 'Intelligence & System', roles: ['ddma_operator','admin','insurer_viewer'] },
  { id: 'admin',          label: 'Administration & RBAC', icon: <Settings className="h-4 w-4" />,       group: 'Intelligence & System', roles: ['admin'] },
];

function AppContent() {
  const [activePage, setActivePage] = useState<Page>('national_overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [wsStatus, setWsStatus] = useState<'connected'|'connecting'|'disconnected'|'error'>('connecting');
  const [audioMuted, setAudioMuted] = useState(true);

  const { role } = useRole();
  const { activeStorm, selectedDistrict, isCopilotOpen, setIsCopilotOpen } = useStorm();

  // Connect to WebSocket for telemetry stream
  useEffect(() => {
    const wsBase = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000');
    const stormId = activeStorm?.storm_id || 'BOB07-2026';
    let ws: WebSocket;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        setWsStatus('connecting');
        ws = new WebSocket(`${wsBase}/v1/storms/ws/${stormId}`);
        ws.onopen = () => setWsStatus('connected');
        ws.onerror = () => setWsStatus('error');
        ws.onclose = () => {
          setWsStatus('disconnected');
          retryTimer = setTimeout(connect, 6000);
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

  const visibleNav = NAV_ITEMS.filter((n) => n.roles.includes(role));
  const safeActivePage = visibleNav.find((n) => n.id === activePage)?.id ?? visibleNav[0]?.id ?? 'overview';

  const groups = Array.from(new Set(visibleNav.map((n) => n.group)));

  const renderPage = () => {
    switch (safeActivePage) {
      case 'national_overview': return <NationalOverview onNavigateToStorm={() => setActivePage('live_tracker')} onNavigateToDistrict={() => setActivePage('dashboard')} />;
      case 'overview':       return <OperationsOverview onNavigate={(p: string) => setActivePage(p as Page)} />;
      case 'live_tracker':   return <LiveStormTracker onNavigateToDashboard={() => setActivePage('dashboard')} />;
      case 'dashboard':      return <Dashboard />;
      case 'telemetry_fdr':  return <div className="p-6"><TelemetryFdrMonitor /></div>;
      case 'model_evidence': return <ModelEvidencePage />;
      case 'scenario_lab':   return <ScenarioLabPage />;
      case 'advisories':     return <AdvisoryReviewPage />;
      case 'insurance':      return <InsurerDashboard />;
      case 'hardening':      return <HardeningPriorityPage />;
      case 'damage':         return <DamageAssessmentPage />;
      case 'trends':         return <HistoricalTrendsPage />;
      case 'admin':          return <AdminPanel />;
      default:               return <NationalOverview onNavigateToStorm={() => setActivePage('live_tracker')} onNavigateToDistrict={() => setActivePage('dashboard')} />;
    }
  };

  const sidebarWidth = sidebarOpen ? 'w-64' : 'w-16';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ── Audio Annunciator (hidden manager) ───────────────────── */}
      <AlarmSoundManager
        isMuted={audioMuted}
        onToggleMute={() => setAudioMuted(!audioMuted)}
        alertLevel="CRITICAL"
      />

      {/* ── Top Status Strip (SiteHeader) ─────────────────────────── */}
      <SiteHeader
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        wsStatus={wsStatus}
      />

      {/* ── Mission Status Hero Ribbon ────────────────────────────── */}
      <GcsMissionStatusBar />

      {/* ── Central Stage (Sidebar + Main Viewport + AI Copilot) ─── */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* ── Collapsible Left GCS Sidebar ────────────────────────── */}
        <aside
          className={`flex shrink-0 flex-col border-r border-border/80 bg-card/95 backdrop-blur-md transition-all duration-200 ${sidebarWidth}`}
        >
          {/* Brand header */}
          <div className="flex h-12 items-center justify-between border-b border-border/60 px-3.5">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-sm">
                🛡️
              </div>
              {sidebarOpen && (
                <div className="truncate">
                  <div className="font-heading text-xs font-bold tracking-wide text-foreground">
                    KAVACH GCS
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground">
                    Anticipatory Multi-Hazard Core
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* Active Event Card in Sidebar */}
          {sidebarOpen && activeStorm && (
            <div className="m-2.5 rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-500/10 to-indigo-500/5 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Active Asset
                </span>
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-sky-300">
                  {activeStorm.data_mode}
                </span>
              </div>
              <div className="truncate text-xs font-bold text-foreground">
                {activeStorm.name}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">
                {activeStorm.storm_id} · {selectedDistrict}
              </div>
            </div>
          )}

          {/* Dedicated Nexus Copilot Trigger in Sidebar */}
          <div className="px-2 pt-1 pb-2">
            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                isCopilotOpen
                  ? 'border-sky-500 bg-sky-500/20 text-sky-300 shadow-md ring-1 ring-sky-500/40'
                  : 'border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/15'
              }`}
            >
              <Brain className="h-4 w-4 shrink-0 animate-pulse text-sky-400" />
              {sidebarOpen && (
                <>
                  <span className="font-bold">Nexus AI Copilot</span>
                  <span className="ml-auto rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-mono font-bold text-emerald-400">
                    LIVE
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Grouped Nav Items */}
          <nav className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
            {groups.map((group) => {
              const items = visibleNav.filter((n) => n.group === group);
              return (
                <div key={group} className="mb-3">
                  {sidebarOpen && (
                    <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const isActive = safeActivePage === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActivePage(item.id)}
                          className={`relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-muted text-foreground font-semibold shadow-xs'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          } ${!sidebarOpen ? 'justify-center' : ''}`}
                          title={item.label}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                          )}
                          <span className={isActive ? 'text-primary' : 'text-muted-foreground'}>
                            {item.icon}
                          </span>
                          {sidebarOpen && <span className="truncate">{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Bottom Mute & Audio Bar */}
          <div className="flex items-center justify-between border-t border-border/60 p-2.5">
            {sidebarOpen && (
              <span className="text-[10px] font-mono text-muted-foreground">
                Annunciator: {audioMuted ? 'MUTED' : 'ACTIVE'}
              </span>
            )}
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
              title={audioMuted ? 'Unmute Audio Annunciator' : 'Mute Audio Annunciator'}
            >
              {audioMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-400" />}
            </button>
          </div>
        </aside>

        {/* ── Main Workspace Scrollable Viewport ───────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-background/50 scrollbar-thin">
          <div className="animate-page-fade">
            {renderPage()}
          </div>
        </main>

        {/* ── Sliding Cyclone Nexus AI Copilot Right Panel ─────────── */}
        <AICopilotRightPanel />
      </div>

      {/* ── Persistent Bottom Command Dock ─────────────────────────── */}
      <CommandDock />
    </div>
  );
}

export default function App() {
  if (import.meta.env.VITE_STATIC_DEMO === 'true') {
    return (
      <RoleProvider>
        <StormProvider>
          <StaticPublicDemo />
          <Toaster theme="light" position="bottom-right" richColors />
        </StormProvider>
      </RoleProvider>
    );
  }

  return (
    <RoleProvider>
      <StormProvider>
        <AppContent />
        <Toaster theme="dark" position="bottom-right" richColors />
      </StormProvider>
    </RoleProvider>
  );
}
