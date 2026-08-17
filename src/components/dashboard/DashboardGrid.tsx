'use client';

import { Responsive, useContainerWidth } from 'react-grid-layout';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  DASHBOARD_BREAKPOINTS,
  DASHBOARD_COLS,
  DASHBOARD_PREVIEW_FRAME_CHROME,
  DASHBOARD_PREVIEW_WIDTHS,
  DEFAULT_WIDGET_MIN_SIZE,
} from '../../lib/dashboardGridConfig';
import type { DashboardBreakpoint, DashboardWidget } from '../../lib/types';
import { findWidgetDefinition } from '../../lib/widgetRegistry';
import WidgetShell from './WidgetShell';

const ALL_BREAKPOINTS: DashboardBreakpoint[] = ['desktop', 'tablet', 'mobile'];

type DashboardGridProps = {
  widgets: DashboardWidget[];
  layouts: ResponsiveLayouts<DashboardBreakpoint>;
  isEditMode: boolean;
  activeBreakpoint: DashboardBreakpoint;
  // The device's own real tier (from useDeviceTier), distinct from
  // activeBreakpoint (which in edit mode can be switched to preview a
  // *different* tier). Used to tell "genuinely simulating another device"
  // apart from "editing the tier you're actually on" — see isSimulating below.
  deviceTier: DashboardBreakpoint;
  onLayoutsChange: (layouts: ResponsiveLayouts<DashboardBreakpoint>) => void;
  onSetWidgetType: (id: string, type: string) => void;
  onRemoveWidget: (id: string) => void;
};

export default function DashboardGrid({
  widgets,
  layouts,
  isEditMode,
  activeBreakpoint,
  deviceTier,
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

  // DASHBOARD_PREVIEW_WIDTHS is a fixed number meant to simulate a device
  // other than the one actually in front of you (e.g. a desktop user
  // previewing mobile) — it has no reason to match your real viewport, and
  // on a phone (deviceTier === activeBreakpoint here, since a phone can only
  // ever edit its own tier) it often doesn't: plenty of real phones are
  // narrower than the 375px "mobile" simulation width, so the fixed-width
  // frame would overflow the actual screen. When you're editing the tier
  // you're really on, skip the simulation and use the real measured width
  // instead, same as the non-edit view already does.
  const isSimulating = isEditMode && activeBreakpoint !== deviceTier;

  // The preview frame's own padding/border add to this width rather than
  // being included in it (see DASHBOARD_PREVIEW_FRAME_CHROME) — subtract
  // them so the frame's total footprint matches the breakpoint it's meant
  // to simulate instead of overflowing past it.
  const gridWidth = isSimulating
    ? DASHBOARD_PREVIEW_WIDTHS[activeBreakpoint] - DASHBOARD_PREVIEW_FRAME_CHROME
    : width;

  // Each widget type declares its own minSize — inject it (and the current
  // breakpoint's column cap) into every layout item here rather than
  // persisting it, so it always reflects the widget's *current* type and
  // stays correct after switching a widget's type via the chrome dropdown.
  // Also floors w/h themselves, bumping up anything resized below the
  // minimum before this constraint existed.
  //
  // Also CAPS w (and re-clamps x) to the breakpoint's own column count. A
  // layout item's w/x are set relative to whichever breakpoint it was last
  // edited under (desktop's 12 cols, say) — without capping, that same w
  // gets reused verbatim on mobile's 4-col grid, rendering the widget wider
  // than the viewport instead of reflowing to fit it.
  const constrainedLayouts = useMemo(() => {
    const widgetTypeById = new Map(widgets.map((widget) => [widget.id, widget.type]));

    const next: ResponsiveLayouts<DashboardBreakpoint> = { ...layouts };
    ALL_BREAKPOINTS.forEach((breakpoint) => {
      const cols = DASHBOARD_COLS[breakpoint];
      next[breakpoint] = (layouts[breakpoint] ?? []).map((item) => {
        const type = widgetTypeById.get(item.i);
        const minSize =
          (type ? findWidgetDefinition(type)?.minSize : undefined) ?? DEFAULT_WIDGET_MIN_SIZE;
        const minW = Math.min(minSize.w, cols);
        const minH = minSize.h;

        const w = Math.min(Math.max(item.w, minW), cols);
        const x = Math.min(Math.max(item.x, 0), cols - w);

        return {
          ...item,
          minW,
          minH,
          w,
          x,
          h: Math.max(item.h, minH),
        };
      });
    });
    return next;
  }, [layouts, widgets]);

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
          className={isSimulating ? 'dashboard-grid-preview-frame' : undefined}
          style={isSimulating ? { width: gridWidth } : undefined}
        >
          <Responsive<DashboardBreakpoint>
            className="dashboard-grid"
            innerRef={gridElRef}
            layouts={constrainedLayouts}
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
