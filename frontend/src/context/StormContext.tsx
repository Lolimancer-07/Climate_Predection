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

interface StormContextValue {
  activeStorm: ActiveStorm | null;
  selectedDistrict: string;
  setActiveStorm: (storm: ActiveStorm | null) => void;
  setSelectedDistrict: (d: string) => void;
}

const StormContext = createContext<StormContextValue | null>(null);

export function StormProvider({ children }: { children: React.ReactNode }) {
  const [activeStorm, setActiveStorm] = useState<ActiveStorm | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('IN-OD-PURI');

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
