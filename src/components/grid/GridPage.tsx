'use client';

import { GridLayout, verticalCompactor } from 'react-grid-layout';
import type { EventCallback, Layout } from 'react-grid-layout';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  GRID_COLS,
  GRID_CONTAINER_PADDING,
  GRID_ITEM_MARGIN,
  GRID_ROW_HEIGHT,
  DEFAULT_WIDGET_MIN_SIZE,
} from '../../lib/grid/gridConfig';
import type { DashboardBreakpoint, DashboardPage, DashboardWidget } from '../../lib/types';
import { findWidgetDefinition } from '../../lib/grid/widgetRegistry';
import WidgetShell from './WidgetShell';

const RESIZE_HANDLES: Array<'se' | 'sw'> = ['se', 'sw'];
// A widget with auto-expand on manages its own height (see WidgetShell's
// ResizeObserver) — offering only east/west handles keeps width resizing
// available without letting a manual drag fight that measurement.
const AUTO_EXPAND_RESIZE_HANDLES: Array<'e' | 'w'> = ['e', 'w'];

// Each auto-expand widget debounces its own ResizeObserver independently
// (WidgetShell), so two widgets remeasuring from the same trigger (e.g. the
// view/edit width change) can each settle a few ms apart, landing in
// separate state updates instead of one. react-grid-layout's own internal
// layout-sync effect can't cleanly reconcile against that drip of
// incremental prop changes — it can echo back a stale intermediate value,
// which gets immediately re-measured and pushed forward again, forever
// ("Maximum update depth exceeded"). Coalescing every height change that
// arrives within this window into one atomic update closes that race.
const HEIGHT_COALESCE_MS = 60;

// Forces react-grid-layout's own per-item transition off for exactly the
// next style flush, then hands it back — the toggle-a-class/reflow/
// next-frame-remove trick used wherever this file needs a layout update to
// snap instead of animate (see grid-page.scss's .grid--no-transition).
function snapGridTransition(el: HTMLDivElement | null) {
  if (!el) return;
  el.classList.add('grid--no-transition');
  void el.offsetHeight; // force a reflow so the disable actually takes effect
  const raf = requestAnimationFrame(() => el.classList.remove('grid--no-transition'));
  return () => cancelAnimationFrame(raf);
}

type GridPageProps = {
  page: DashboardPage;
  effectiveBreakpoint: DashboardBreakpoint;
  isEditMode: boolean;
  isSimulating: boolean;
  gridWidth: number;
  // Omitted => the length warning never renders (used for peek panes).
  softLimitRows?: number;
  // These take pageId so the caller (Grid.tsx) can pass a single stable,
  // breakpoint-scoped callback shared by every page, rather than a fresh
  // per-page closure every render — an unstable per-widget height callback
  // in particular would retrigger WidgetShell's ResizeObserver effect on
  // every render, and re-observing an element always fires its callback
  // once, which updates state, which re-renders, forever ("Maximum update
  // depth").
  onLayoutChange?: (pageId: string, layout: Layout) => void;
  onUpdateWidget?: (id: string, pageId: string, patch: Partial<Omit<DashboardWidget, 'id'>>) => void;
  onRemoveWidget?: (id: string, pageId: string) => void;
  onWidgetHeightsChange?: (pageId: string, patches: Array<{ id: string; h: number }>) => void;
  onDrag?: EventCallback;
  onDragStop?: EventCallback;
};

// One page's grid — extracted from what used to be the whole of Grid.tsx
// (back when a breakpoint had exactly one page). Grid.tsx now mounts one of
// these per visible page (active, and peeked neighbors while editing).
//
// Memoized because Grid.tsx re-renders on every page-nav commit/settle (and
// other unrelated state changes); without it, every mounted GridPage —
// including peek slots whose own props didn't change — would re-run its own
// render plus react-grid-layout's internal GridLayout render, at a cost that
// scales with that page's widget count. That's most noticeable leaving
// whichever page you've been actively building up while editing, since it
// tends to carry the most widgets. Relies on the same stable-reference
// contract WidgetShell already does (page/callback props keep their
// identity when nothing relevant to that slot changed).
function GridPage({
  page,
  effectiveBreakpoint,
  isEditMode,
  isSimulating,
  gridWidth,
  softLimitRows,
  onLayoutChange,
  onUpdateWidget,
  onRemoveWidget,
  onWidgetHeightsChange,
  onDrag,
  onDragStop,
}: GridPageProps) {
  const gridElRef = useRef<HTMLDivElement>(null);

  // page.id only changes when `page` itself does, which already forces a
  // full remount via Grid.tsx's `key` — so as long as the callback props
  // above are themselves stable, these stay stable across every re-render
  // of this same mounted instance.
  const handleLayoutChange = useCallback((layout: Layout) => onLayoutChange?.(page.id, layout), [onLayoutChange, page.id]);
  const handleUpdateWidget = useCallback(
    (id: string, patch: Partial<Omit<DashboardWidget, 'id'>>) => onUpdateWidget?.(id, page.id, patch),
    [onUpdateWidget, page.id]
  );
  const handleRemove = useCallback((id: string) => onRemoveWidget?.(id, page.id), [onRemoveWidget, page.id]);

  // Coalesces same-tick-ish height changes from multiple auto-expand
  // widgets into one flush (see HEIGHT_COALESCE_MS) instead of forwarding
  // each one immediately.
  const pendingHeightsRef = useRef<Map<string, number>>(new Map());
  const flushHeightsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read by the layout-settle effect below — an auto-expand patch is an
  // internal correction settling into place, not a gesture worth animating
  // (unlike a user's manual drag/resize, which still animates as normal).
  const suppressLayoutTransitionRef = useRef(false);
  const handleWidgetHeightChange = useCallback(
    (id: string, h: number) => {
      pendingHeightsRef.current.set(id, h);
      if (flushHeightsTimeoutRef.current) return;
      flushHeightsTimeoutRef.current = setTimeout(() => {
        flushHeightsTimeoutRef.current = null;
        const patches = Array.from(pendingHeightsRef.current, ([id, h]) => ({ id, h }));
        pendingHeightsRef.current.clear();
        suppressLayoutTransitionRef.current = true;
        onWidgetHeightsChange?.(page.id, patches);
      }, HEIGHT_COALESCE_MS);
    },
    [onWidgetHeightsChange, page.id]
  );
  useEffect(
    () => () => {
      if (flushHeightsTimeoutRef.current) clearTimeout(flushHeightsTimeoutRef.current);
    },
    []
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

  const gridConfig = useMemo(
    () => ({
      cols: GRID_COLS[effectiveBreakpoint],
      rowHeight: GRID_ROW_HEIGHT,
      margin: GRID_ITEM_MARGIN,
      containerPadding: GRID_CONTAINER_PADDING,
    }),
    [effectiveBreakpoint]
  );

  // minSize is injected per widget's current type (not persisted) and floors
  // h; stale layout entries for removed widgets are dropped. Explicit
  // compaction here is needed since WidgetShell's auto-expand only patches
  // the one item it measures, so this pushes items below it down to fit.
  const layout = useMemo(() => {
    const cols = GRID_COLS[effectiveBreakpoint];
    const widgetById = new Map(page.widgets.map((widget) => [widget.id, widget]));

    const withSizing = page.layout
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
  }, [page, effectiveBreakpoint]);

  // Edit/view mode toggling on the SAME page shouldn't animate every widget
  // jumping to its new layout; a drag/resize settling into place should.
  // Also keyed on gridWidth, not just isEditMode, since a width change can
  // happen without isEditMode itself changing (e.g. a window resize).
  //
  // A peek<->active role flip needs the same treatment, but is handled by
  // Grid.tsx instead (see its own snap effect) — that one has to coordinate
  // BOTH the page losing active status and the one gaining it in a single
  // shared reflow, which isn't possible from inside just one of them.
  //
  // Skipped on the very first run (a fresh mount): the whole point of this
  // toggle is to cancel a transition already in flight on an
  // already-painted element, which a just-mounted one never has.
  const hasMountedRef = useRef(false);
  useLayoutEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    return snapGridTransition(gridElRef.current);
  }, [isEditMode, gridWidth]);

  // An auto-expand height patch (see handleWidgetHeightChange above) lands
  // as an ordinary layout update as far as react-grid-layout is concerned,
  // which would otherwise animate every affected item through its own
  // transition — snap it instead, same as the mode-toggle case above.
  useLayoutEffect(() => {
    if (!suppressLayoutTransitionRef.current) return;
    suppressLayoutTransitionRef.current = false;
    return snapGridTransition(gridElRef.current);
  }, [layout]);

  const pageContentRows = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

  return (
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
        onDrag={onDrag}
        onDragStop={onDragStop}
      >
        {page.widgets.map((widget) => (
          // data-widget-id: react-grid-layout clones this div into the
          // actual positioned/transformed .react-grid-item node, so this
          // attribute lands on the element a cross-page drag (see Grid.tsx's
          // relocation ghost) needs to find and read the real screen
          // position of.
          <div key={widget.id} data-widget-id={widget.id}>
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
      {softLimitRows !== undefined && pageContentRows > softLimitRows && (
        <p className="grid-length-warning">This page is getting long — consider splitting some widgets onto a new page.</p>
      )}
    </div>
  );
}

export default memo(GridPage);
