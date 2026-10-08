import type { CSSProperties, ReactNode } from 'react';

export type BackgroundViewProps = {
  contained?: boolean; // fill the parent box (a settings swatch) instead of the whole screen
  paused?: boolean; // freeze any animation, e.g. in a swatch
};

type BackgroundFrameProps = BackgroundViewProps & {
  name: string; // adds `${name}-background` for the design's own styles
  style?: CSSProperties;
  children?: ReactNode;
};

// Shared shell for every page background — see background-frame.scss.
export default function BackgroundFrame({ name, contained = false, paused = false, style, children }: BackgroundFrameProps) {
  const className = [
    'page-background',
    `${name}-background`,
    contained && 'page-background--contained',
    paused && 'page-background--paused',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} style={style} aria-hidden="true">
      {children}
    </div>
  );
}
