'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Grid from '../../components/grid/Grid';
import type { GridHandle } from '../../components/grid/Grid';
import PageDots from '../../components/grid/PageDots';
import { ALL_BREAKPOINTS, useGridState } from '../../components/grid/useGridState';
import { useDeviceTier } from '../../components/grid/useDeviceTier';
import { clampPageIndex } from '../../lib/grid/pageNavigation';
import TaskDragProvider from '../../components/widgets/task-list/TaskDragProvider';
import type { DashboardBreakpoint } from '../../lib/types';

export default function DashboardPage() {
  // Persists across gestures — set via Grid's canvas context menu ("Preview
  // as"), replacing the old edit-toolbar's breakpoint Tabs. null means "not
  // simulating any tier — show whatever the real device is."
  const [previewBreakpoint, setPreviewBreakpoint] = useState<DashboardBreakpoint | null>(null);
  const [activePageIndex, setActivePageIndex] = useState<Record<DashboardBreakpoint, number>>({
    desktop: 0,
    tablet: 0,
    mobile: 0,
  });

  const dashboard = useGridState();
  const deviceTier = useDeviceTier();
  const gridRef = useRef<GridHandle>(null);

  // A phone can't usefully preview the desktop layout it can't see, and a
  // tablet has no reason to touch desktop either — each device can only
  // preview its own tier and narrower ones.
  const allowedBreakpoints = useMemo<DashboardBreakpoint[]>(() => {
    if (deviceTier === 'mobile') return ['mobile'];
    if (deviceTier === 'tablet') return ['mobile', 'tablet'];
    return ['desktop', 'tablet', 'mobile'];
  }, [deviceTier]);

  useEffect(() => {
    if (previewBreakpoint !== null && !allowedBreakpoints.includes(previewBreakpoint)) {
      // The device tier changed (e.g. resizing across a breakpoint) out from
      // under a preview that's no longer allowed — stop previewing rather
      // than snapping to some other tier the user didn't ask for.
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setPreviewBreakpoint(null);
    }
  }, [allowedBreakpoints, previewBreakpoint]);

  const effectiveBreakpoint = previewBreakpoint ?? deviceTier;
  const currentTier = dashboard.breakpoints[effectiveBreakpoint];

  // Catches a page-delete cascade shrinking a breakpoint's page count while
  // it isn't even the one being viewed. The blank "new page" slot is only
  // ever reachable mid-drag now (see Grid.tsx's isDragActive/showBlankSlot,
  // entirely internal to Grid) — activePageIndex itself never legitimately
  // points past the last real page outside of that, so every breakpoint
  // clamps the same way regardless of what's happening in Grid. Bails via
  // unchanged reference, same style as setLayout's guard.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setActivePageIndex((current) => {
      let changed = false;
      const next = { ...current };
      for (const bp of ALL_BREAKPOINTS) {
        const clamped = clampPageIndex(current[bp] ?? 0, dashboard.breakpoints[bp].pages.length, false);
        if (clamped !== current[bp]) {
          next[bp] = clamped;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [dashboard.breakpoints]);

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-container">
        {!dashboard.isLoading && (
          <TaskDragProvider>
            <Grid
              ref={gridRef}
              breakpoints={dashboard.breakpoints}
              previewBreakpoint={previewBreakpoint}
              allowedBreakpoints={allowedBreakpoints}
              onPreviewBreakpointChange={setPreviewBreakpoint}
              deviceTier={deviceTier}
              activePageIndex={activePageIndex}
              onPageIndexChange={(bp, index) => setActivePageIndex((prev) => ({ ...prev, [bp]: index }))}
              onLayoutChange={dashboard.setLayout}
              onAddWidget={dashboard.addWidget}
              onUpdateWidget={dashboard.updateWidget}
              onRemoveWidget={dashboard.removeWidget}
              onWidgetHeightsChange={dashboard.setWidgetHeights}
              onCreatePage={dashboard.createPage}
              onMoveWidgetToPage={dashboard.moveWidgetToPage}
            />
          </TaskDragProvider>
        )}
      </div>

      {!dashboard.isLoading && currentTier.pages.length > 1 && (
        <PageDots
          pageCount={currentTier.pages.length}
          activeIndex={clampPageIndex(activePageIndex[effectiveBreakpoint] ?? 0, currentTier.pages.length, false)}
          showBlankDot={false}
          onSelect={(index) => {
            // A dot click is a direct, single-shot navigation gesture, same
            // as keyboard/peek-click — routed through Grid's requestPage so
            // a rapid run of clicks queues into separate animated slides
            // instead of racing Grid's own slide-settle timing and skipping
            // one (see GridHandle/usePageSlide in Grid.tsx).
            gridRef.current?.requestPage(index);
          }}
        />
      )}
    </div>
  );
}
