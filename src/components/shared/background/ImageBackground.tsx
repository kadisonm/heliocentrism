'use client';

import { ImageIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useSettings } from '../settings/useSettings';
import BackgroundFrame, { type BackgroundViewProps } from './BackgroundFrame';

// The user's own image, blurred and dimmed toward the page colour so widgets stay readable.
export default function ImageBackground(props: BackgroundViewProps) {
  const { image } = useSettings().settings.background;

  if (!image.url) {
    // Nothing to show full-screen; a swatch gets a placeholder instead.
    return props.contained ? (
      <BackgroundFrame name="image" {...props}>
        <span className="image-background__placeholder">
          <ImageIcon size={18} />
        </span>
      </BackgroundFrame>
    ) : null;
  }

  const style = {
    '--bg-image': `url(${JSON.stringify(image.url)})`,
    '--bg-blur': `${image.blur}px`,
    '--bg-dim': `${image.dim}%`,
  } as CSSProperties;

  return (
    <BackgroundFrame name="image" style={style} {...props}>
      <div className="image-background__photo" />
      <div className="image-background__dim" />
    </BackgroundFrame>
  );
}
