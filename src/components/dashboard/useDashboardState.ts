'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Layout } from 'react-grid-layout';
import { DEFAULT_DASHBOARD } from '../../lib/data';
import { DASHBOARD_COLS, DEFAULT_WIDGET_SIZE } from '../../lib/dashboardGridConfig';
import { readDashboardState, writeDashboardState } from '../../lib/firebaseSync';
import type {
  DashboardBreakpoint,
  DashboardBreakpointState,
  DashboardState,
  DashboardWidget,
} from '../../lib/types';
import { findWidgetDefinition } from '../../lib/widgetRegistry';

const ALL_BREAKPOINTS: DashboardBreakpoint[] = ['desktop', 'tablet', 'mobile'];

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

export function useDashboardState() {
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
    const w = Math.min(size.w, DASHBOARD_COLS[breakpoint]);

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

  const setWidgetType = useCallback(
    (id: string, breakpoint: DashboardBreakpoint, type: string) => {
      setBreakpoints((current) => {
        const tier = current[breakpoint];
        return {
          ...current,
          [breakpoint]: {
            ...tier,
            widgets: tier.widgets.map((widget) =>
              widget.id === id ? { ...widget, type } : widget
            ),
          },
        };
      });
    },
    []
  );

  const setLayout = useCallback((breakpoint: DashboardBreakpoint, layout: Layout) => {
    setBreakpoints((current) => ({
      ...current,
      [breakpoint]: { ...current[breakpoint], layout },
    }));
  }, []);

  return {
    breakpoints,
    isLoading,
    addWidget,
    removeWidget,
    setWidgetType,
    setLayout,
  };
}
