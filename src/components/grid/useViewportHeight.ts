'use client';

import { useEffect, useState } from 'react';

// Tracks the viewport's own height, used by the page soft-length warning —
// that limit is relative to what's actually visible, not the grid's
// measured content height.
export function useViewportHeight(): number {
  // 0 during SSR/first render (window isn't available yet); callers treat
  // 0 as "not measured yet" and skip anything that depends on it.
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const updateHeight = () => setHeight(window.innerHeight);

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  return height;
}
