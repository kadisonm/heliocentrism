import type { CSSProperties } from 'react';
import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

// Pixel-art shapes: '#' is a filled pixel. Kept tiny on purpose — the chunkiness is the look.
const CLOUD = ['....####......', '..########....', '.###########..', '##############', '.############.'];
const MOON = ['..####..', '.######.', '####....', '###.....', '####....', '.######.', '..####..'];

const CLOUDS = [
  { top: 18, seconds: 140, delay: 0, scale: 1 },
  { top: 34, seconds: 190, delay: -90, scale: 0.7 },
  { top: 52, seconds: 160, delay: -40, scale: 0.85 },
];

// Golden-ratio scatter so the stars look random but are identical on every render.
const STARS = Array.from({ length: 34 }, (_, index) => ({
  x: (index * 61.8) % 100,
  y: (index * 27.1) % 60,
  delay: -((index * 0.73) % 3),
}));

function PixelShape({ rows, className, style }: { rows: string[]; className: string; style?: CSSProperties }) {
  return (
    <span className={`pixel-sky-background__shape ${className}`} style={{ '--cols': rows[0].length, ...style } as CSSProperties}>
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) => <span key={`${x}-${y}`} className={cell === '#' ? 'pixel-sky-background__pixel' : undefined} />)
      )}
    </span>
  );
}

// A banded night sky with twinkling pixel stars, a pixel moon, and clouds stepping past.
export default function PixelSkyBackground(props: BackgroundViewProps) {
  return (
    <BackgroundFrame name="pixel-sky" {...props}>
      {STARS.map((star, index) => (
        <span
          key={index}
          className="pixel-sky-background__star"
          style={{ left: `${star.x}%`, top: `${star.y}%`, animationDelay: `${star.delay}s` }}
        />
      ))}
      <PixelShape rows={MOON} className="pixel-sky-background__moon" />
      {CLOUDS.map((cloud, index) => (
        <PixelShape
          key={index}
          rows={CLOUD}
          className="pixel-sky-background__cloud"
          style={
            {
              top: `${cloud.top}%`,
              '--scale': cloud.scale,
              animationDuration: `${cloud.seconds}s`,
              animationDelay: `${cloud.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </BackgroundFrame>
  );
}
