import type { CSSProperties } from 'react';

type ProgressBarProps = {
  progress: number; // 0..1
  color?: string; // any CSS colour; defaults to the accent
  marker?: number | null; // 0..1 — optional tick, e.g. where you "should" be by now
  ariaLabel?: string;
};

// Horizontal progress meter with an optional reference tick.
export default function ProgressBar({ progress, color, marker = null, ariaLabel }: ProgressBarProps) {
  const clamp = (value: number) => Math.min(Math.max(value, 0), 1) * 100;

  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp(progress))}
      style={color ? ({ '--progress-bar-color': color } as CSSProperties) : undefined}
    >
      <div className="progress-bar__fill" style={{ width: `${clamp(progress)}%` }} />
      {marker !== null && <div className="progress-bar__marker" style={{ left: `${clamp(marker)}%` }} aria-hidden />}
    </div>
  );
}
