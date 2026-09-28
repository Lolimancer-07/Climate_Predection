/**
 * frontend/src/components/SiteHeader.tsx
 *
 * GCS Operator Console Top Status Strip & Telemetry Ribbon.
 * Displays: Selected Storm, Data Mode (LIVE/MOCK), Provider Badge,
 * Freshness, Pipeline Status, District, WS Link, Theme Switcher,
 * Role Switcher, and Cyclone Nexus AI Copilot launcher.
 */
import React from 'react';
import { useStorm, GcsTheme } from '../context/StormContext';
import { useRole, UserRole } from './RoleGate';
import {
  Activity,
  Bot,
  Brain,
  Globe,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  Sun,
  Moon,
  Layers,
  Zap,
} from 'lucide-react';

interface SiteHeaderProps {
  onToggleSidebar?: () => void;
  wsStatus?: 'connected' | 'connecting' | 'disconnected' | 'error';
}

const ROLE_OPTIONS: UserRole[] = ['ddma_operator', 'insurer_viewer', 'admin', 'public'];
const THEME_OPTIONS: { id: GcsTheme; label: string; dotColor: string }[] = [
  { id: 'default', label: 'Deep Slate', dotColor: '#38bdf8' },
  { id: 'ice', label: 'Ice Blue', dotColor: '#8dd8f5' },
  { id: 'emerald', label: 'Emerald Tactical', dotColor: '#65e6a2' },
  { id: 'amber', label: 'Amber Alert', dotColor: '#f0b75a' },
];

export function SiteHeader({ onToggleSidebar, wsStatus = 'connected' }: SiteHeaderProps) {
  const {
    activeStorm,
    selectedDistrict,
    setSelectedDistrict,
    theme,
    setTheme,
    isCopilotOpen,
    setIsCopilotOpen,
  } = useStorm();
  const { role, setRole } = useRole();

  const isLive = activeStorm?.data_mode === 'LIVE';

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border/70 bg-card/95 px-4 backdrop-blur-md">
      {/* ── Left: Storm & Telemetry Status ──────────────────────────── */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Toggle Navigation"
          >
            <Layers className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-foreground">
            {activeStorm?.storm_id || 'BOB07-2026'}
          </span>
          <span className="hidden text-xs text-muted-foreground md:inline">
            ({activeStorm?.name || 'Super Cyclone BOB07'})
          </span>
        </div>

        {/* Data Mode Badge */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isLive
              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          {activeStorm?.data_mode || 'MOCK / SIM'}
        </span>

        {/* Provider Badge */}
        <span className="hidden items-center gap-1 rounded border border-border/70 bg-background/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline-flex">
          <Globe className="h-3 w-3 text-sky-400" />
          {activeStorm?.provider || 'IMD / JTWC Synthetic'}
        </span>

        {/* Freshness */}
        <span className="hidden text-[10px] font-mono text-muted-foreground xl:inline">
          ● {activeStorm?.freshness_seconds ?? 12}s ago
        </span>
      </div>

      {/* ── Center: District & WS Health Ribbon ──────────────────────── */}
      <div className="hidden items-center gap-3 md:flex">
        {/* District Selector */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-xs">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">District:</span>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="cursor-pointer bg-transparent font-medium text-foreground outline-none"
          >
            <option value="IN-OD-PURI">Puri (IN-OD-PURI)</option>
            <option value="IN-OD-JAG">Jagatsinghpur (IN-OD-JAG)</option>
            <option value="IN-OD-KEN">Kendrapara (IN-OD-KEN)</option>
            <option value="IN-OD-GAN">Ganjam (IN-OD-GAN)</option>
          </select>
        </div>

        {/* Link Status */}
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
          <Radio className="h-3 w-3 animate-pulse text-emerald-400" />
          <span>10 HZ LIVE</span>
        </div>
      </div>

      {/* ── Right: Theme, Role, & AI Copilot Launcher ───────────────── */}
      <div className="flex items-center gap-2">
        {/* Theme Picker */}
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-0.5">
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-medium transition-all ${
                theme === t.id
                  ? 'bg-muted text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={`Switch to ${t.label} theme`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: t.dotColor }}
              />
              <span className="hidden sm:inline">{t.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Role Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-xs">
          <Shield className="h-3 w-3 text-primary" />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="cursor-pointer bg-transparent text-[11px] font-medium text-foreground outline-none"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r} className="bg-card text-foreground">
                {r.replace('_', ' ').toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Nexus Copilot Launcher */}
        <button
          onClick={() => setIsCopilotOpen(!isCopilotOpen)}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all ${
            isCopilotOpen
              ? 'border-sky-500 bg-sky-500/20 text-sky-300 shadow-md ring-1 ring-sky-500/40'
              : 'border-sky-500/40 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20'
          }`}
          title="Open Cyclone Nexus AI Copilot"
        >
          <Brain className="h-3.5 w-3.5 animate-pulse" />
          <span className="font-bold">NEXUS</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-background animate-ping" />
        </button>
      </div>
    </header>
  );
}
