'use client';

import { Responsive, useContainerWidth } from 'react-grid-layout';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import { useLayoutEffect, useRef } from 'react';
import {
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLS,
  DASHBOARD_PREVIEW_WIDTHS,
} from '../../lib/dashboardGridConfig';
import type { DashboardBreakpoint, DashboardWidget } from '../../lib/types';
import WidgetShell from './WidgetShell';

type DashboardGridProps = {
  widgets: DashboardWidget[];
  layouts: ResponsiveLayouts<DashboardBreakpoint>;
  isEditMode: boolean;
  activeBreakpoint: DashboardBreakpoint;
  onLayoutsChange: (layouts: ResponsiveLayouts<DashboardBreakpoint>) => void;
  onSetWidgetType: (id: string, type: string) => void;
  onRemoveWidget: (id: string) => void;
};

export default function DashboardGrid({
  widgets,
  layouts,
  isEditMode,
  activeBreakpoint,
  onLayoutsChange,
  onSetWidgetType,
  onRemoveWidget,
}: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const gridElRef = useRef<HTMLDivElement>(null);

  const handleLayoutChange = (
    _layout: Layout,
    nextLayouts: ResponsiveLayouts<DashboardBreakpoint>
  ) => {
    onLayoutsChange(nextLayouts);
  };

  const gridWidth = isEditMode ? DASHBOARD_PREVIEW_WIDTHS[activeBreakpoint] : width;

  // Switching edit/view mode (or the edit-mode breakpoint) jumps every widget
  // to a new layout at once — that shouldn't animate. A manual drag/resize
  // settling into its final grid position afterward should. useLayoutEffect
  // runs synchronously after the DOM is updated but before the browser
  // paints, so disabling the transition here — before forcing a reflow and
  // re-enabling it on the next frame — suppresses the jump without ever
  // touching the settle-after-drag/resize case (which isn't triggered by
  // this effect's dependencies).
  useLayoutEffect(() => {
    const el = gridElRef.current;
    if (!el) return;

    el.classList.add('dashboard-grid--no-transition');
    void el.offsetHeight; // force a reflow so the disable actually takes effect

    const raf = requestAnimationFrame(() => {
      el.classList.remove('dashboard-grid--no-transition');
    });

    return () => cancelAnimationFrame(raf);
  }, [isEditMode, activeBreakpoint]);

  return (
    <div className="dashboard-grid-canvas" ref={containerRef}>
      {mounted && (
        <div
          className={isEditMode ? 'dashboard-grid-preview-frame' : undefined}
          style={isEditMode ? { width: gridWidth } : undefined}
        >
          <Responsive<DashboardBreakpoint>
            className="dashboard-grid"
            innerRef={gridElRef}
            layouts={layouts}
            breakpoints={DASHBOARD_BREAKPOINTS}
            cols={DASHBOARD_COLS}
            breakpoint={isEditMode ? activeBreakpoint : undefined}
            width={gridWidth}
            rowHeight={40}
            margin={[16, 16]}
            // Zero: the horizontal/vertical inset comes entirely from
            // .dashboard-container's own padding, so the grid's edge lines
            // up exactly with the nav's padding instead of stacking an
            // extra inset on top of it.
            containerPadding={[0, 0]}
            dragConfig={{ enabled: isEditMode, handle: '.widget-drag-handle' }}
            resizeConfig={{ enabled: isEditMode, handles: ['se', 'sw'] }}
            onLayoutChange={handleLayoutChange}
          >
            {widgets.map((widget) => (
              <div key={widget.id}>
                <WidgetShell
                  widget={widget}
                  isEditMode={isEditMode}
                  onSetType={onSetWidgetType}
                  onRemove={onRemoveWidget}
                />
              </div>
            ))}
          </Responsive>
        </div>
      )}
    </div>
  );
}
