'use client';

import { useEffect, useState } from 'react';
import { getBreakpointForWidth } from '../../lib/grid/gridConfig';
import type { DashboardBreakpoint } from '../../lib/types';

// Tracks the viewport's actual breakpoint tier — distinct from the grid's
// `activeBreakpoint`, which can be manually switched in edit mode. Used to
// restrict which tiers a given device can edit.
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
