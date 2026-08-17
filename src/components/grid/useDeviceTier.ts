'use client';

import { useEffect, useState } from 'react';
import { getBreakpointForWidth } from '../../lib/gridConfig';
import type { DashboardBreakpoint } from '../../lib/types';

// Tracks which breakpoint tier the browser's actual viewport currently
// falls into — distinct from the grid's `activeBreakpoint`, which in edit
// mode can be manually switched to preview a different tier. Used to
// restrict which tiers are editable from a given device (e.g. a phone has
// no way to preview or usefully edit the desktop layout).
export function useDeviceTier(): DashboardBreakpoint {
  // Defaults to 'desktop' during SSR/first render (window isn't available
  // yet) — matches the server-rendered markup, then corrects on mount.
  const [tier, setTier] = useState<DashboardBreakpoint>('desktop');

  useEffect(() => {
    const updateTier = () => {
      setTier(getBreakpointForWidth(window.innerWidth));
    };

    updateTier();
    window.addEventListener('resize', updateTier);
    return () => window.removeEventListener('resize', updateTier);
  }, []);

  return tier;
}
