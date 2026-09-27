/**
 * frontend/src/components/TimelineScrubber.tsx
 * T-120h to T-0h landfall timeline scrubber.
 * Changing the slider fires the scenario query at the selected offset.
 */
import React, { useCallback } from 'react';
import { Clock } from 'lucide-react';

interface TimelineScrubberProps {
  value: number;            // Hours before landfall (0 = landfall, 120 = T-120h)
  onChange: (h: number) => void;
  disabled?: boolean;
}

const MARKS = [120, 96, 72, 48, 24, 12, 6, 0];

export function TimelineScrubber({ value, onChange, disabled }: TimelineScrubberProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value)),
    [onChange]
  );

  const pct = ((120 - value) / 120) * 100;

  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4) var(--space-5)',
      border: '1px solid var(--border-subtle)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <Clock size={15} style={{ color: 'var(--color-primary)' }} />
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          Forecast Timeline
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
          color: value === 0 ? 'var(--color-danger)' : 'var(--color-primary)',
          fontWeight: 700,
        }}>
          {value === 0 ? '⚡ LANDFALL' : `T-${value}h`}
        </span>
      </div>

      {/* Slider */}
      <div style={{ position: 'relative', paddingBottom: 'var(--space-5)' }}>
        <input
          type="range"
          min={0}
          max={120}
          step={6}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          style={{
            width: '100%',
            appearance: 'none',
            height: '4px',
            borderRadius: 'var(--radius-full)',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: `linear-gradient(to right, var(--color-primary) ${pct}%, var(--border-default) ${pct}%)`,
          }}
        />

        {/* Tick marks */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between',
        }}>
          {MARKS.map((h) => (
            <button
              key={h}
              onClick={() => !disabled && onChange(h)}
              style={{
                background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '10px', color: h === value ? 'var(--color-primary)' : 'var(--text-muted)',
                fontWeight: h === value ? 700 : 400,
                fontFamily: 'var(--font-mono)',
                padding: '0 1px',
              }}
            >
              {h === 0 ? 'T0' : `-${h}`}
            </button>
          ))}
        </div>
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-primary);
          box-shadow: 0 0 8px hsla(213, 94%, 55%, 0.5);
          cursor: pointer;
          border: 2px solid var(--bg-base);
        }
      `}</style>
    </div>
  );
}
