import type { BackgroundVariant } from '../../../lib/types';
import { BACKGROUND_VIEWS } from '../../shared/background/backgroundViews';

// A still thumbnail of a page background: the real background, contained in the swatch and paused.
export default function BackgroundSwatch({ variant }: { variant: BackgroundVariant }) {
  const View = BACKGROUND_VIEWS[variant];
  return (
    <span className={`background-swatch background-swatch--${variant}`}>
      {View && <View contained paused />}
    </span>
  );
}
