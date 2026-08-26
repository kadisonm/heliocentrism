'use client';

import { useEffect, useMemo, useState } from 'react';
import Grid from '../../components/grid/Grid';
import GridStatusBar from '../../components/grid/GridStatusBar';
import PageDots from '../../components/grid/PageDots';
import { ALL_BREAKPOINTS, useGridState } from '../../components/grid/useGridState';
import { usePageNavigation } from '../../components/grid/usePageNavigation';
import { useDeviceTier } from '../../components/grid/useDeviceTier';
import { clampPageIndex } from '../../lib/pageNavigation';
import TaskDragProvider from '../../components/widgets/task-list/TaskDragProvider';
import type { DashboardBreakpoint } from '../../lib/types';

export default function DashboardPage() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeBreakpoint, setActiveBreakpoint] = useState<DashboardBreakpoint>('desktop');
  const [activePageIndex, setActivePageIndex] = useState<Record<DashboardBreakpoint, number>>({
    desktop: 0,
    tablet: 0,
    mobile: 0,
  });

  const dashboard = useGridState();
  const deviceTier = useDeviceTier();

  // A phone can't usefully preview or edit the desktop layout it can't see,
  // and a tablet has no reason to touch desktop either — each device can
  // only edit its own tier and narrower ones.
  const allowedBreakpoints = useMemo<DashboardBreakpoint[]>(() => {
    if (deviceTier === 'mobile') return ['mobile'];
    if (deviceTier === 'tablet') return ['mobile', 'tablet'];
    return ['desktop', 'tablet', 'mobile'];
  }, [deviceTier]);

  useEffect(() => {
    if (!allowedBreakpoints.includes(activeBreakpoint)) {
      // Sync activeBreakpoint back into the allowed set whenever the device
      // tier changes (e.g. resizing across a breakpoint mid-edit) — land on
      // the widest tier still allowed, closest to what was selected.
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setActiveBreakpoint(allowedBreakpoints[allowedBreakpoints.length - 1]);
    }
  }, [allowedBreakpoints, activeBreakpoint]);

  const currentTier = dashboard.breakpoints[activeBreakpoint];
  const { activeIndex, current, virtualPages } = usePageNavigation(
    currentTier.pages,
    isEditMode,
    activePageIndex[activeBreakpoint] ?? 0,
    (index) => setActivePageIndex((prev) => ({ ...prev, [activeBreakpoint]: index }))
  );

  // Catches (a) a page-delete cascade shrinking a breakpoint's page count
  // while it isn't even the one being viewed, and (b) exiting edit mode
  // while on the blank page for whichever breakpoint that applies to.
  // Bails via unchanged reference, same style as setLayout's guard.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setActivePageIndex((current) => {
      let changed = false;
      const next = { ...current };
      for (const bp of ALL_BREAKPOINTS) {
        const clamped = clampPageIndex(current[bp] ?? 0, dashboard.breakpoints[bp].pages.length, isEditMode);
        if (clamped !== current[bp]) {
          next[bp] = clamped;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [dashboard.breakpoints, isEditMode]);

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-container">
        {!dashboard.isLoading && (
          <TaskDragProvider>
            <Grid
              breakpoints={dashboard.breakpoints}
              isEditMode={isEditMode}
              activeBreakpoint={activeBreakpoint}
              deviceTier={deviceTier}
              activePageIndex={activePageIndex}
              onPageIndexChange={(bp, index) => setActivePageIndex((prev) => ({ ...prev, [bp]: index }))}
              onLayoutChange={dashboard.setLayout}
              onUpdateWidget={dashboard.updateWidget}
              onRemoveWidget={dashboard.removeWidget}
              onWidgetHeightsChange={dashboard.setWidgetHeights}
              onCreatePage={dashboard.createPage}
              onMoveWidgetToPage={dashboard.moveWidgetToPage}
            />
          </TaskDragProvider>
        )}
      </div>

      {!dashboard.isLoading && (currentTier.pages.length > 1 || isEditMode) && (
        <PageDots
          pageCount={currentTier.pages.length}
          activeIndex={activeIndex}
          showBlankDot={virtualPages.length > currentTier.pages.length}
          onSelect={(index) => setActivePageIndex((prev) => ({ ...prev, [activeBreakpoint]: index }))}
        />
      )}

      <GridStatusBar
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode((current) => !current)}
        activeBreakpoint={activeBreakpoint}
        allowedBreakpoints={allowedBreakpoints}
        onBreakpointChange={setActiveBreakpoint}
        onAddWidget={(type) => {
          const pageId = current.kind === 'real' ? current.page.id : dashboard.createPage(activeBreakpoint);
          dashboard.addWidget(type, activeBreakpoint, pageId);
        }}
      />
    </div>
  );
}
