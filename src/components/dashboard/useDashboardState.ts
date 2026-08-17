'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResponsiveLayouts } from 'react-grid-layout';
import { DEFAULT_DASHBOARD } from '../../lib/data';
import { DASHBOARD_COLS, DEFAULT_WIDGET_SIZE } from '../../lib/dashboardGridConfig';
import { readDashboardState, writeDashboardState } from '../../lib/firebaseSync';
import type { DashboardBreakpoint, DashboardWidget } from '../../lib/types';
import { findWidgetDefinition } from '../../lib/widgetRegistry';

const ALL_BREAKPOINTS: DashboardBreakpoint[] = ['desktop', 'tablet', 'mobile'];

export function useDashboardState() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_DASHBOARD.widgets);
  const [layouts, setLayouts] = useState<ResponsiveLayouts<DashboardBreakpoint>>(
    DEFAULT_DASHBOARD.layouts
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load dashboard state on mount
  useEffect(() => {
    const loadDashboard = async () => {
      const syncedState = await readDashboardState();
      if (syncedState) {
        // Defensive: data saved before the `panels` -> `widgets` field rename
        // won't have `widgets` at all — fall back rather than crash on it.
        setWidgets(syncedState.widgets ?? DEFAULT_DASHBOARD.widgets);
        setLayouts(syncedState.layouts ?? DEFAULT_DASHBOARD.layouts);
      }
      setIsLoading(false);
    };

    loadDashboard();
  }, []);

  // react-grid-layout calls onLayoutChange on every drag/resize *frame*,
  // not just once at the end — without debouncing, a single drag fires
  // dozens of Firestore writes back to back. Debounce the write itself
  // (not the local state, which needs to stay instant for smooth dragging).
  const pendingWriteRef = useRef<{
    widgets: DashboardWidget[];
    layouts: ResponsiveLayouts<DashboardBreakpoint>;
  } | null>(null);
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading || widgets.length === 0) return;

    pendingWriteRef.current = { widgets, layouts };
    if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
    writeTimeoutRef.current = setTimeout(() => {
      if (pendingWriteRef.current) {
        writeDashboardState(pendingWriteRef.current);
        pendingWriteRef.current = null;
      }
    }, 500);
  }, [widgets, layouts, isLoading]);

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
  // never closing over the outer `widgets`/`layouts`), so there's nothing
  // reactive to depend on. Stable identity matters: these get passed down
  // to every WidgetShell (React.memo'd), and a fresh function reference
  // every render would defeat that memoization on every drag/resize frame.
  const addWidget = useCallback((type: string) => {
    const id = crypto.randomUUID();
    const size = findWidgetDefinition(type)?.defaultSize ?? DEFAULT_WIDGET_SIZE;

    setWidgets((current) => [...current, { id, type }]);
    setLayouts((current) => {
      const next: ResponsiveLayouts<DashboardBreakpoint> = { ...current };
      ALL_BREAKPOINTS.forEach((breakpoint) => {
        const w = Math.min(size.w, DASHBOARD_COLS[breakpoint]);
        next[breakpoint] = [
          ...(current[breakpoint] ?? []),
          { i: id, x: 0, y: Infinity, w, h: size.h },
        ];
      });
      return next;
    });
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
    setLayouts((current) => {
      const next: ResponsiveLayouts<DashboardBreakpoint> = { ...current };
      ALL_BREAKPOINTS.forEach((breakpoint) => {
        next[breakpoint] = (current[breakpoint] ?? []).filter((item) => item.i !== id);
      });
      return next;
    });
  }, []);

  const setWidgetType = useCallback((id: string, type: string) => {
    setWidgets((current) =>
      current.map((widget) => (widget.id === id ? { ...widget, type } : widget))
    );
  }, []);

  return {
    widgets,
    layouts,
    isLoading,
    addWidget,
    removeWidget,
    setWidgetType,
    setLayouts,
  };
}
