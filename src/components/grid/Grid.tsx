'use client';

import { GridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  GRID_COLS,
  GRID_ITEM_MARGIN,
  GRID_PREVIEW_FRAME_CHROME,
  GRID_PREVIEW_WIDTHS,
  GRID_ROW_HEIGHT,
  DEFAULT_WIDGET_MIN_SIZE,
} from '../../lib/gridConfig';
import type { DashboardBreakpoint, DashboardBreakpointState, DashboardWidget } from '../../lib/types';
import { findWidgetDefinition } from '../../lib/widgetRegistry';
import WidgetShell from './WidgetShell';

// Zero: the horizontal/vertical inset comes entirely from the page's own
// container padding, so the grid's edge lines up with it exactly instead of
// stacking an extra inset on top.
const ITEM_CONTAINER_PADDING: [number, number] = [0, 0];
const RESIZE_HANDLES: Array<'se' | 'sw'> = ['se', 'sw'];
// A widget with auto-expand on manages its own height (see WidgetShell's
// ResizeObserver) — offering only east/west handles keeps width resizing
// available without letting a manual drag fight that measurement.
const AUTO_EXPAND_RESIZE_HANDLES: Array<'e' | 'w'> = ['e', 'w'];

type GridProps = {
  breakpoints: Record<DashboardBreakpoint, DashboardBreakpointState>;
  isEditMode: boolean;
  activeBreakpoint: DashboardBreakpoint;
  // The device's own real tier (from useDeviceTier), distinct from
  // activeBreakpoint (which in edit mode can be switched to preview a
  // *different* tier). Used to tell "genuinely simulating another device"
  // apart from "editing the tier you're actually on" — see isSimulating below.
  deviceTier: DashboardBreakpoint;
  onLayoutChange: (breakpoint: DashboardBreakpoint, layout: Layout) => void;
  onUpdateWidget: (
    id: string,
    breakpoint: DashboardBreakpoint,
    patch: Partial<Omit<DashboardWidget, 'id'>>
  ) => void;
  onRemoveWidget: (id: string, breakpoint: DashboardBreakpoint) => void;
  onWidgetHeightChange: (id: string, breakpoint: DashboardBreakpoint, h: number) => void;
};

export default function Grid({
  breakpoints,
  isEditMode,
  activeBreakpoint,
  deviceTier,
  onLayoutChange,
  onUpdateWidget,
  onRemoveWidget,
  onWidgetHeightChange,
}: GridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const gridElRef = useRef<HTMLDivElement>(null);

  // GRID_PREVIEW_WIDTHS is a fixed number meant to simulate a device other
  // than the one actually in front of you (e.g. a desktop user previewing
  // mobile) — it has no reason to match your real viewport, and on a phone
  // (deviceTier === activeBreakpoint here, since a phone can only ever edit
  // its own tier) it often doesn't: plenty of real phones are narrower than
  // the 375px "mobile" simulation width, so the fixed-width frame would
  // overflow the actual screen. When you're editing the tier you're really
  // on, skip the simulation and use the real measured width instead, same
  // as the non-edit view already does.
  const isSimulating = isEditMode && activeBreakpoint !== deviceTier;

  // Each breakpoint owns its own widgets+layout as one unit (see
  // DashboardBreakpointState) — there's no react-grid-layout component
  // here managing multiple breakpoints or transitioning between them; we
  // fully own which one to show and just swap the data wholesale. In edit
  // mode that's whichever tier is being edited; in view mode it's
  // deviceTier (window-width based, not the grid's own measured container
  // width — the container's width can itself be affected by which tier's
  // widgets are showing, e.g. via a scrollbar appearing/disappearing as
  // height changes, which would make the breakpoint choice feed back on
  // itself).
  const effectiveBreakpoint = isEditMode ? activeBreakpoint : deviceTier;
  const tier = breakpoints[effectiveBreakpoint];

  const handleLayoutChange = useCallback(
    (layout: Layout) => onLayoutChange(effectiveBreakpoint, layout),
    [onLayoutChange, effectiveBreakpoint]
  );

  const handleUpdateWidget = useCallback(
    (id: string, patch: Partial<Omit<DashboardWidget, 'id'>>) =>
      onUpdateWidget(id, effectiveBreakpoint, patch),
    [onUpdateWidget, effectiveBreakpoint]
  );

  const handleRemove = useCallback(
    (id: string) => onRemoveWidget(id, effectiveBreakpoint),
    [onRemoveWidget, effectiveBreakpoint]
  );

  const handleWidgetHeightChange = useCallback(
    (id: string, h: number) => onWidgetHeightChange(id, effectiveBreakpoint, h),
    [onWidgetHeightChange, effectiveBreakpoint]
  );

  // Stabilized so <GridLayout>'s own internal useMemos (keyed off these
  // props) actually hit instead of recomputing every render — otherwise a
  // fresh object/array here every render, even with identical values,
  // cascades into rebuilding derived grid state on every drag/resize frame.
  const dragConfig = useMemo(
    () => ({ enabled: isEditMode, handle: '.widget-drag-handle' }),
    [isEditMode]
  );
  const resizeConfig = useMemo(
    () => ({ enabled: isEditMode, handles: RESIZE_HANDLES }),
    [isEditMode]
  );

  // The preview frame's own padding/border add to this width rather than
  // being included in it (see GRID_PREVIEW_FRAME_CHROME) — subtract them so
  // the frame's total footprint matches the breakpoint it's meant to
  // simulate instead of overflowing past it.
  const gridWidth = isSimulating
    ? GRID_PREVIEW_WIDTHS[activeBreakpoint] - GRID_PREVIEW_FRAME_CHROME
    : width;

  const gridConfig = useMemo(
    () => ({
      cols: GRID_COLS[effectiveBreakpoint],
      rowHeight: GRID_ROW_HEIGHT,
      margin: GRID_ITEM_MARGIN,
      containerPadding: ITEM_CONTAINER_PADDING,
    }),
    [effectiveBreakpoint]
  );

  // Each widget type declares its own minSize — inject it into every layout
  // item here rather than persisting it, so it always reflects the widget's
  // *current* type and stays correct after switching a widget's type via
  // the chrome dropdown. Also floors h. Stale entries (leftover layout
  // items for a widget id no longer in this breakpoint's own widget list)
  // are dropped. w/x capping to the column count is left to react-grid-
  // layout's own bounds correction rather than duplicated here. A widget
  // with auto-expand on gets width-only resize handles (see
  // AUTO_EXPAND_RESIZE_HANDLES) so its own ResizeObserver-driven height
  // isn't fought by a manual corner drag.
  //
  // Compacted explicitly here (not left to GridLayout's own internal
  // prop-sync recompaction) because WidgetShell's auto-expand measurement
  // only ever patches the one item it's measuring — it has no idea what
  // sits below it. Recompacting the whole array on every change is what
  // actually pushes those items down to make room; it's a no-op once
  // everything's already settled, so this doesn't affect ordinary
  // drag/resize (which is already compacted by the time it reaches here).
  const layout = useMemo(() => {
    const cols = GRID_COLS[effectiveBreakpoint];
    const widgetById = new Map(tier.widgets.map((widget) => [widget.id, widget]));

    const withSizing = tier.layout
      .filter((item) => widgetById.has(item.i))
      .map((item) => {
        const widget = widgetById.get(item.i);
        const minSize =
          (widget ? findWidgetDefinition(widget.type)?.minSize : undefined) ??
          DEFAULT_WIDGET_MIN_SIZE;
        const minW = Math.min(minSize.w, cols);
        const minH = minSize.h;

        return {
          ...item,
          minW,
          minH,
          h: Math.max(item.h, minH),
          resizeHandles: widget?.autoExpand ? AUTO_EXPAND_RESIZE_HANDLES : undefined,
        };
      });

    return verticalCompactor.compact(withSizing, cols);
  }, [tier, effectiveBreakpoint]);

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

    el.classList.add('grid--no-transition');
    void el.offsetHeight; // force a reflow so the disable actually takes effect

    const raf = requestAnimationFrame(() => {
      el.classList.remove('grid--no-transition');
    });

    return () => cancelAnimationFrame(raf);
  }, [isEditMode, effectiveBreakpoint]);

  return (
    <div className="grid-canvas" ref={containerRef}>
      {mounted && (
        <div
          className={isSimulating ? 'grid-preview-frame' : undefined}
          style={isSimulating ? { width: gridWidth } : undefined}
        >
          <GridLayout
            className="grid"
            innerRef={gridElRef}
            layout={layout}
            gridConfig={gridConfig}
            width={gridWidth}
            dragConfig={dragConfig}
            resizeConfig={resizeConfig}
            onLayoutChange={handleLayoutChange}
          >
            {tier.widgets.map((widget) => (
              <div key={widget.id}>
                <WidgetShell
                  widget={widget}
                  isEditMode={isEditMode}
                  onUpdateWidget={handleUpdateWidget}
                  onRemove={handleRemove}
                  onHeightChange={handleWidgetHeightChange}
                />
              </div>
            ))}
          </GridLayout>
        </div>
      )}
    </div>
  );
}
