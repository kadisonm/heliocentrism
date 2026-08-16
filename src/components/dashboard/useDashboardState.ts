'use client';

import { useEffect, useState } from 'react';
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

  // Save dashboard state on change
  useEffect(() => {
    if (!isLoading && widgets.length > 0) {
      writeDashboardState({ widgets, layouts });
    }
  }, [widgets, layouts, isLoading]);

  const addWidget = (type: string) => {
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
  };

  const removeWidget = (id: string) => {
    setWidgets((current) => current.filter((widget) => widget.id !== id));
    setLayouts((current) => {
      const next: ResponsiveLayouts<DashboardBreakpoint> = { ...current };
      ALL_BREAKPOINTS.forEach((breakpoint) => {
        next[breakpoint] = (current[breakpoint] ?? []).filter((item) => item.i !== id);
      });
      return next;
    });
  };

  const setWidgetType = (id: string, type: string) => {
    setWidgets((current) =>
      current.map((widget) => (widget.id === id ? { ...widget, type } : widget))
    );
  };

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
