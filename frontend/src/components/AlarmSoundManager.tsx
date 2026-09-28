/**
 * frontend/src/components/AlarmSoundManager.tsx
 *
 * Web Audio API Annunciator for Cyclone Disaster Operations.
 * Emits subtle tactical beeps for Warning / Evacuation alerts when unmuted.
 */
import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface AlarmSoundManagerProps {
  isMuted?: boolean;
  onToggleMute?: () => void;
  alertLevel?: 'CRITICAL' | 'WARNING' | 'NOMINAL';
}

export function AlarmSoundManager({
  isMuted = true,
  onToggleMute,
  alertLevel = 'NOMINAL',
}: AlarmSoundManagerProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playBeep = (freq: number, duration: number) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // AudioContext disallowed before user gesture
    }
  };

  useEffect(() => {
    if (alertLevel === 'CRITICAL') {
      playBeep(880, 0.15);
    } else if (alertLevel === 'WARNING') {
      playBeep(660, 0.1);
    }
  }, [alertLevel]);

  return (
    <button
      onClick={onToggleMute}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
      title={isMuted ? 'Unmute Audio Annunciator' : 'Mute Audio Annunciator'}
    >
      {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-400" />}
    </button>
  );
}
