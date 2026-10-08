import type { CSSProperties } from 'react';
import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

const TONES = ['primary', 'accent', 'secondary'] as const;
const LIGHT_COUNT = 18;

// Deterministic scatter (golden-ratio steps) so lights are spread out and identical on every render.
const LIGHTS = Array.from({ length: LIGHT_COUNT }, (_, index) => ({
  x: (index * 61.8) % 100,
  y: (index * 37.3 + 12) % 100,
  size: 6 + ((index * 7) % 17), // cqmin
  tone: TONES[index % TONES.length],
  seconds: 14 + ((index * 5) % 13),
  delay: -((index * 3.7) % 14),
}));

// Large out-of-focus light circles floating gently, like city lights behind a camera.
export default function BokehBackground(props: BackgroundViewProps) {
  return (
    <BackgroundFrame name="bokeh" {...props}>
      {LIGHTS.map((light, index) => (
        <span
          key={index}
          className={`bokeh-background__light bokeh-background__light--${light.tone}`}
          style={
            {
              '--x': `${light.x}%`,
              '--y': `${light.y}%`,
              '--size': `${light.size}cqmin`,
              animationDuration: `${light.seconds}s`,
              animationDelay: `${light.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </BackgroundFrame>
  );
}
