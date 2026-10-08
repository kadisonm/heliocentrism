import type { CSSProperties } from 'react';
import { useSvgId } from '../hooks/useSvgId';

// Wide viewBox, cropped to fill any screen shape (preserveAspectRatio="slice"); the sun sits low and right of centre.
const SUN = { x: 1050, y: 700 };
// Tilted rings: ry is a fraction of rx so they read as orbits seen at an angle.
const TILT = 0.38;
const RINGS = [
  { rx: 220, seconds: 70, tone: 'accent' },
  { rx: 380, seconds: 120, tone: 'primary' },
  { rx: 560, seconds: 180, tone: 'accent' },
  { rx: 780, seconds: 260, tone: 'primary' },
] as const;

// Ellipse around the sun traced from its top point — shared by each ring and its planet's offset-path.
function ringPath(rx: number): string {
  const ry = rx * TILT;
  return `M ${SUN.x},${SUN.y - ry} A ${rx},${ry} 0 1 1 ${SUN.x - 0.01},${SUN.y - ry} Z`;
}

// Faint tilted orbits with slow planets around a soft sun glow.
export default function OrbitsScene() {
  const glowId = useSvgId('orbits-glow');

  return (
    <svg
      className="orbits-scene"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0%" className="orbits-scene__glow-core" />
          <stop offset="100%" className="orbits-scene__glow-edge" />
        </radialGradient>
      </defs>

      <circle cx={SUN.x} cy={SUN.y} r={260} fill={`url(#${glowId})`} />
      <circle className="orbits-scene__sun" cx={SUN.x} cy={SUN.y} r={34} />

      {RINGS.map((ring, index) => {
        const d = ringPath(ring.rx);
        // A negative delay spreads the planets around their rings instead of all starting at the top.
        const planetStyle = {
          offsetPath: `path('${d}')`,
          animationDuration: `${ring.seconds}s`,
          animationDelay: `-${(ring.seconds * (index + 1)) / 5}s`,
        } as CSSProperties;
        return (
          <g key={ring.rx} className={`orbits-scene__orbit orbits-scene__orbit--${ring.tone}`}>
            <path className="orbits-scene__ring" d={d} />
            <circle className="orbits-scene__planet" r={7 + index * 2} style={planetStyle} />
          </g>
        );
      })}
    </svg>
  );
}
