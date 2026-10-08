import type { BackgroundVariant } from '../../../lib/types';

// A still thumbnail of each page background, drawn in the current theme.
export default function BackgroundSwatch({ variant }: { variant: BackgroundVariant }) {
  return <span className={`background-swatch background-swatch--${variant}`} />;
}
