import type { CSSProperties, ReactNode } from 'react';

type ProgressRingProps = {
  progress: number; // 0..1
  color?: string; // any CSS colour; defaults to the accent
  children?: ReactNode; // centred inside the ring
  ariaLabel?: string;
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Circular progress meter that scales to its container's smaller dimension.
export default function ProgressRing({ progress, color, children, ariaLabel }: ProgressRingProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <div
      className="progress-ring"
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      style={color ? ({ '--progress-ring-color': color } as CSSProperties) : undefined}
    >
      <svg className="progress-ring__svg" viewBox="0 0 100 100">
        <circle className="progress-ring__track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="progress-ring__value"
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
        />
      </svg>
      {children && <div className="progress-ring__content">{children}</div>}
    </div>
  );
}
