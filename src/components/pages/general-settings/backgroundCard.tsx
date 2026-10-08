import { Sparkles } from 'lucide-react';
import type { BackgroundOption } from '../../../lib/background';
import type { BackgroundVariant } from '../../../lib/types';
import type { OptionCard } from '../../common/OptionCardPicker';
import BackgroundSwatch from './BackgroundSwatch';

const ANIMATED_LABEL = 'Animated — this background moves';

// A background as a picker card: its live swatch, plus a sparkle badge when it's animated.
export function backgroundCard(option: BackgroundOption): OptionCard<BackgroundVariant> {
  return {
    value: option.id,
    label: option.label,
    preview: <BackgroundSwatch variant={option.id} />,
    badge: option.animated ? (
      <span role="img" aria-label={ANIMATED_LABEL} title={ANIMATED_LABEL}>
        <Sparkles size={12} aria-hidden />
      </span>
    ) : undefined,
  };
}
