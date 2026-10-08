import type { CSSProperties } from 'react';
import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

// x/y and size in % of the screen's shorter side (cqmin); each blob rises and falls on its own cycle.
const BLOBS = [
  { x: 18, y: 70, size: 34, tone: 'primary', seconds: 26, delay: 0 },
  { x: 62, y: 80, size: 42, tone: 'accent', seconds: 32, delay: -8 },
  { x: 40, y: 30, size: 28, tone: 'secondary', seconds: 22, delay: -14 },
  { x: 80, y: 40, size: 30, tone: 'primary', seconds: 28, delay: -4 },
  { x: 8, y: 25, size: 22, tone: 'accent', seconds: 20, delay: -11 },
  { x: 50, y: 60, size: 24, tone: 'secondary', seconds: 30, delay: -20 },
] as const;

// Big soft blobs drifting up and down, overlapping so they seem to merge and split.
export default function LavaLampBackground(props: BackgroundViewProps) {
  return (
    <BackgroundFrame name="lava-lamp" {...props}>
      {BLOBS.map((blob, index) => (
        <span
          key={index}
          className={`lava-lamp-background__blob lava-lamp-background__blob--${blob.tone}`}
          style={
            {
              '--x': `${blob.x}%`,
              '--y': `${blob.y}%`,
              '--size': `${blob.size}cqmin`,
              animationDuration: `${blob.seconds}s`,
              animationDelay: `${blob.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </BackgroundFrame>
  );
}
