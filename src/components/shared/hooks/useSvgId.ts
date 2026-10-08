import { useId } from 'react';

// A per-instance id usable in SVG url(#…) references — useId's punctuation isn't valid there, so it's stripped.
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
