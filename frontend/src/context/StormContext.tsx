/**
 * frontend/src/context/StormContext.tsx
 *
 * Global operator context: selected storm + district.
 * This is the single source of truth for "what event are we operating on?"
 * so every page reads from here instead of managing its own local state.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

export interface ActiveStorm {
  storm_id: string;
  name: string;
  basin: string;
  status: string;
  data_mode: string;
  provider?: string;
  freshness_seconds?: number;
}

export type GcsTheme = 'default' | 'ice' | 'emerald' | 'amber';

export interface DemoState {
  active: boolean;
  step: number;
  title: string;
  description: string;
}

interface StormContextValue {
  activeStorm: ActiveStorm | null;
  selectedDistrict: string;
  setActiveStorm: (storm: ActiveStorm | null) => void;
  setSelectedDistrict: (d: string) => void;
  theme: GcsTheme;
  setTheme: (t: GcsTheme) => void;
  isCopilotOpen: boolean;
  setIsCopilotOpen: (open: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  isPaused: boolean;
  togglePause: () => void;
  activeScenario: string | null;
  setActiveScenario: (sc: string | null) => void;
  demoState: DemoState;
  setDemoState: React.Dispatch<React.SetStateAction<DemoState>>;
  simLeadTime: number;
  setSimLeadTime: (hrs: number) => void;
}

const StormContext = createContext<StormContextValue | null>(null);

export function StormProvider({ children }: { children: React.ReactNode }) {
  const [activeStorm, setActiveStorm] = useState<ActiveStorm | null>({
    storm_id: 'BOB07-2026',
    name: 'Cyclone BOB07 (Super Cyclone)',
    basin: 'Bay of Bengal',
    status: 'ACTIVE_APPROACH',
    data_mode: 'MOCK',
    provider: 'IMD / JTWC Synthetic Ensembles',
    freshness_seconds: 14,
  });
  const [selectedDistrict, setSelectedDistrict] = useState<string>('IN-OD-PURI');
  const [theme, setThemeState] = useState<GcsTheme>('default');
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [simLeadTime, setSimLeadTime] = useState<number>(36);
  const [demoState, setDemoState] = useState<DemoState>({
    active: false,
    step: 1,
    title: 'Pre-Landfall Evacuation & Trigger Showcase',
    description: 'Simulating multi-stage cyclone intensification and parametric insurance evaluation.',
  });

  const setTheme = useCallback((t: GcsTheme) => {
    setThemeState(t);
    if (t === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleSetStorm = useCallback((storm: ActiveStorm | null) => {
    setActiveStorm(storm);
  }, []);

  return (
    <StormContext.Provider
      value={{
        activeStorm,
        selectedDistrict,
        setActiveStorm: handleSetStorm,
        setSelectedDistrict,
        theme,
        setTheme,
        isCopilotOpen,
        setIsCopilotOpen,
        playbackSpeed,
        setPlaybackSpeed,
        isPaused,
        togglePause,
        activeScenario,
        setActiveScenario,
        demoState,
        setDemoState,
        simLeadTime,
        setSimLeadTime,
      }}
    >
      {children}
    </StormContext.Provider>
  );
}

export function useStorm(): StormContextValue {
  const ctx = useContext(StormContext);
  if (!ctx) throw new Error('useStorm must be used inside StormProvider');
  return ctx;
}

