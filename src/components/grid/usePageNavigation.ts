'use client';

import { useCallback, useMemo } from 'react';
import { buildVirtualPages, clampPageIndex } from '../../lib/grid/pageNavigation';
import type { DashboardPage } from '../../lib/types';

// Shared by Grid.tsx (peek carousel + gestures) and page.tsx (dots +
// Add Widget targeting) — each calls this keyed on its own relevant
// breakpoint (effectiveBreakpoint vs. activeBreakpoint, same split that
// already exists between those two today).
export function usePageNavigation(
  pages: DashboardPage[],
  isEditMode: boolean,
  rawIndex: number,
  onChange: (index: number) => void
) {
  const virtualPages = useMemo(() => buildVirtualPages(pages, isEditMode), [pages, isEditMode]);
  const activeIndex = clampPageIndex(rawIndex, pages.length, isEditMode);
  const current = virtualPages[activeIndex];
  const prev = activeIndex > 0 ? virtualPages[activeIndex - 1] : null;
  const next = activeIndex < virtualPages.length - 1 ? virtualPages[activeIndex + 1] : null;

  const goToIndex = useCallback(
    (index: number) => {
      const clamped = clampPageIndex(index, pages.length, isEditMode);
      if (clamped !== activeIndex) onChange(clamped);
    },
    [pages.length, isEditMode, activeIndex, onChange]
  );

  const goToDelta = useCallback((delta: number) => goToIndex(activeIndex + delta), [goToIndex, activeIndex]);

  return { virtualPages, activeIndex, current, prev, next, goToIndex, goToDelta };
}
