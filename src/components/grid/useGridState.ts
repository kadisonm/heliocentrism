'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { verticalCompactor, type Layout } from 'react-grid-layout';
import { DEFAULT_DASHBOARD } from '../../lib/data';
import { GRID_COLS, DEFAULT_WIDGET_SIZE } from '../../lib/gridConfig';
import { readDashboardState, writeDashboardState } from '../../lib/firebaseSync';
import type {
  DashboardBreakpoint,
  DashboardBreakpointState,
  DashboardState,
  DashboardWidget,
} from '../../lib/types';
import { findWidgetDefinition } from '../../lib/widgetRegistry';

const ALL_BREAKPOINTS: DashboardBreakpoint[] = ['desktop', 'tablet', 'mobile'];

// Item-for-item comparison on just the fields that actually affect
// position/size — ignores array order (GridLayout doesn't guarantee it's
// stable) and any extra fields react-grid-layout attaches internally
// (e.g. `moved`), which aren't meaningful for "did anything really change."
function layoutsEqual(a: Layout, b: Layout): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((item) => [item.i, item]));
  return b.every((item) => {
    const prev = byId.get(item.i);
    return !!prev && prev.x === item.x && prev.y === item.y && prev.w === item.w && prev.h === item.h;
  });
}

// Handles both shapes this predates:
//  - the original: one flat widget list shared across every breakpoint,
//    with only the per-breakpoint layout differing.
//  - the short-lived intermediate: widgets already split per breakpoint,
//    but still stored as a separate `widgets`/`layouts` pair kept in sync
//    by matching ids rather than one combined per-breakpoint unit.
// Either way, the result looks identical to what was already on screen —
// this only changes storage shape, not what the dashboard displays.
function migrateDashboardState(synced: unknown): Record<DashboardBreakpoint, DashboardBreakpointState> {
  if (!synced || typeof synced !== 'object') return DEFAULT_DASHBOARD.breakpoints;

  const data = synced as {
    breakpoints?: Partial<Record<DashboardBreakpoint, DashboardBreakpointState>>;
    widgets?: DashboardWidget[] | Partial<Record<DashboardBreakpoint, DashboardWidget[]>>;
    layouts?: Partial<Record<DashboardBreakpoint, Layout>>;
  };

  if (data.breakpoints) {
    return {
      desktop: data.breakpoints.desktop ?? DEFAULT_DASHBOARD.breakpoints.desktop,
      tablet: data.breakpoints.tablet ?? DEFAULT_DASHBOARD.breakpoints.tablet,
      mobile: data.breakpoints.mobile ?? DEFAULT_DASHBOARD.breakpoints.mobile,
    };
  }

  const widgetsByBreakpoint = Array.isArray(data.widgets)
    ? { desktop: data.widgets, tablet: data.widgets, mobile: data.widgets }
    : {
        desktop: data.widgets?.desktop ?? [],
        tablet: data.widgets?.tablet ?? [],
        mobile: data.widgets?.mobile ?? [],
      };

  return {
    desktop: { widgets: widgetsByBreakpoint.desktop, layout: data.layouts?.desktop ?? [] },
    tablet: { widgets: widgetsByBreakpoint.tablet, layout: data.layouts?.tablet ?? [] },
    mobile: { widgets: widgetsByBreakpoint.mobile, layout: data.layouts?.mobile ?? [] },
  };
}

export function useGridState() {
  const [breakpoints, setBreakpoints] = useState<
    Record<DashboardBreakpoint, DashboardBreakpointState>
  >(DEFAULT_DASHBOARD.breakpoints);
  const [isLoading, setIsLoading] = useState(true);

  // Load dashboard state on mount
  useEffect(() => {
    const loadDashboard = async () => {
      const syncedState = await readDashboardState();
      if (syncedState) {
        setBreakpoints(migrateDashboardState(syncedState));
      }
      setIsLoading(false);
    };

    loadDashboard();
  }, []);

  const hasAnyWidgets = ALL_BREAKPOINTS.some(
    (breakpoint) => breakpoints[breakpoint].widgets.length > 0
  );

  // react-grid-layout calls onLayoutChange on every drag/resize *frame*,
  // not just once at the end — without debouncing, a single drag fires
  // dozens of Firestore writes back to back. Debounce the write itself
  // (not the local state, which needs to stay instant for smooth dragging).
  const pendingWriteRef = useRef<DashboardState | null>(null);
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading || !hasAnyWidgets) return;

    pendingWriteRef.current = { breakpoints };
    if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
    writeTimeoutRef.current = setTimeout(() => {
      if (pendingWriteRef.current) {
        writeDashboardState(pendingWriteRef.current);
        pendingWriteRef.current = null;
      }
    }, 500);
  }, [breakpoints, isLoading, hasAnyWidgets]);

  // Flush any still-pending write immediately on unmount, so navigating
  // away right after a drag/resize doesn't silently drop the final
  // position under the debounce above.
  useEffect(() => {
    return () => {
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current);
        if (pendingWriteRef.current) {
          writeDashboardState(pendingWriteRef.current);
        }
      }
    };
  }, []);

  // useCallback with an empty dep array is safe here — each only touches
  // state via the setState updater form (reading `current` as an argument,
  // never closing over the outer `breakpoints`), so there's nothing
  // reactive to depend on. Stable identity matters: these get passed down
  // to every WidgetShell (React.memo'd), and a fresh function reference
  // every render would defeat that memoization on every drag/resize frame.
  const addWidget = useCallback((type: string, breakpoint: DashboardBreakpoint) => {
    const id = crypto.randomUUID();
    const size = findWidgetDefinition(type)?.defaultSize ?? DEFAULT_WIDGET_SIZE;
    const w = Math.min(size.w, GRID_COLS[breakpoint]);

    setBreakpoints((current) => {
      const tier = current[breakpoint];
      return {
        ...current,
        [breakpoint]: {
          widgets: [...tier.widgets, { id, type }],
          layout: [...tier.layout, { i: id, x: 0, y: Infinity, w, h: size.h }],
        },
      };
    });
  }, []);

  const removeWidget = useCallback((id: string, breakpoint: DashboardBreakpoint) => {
    setBreakpoints((current) => {
      const tier = current[breakpoint];
      return {
        ...current,
        [breakpoint]: {
          widgets: tier.widgets.filter((widget) => widget.id !== id),
          layout: tier.layout.filter((item) => item.i !== id),
        },
      };
    });
  }, []);

  // Generic per-instance field patch — covers type (the chrome dropdown),
  // autoExpand (the auto-expand toggle), and any widget-specific config
  // (e.g. Photo's url/alt/fit, applied together as one `photo` patch via
  // WidgetContext's onUpdate) through the same path.
  const updateWidget = useCallback(
    (id: string, breakpoint: DashboardBreakpoint, patch: Partial<Omit<DashboardWidget, 'id'>>) => {
      setBreakpoints((current) => {
        const tier = current[breakpoint];
        return {
          ...current,
          [breakpoint]: {
            ...tier,
            widgets: tier.widgets.map((widget) =>
              widget.id === id ? { ...widget, ...patch } : widget
            ),
          },
        };
      });
    },
    []
  );

  // Bails out (returns the SAME `current` reference) when the incoming
  // layout is item-for-item identical to what's already stored — this
  // matters because GridLayout can call onLayoutChange reporting a layout
  // that hasn't actually changed, most often while crossing a
  // breakpoint's column-count change (e.g. desktop's 12 cols -> tablet's
  // 8), where it re-validates every item's position/size against the new
  // grid and reports back regardless of whether anything moved. Without
  // this guard, that "no-op" notification still produces a brand new
  // `breakpoints` object every time, which re-derives a new `layout` array
  // reference for Grid.tsx's own `layout` useMemo, which GridLayout then
  // treats as a fresh prop worth re-validating all over again — an
  // infinite ping-pong between this state and GridLayout's own internal
  // layout-prop sync (surfaced as React's "Maximum update depth exceeded").
  const setLayout = useCallback((breakpoint: DashboardBreakpoint, layout: Layout) => {
    setBreakpoints((current) => {
      if (layoutsEqual(current[breakpoint].layout, layout)) return current;
      return {
        ...current,
        [breakpoint]: { ...current[breakpoint], layout },
      };
    });
  }, []);

  // Called continuously by WidgetShell's ResizeObserver while a widget's
  // auto-expand is on — patches just that one layout item's height and
  // bails out if it's already correct so a settled widget doesn't keep
  // scheduling no-op state updates (and debounced Firestore writes) on
  // every observer callback.
  //
  // Compacts and persists the result immediately, here, rather than
  // leaving that to Grid's own layout useMemo + waiting for GridLayout to
  // echo the recompacted array back through onLayoutChange — that
  // round-trip depends on GridLayout's internal prop-sync effect timing,
  // which turned out not to reliably push a widget further down when
  // there was a gap between it and the one below (the two-item push was
  // fine; anything needing compaction to also close a gap first wasn't
  // making it back into state). Compacting at the source removes that
  // dependency entirely — this is the same algorithm react-grid-layout
  // itself uses for drag/resize, so it's a no-op on an already-settled
  // layout.
  const setWidgetHeight = useCallback(
    (id: string, breakpoint: DashboardBreakpoint, h: number) => {
      setBreakpoints((current) => {
        const tier = current[breakpoint];
        const item = tier.layout.find((entry) => entry.i === id);
        if (!item || item.h === h) return current;

        const resized = tier.layout.map((entry) => (entry.i === id ? { ...entry, h } : entry));
        const compacted = verticalCompactor.compact(resized, GRID_COLS[breakpoint]);

        return {
          ...current,
          [breakpoint]: { ...tier, layout: compacted },
        };
      });
    },
    []
  );

  return {
    breakpoints,
    isLoading,
    addWidget,
    removeWidget,
    updateWidget,
    setLayout,
    setWidgetHeight,
  };
}
