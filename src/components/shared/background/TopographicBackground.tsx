import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

const WIDTH = 1600;
const HEIGHT = 1000;
// Each "hill" is a set of nested wobbly rings; the phase values make every hill's outline different.
const HILLS = [
  { x: 320, y: 280, rings: 9, phase: 0.4 },
  { x: 1150, y: 650, rings: 11, phase: 2.1 },
  { x: 900, y: 180, rings: 6, phase: 4.3 },
  { x: 250, y: 860, rings: 7, phase: 1.3 },
];
const RING_GAP = 48;
const POINTS = 72;

// A closed contour whose radius wobbles with angle, so it reads as terrain rather than a circle.
function contourPath(cx: number, cy: number, radius: number, phase: number): string {
  const points = Array.from({ length: POINTS }, (_, i) => {
    const angle = (i / POINTS) * Math.PI * 2;
    const wobble = 1 + 0.14 * Math.sin(3 * angle + phase) + 0.08 * Math.sin(5 * angle + phase * 2);
    return `${(cx + Math.cos(angle) * radius * wobble).toFixed(1)},${(cy + Math.sin(angle) * radius * wobble * 0.8).toFixed(1)}`;
  });
  return `M ${points.join(' L ')} Z`;
}

const CONTOURS = HILLS.flatMap((hill) =>
  Array.from({ length: hill.rings }, (_, ring) => contourPath(hill.x, hill.y, (ring + 1) * RING_GAP, hill.phase + ring * 0.15))
);

// Faint contour lines across the screen, like a topographic map.
export default function TopographicBackground(props: BackgroundViewProps) {
  return (
    <BackgroundFrame name="topographic" {...props}>
      <svg className="topographic-background__svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid slice">
        {CONTOURS.map((d, index) => (
          <path key={index} className="topographic-background__line" d={d} />
        ))}
      </svg>
    </BackgroundFrame>
  );
}
