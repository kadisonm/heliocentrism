'use client';

import { useCallback } from 'react';
import type { Layout } from 'react-grid-layout';
import { useAppDispatch, useAppSelector } from '../../lib/store/hooks';
import {
  ALL_BREAKPOINTS,
  addWidget as addWidgetAction,
  createPage as createPageAction,
  moveWidgetToPage as moveWidgetToPageAction,
  reorderPages as reorderPagesAction,
  insertPage as insertPageAction,
  deletePage as deletePageAction,
  removeWidget as removeWidgetAction,
  setLayout as setLayoutAction,
  setWidgetHeights as setWidgetHeightsAction,
  updateWidget as updateWidgetAction,
} from '../../lib/store/gridSlice';
import { DEFAULT_WIDGET_SIZE } from '../../lib/grid/gridConfig';
import { findWidgetDefinition } from '../../lib/grid/widgetRegistry';
import type { DashboardBreakpoint, DashboardWidget } from '../../lib/types';

export { ALL_BREAKPOINTS };

// Thin wrapper over the grid Redux slice (src/lib/store/gridSlice.ts) —
// kept at the same call signature as before the Redux migration so every
// consumer (Grid.tsx, WidgetShell.tsx, etc.) needs no changes.
export function useGridState() {
  const dispatch = useAppDispatch();
  const breakpoints = useAppSelector((state) => state.grid.breakpoints);
  const isLoading = useAppSelector((state) => state.grid.isLoading);

  const addWidget = useCallback(
    (type: string, breakpoint: DashboardBreakpoint, pageId: string) => {
      const size = findWidgetDefinition(type)?.defaultSize ?? DEFAULT_WIDGET_SIZE;
      dispatch(addWidgetAction(type, breakpoint, pageId, size));
    },
    [dispatch]
  );

  const removeWidget = useCallback(
    (id: string, breakpoint: DashboardBreakpoint, pageId: string) => {
      dispatch(removeWidgetAction({ id, breakpoint, pageId }));
    },
    [dispatch]
  );

  const updateWidget = useCallback(
    (id: string, breakpoint: DashboardBreakpoint, pageId: string, patch: Partial<Omit<DashboardWidget, 'id'>>) => {
      dispatch(updateWidgetAction({ id, breakpoint, pageId, patch }));
    },
    [dispatch]
  );

  const setLayout = useCallback(
    (breakpoint: DashboardBreakpoint, pageId: string, layout: Layout) => {
      dispatch(setLayoutAction({ breakpoint, pageId, layout }));
    },
    [dispatch]
  );

  const setWidgetHeights = useCallback(
    (breakpoint: DashboardBreakpoint, pageId: string, patches: Array<{ id: string; h: number }>) => {
      dispatch(setWidgetHeightsAction({ breakpoint, pageId, patches }));
    },
    [dispatch]
  );

  // createPage's id is generated in the action's `prepare` callback, so the
  // dispatched action itself carries it back out synchronously — callers
  // (e.g. the dashboard page) rely on getting the new page's id immediately.
  const createPage = useCallback(
    (breakpoint: DashboardBreakpoint): string => {
      return dispatch(createPageAction(breakpoint)).payload.id;
    },
    [dispatch]
  );

  const moveWidgetToPage = useCallback(
    (id: string, breakpoint: DashboardBreakpoint, fromPageId: string, toPageId: string) => {
      dispatch(moveWidgetToPageAction({ id, breakpoint, fromPageId, toPageId }));
    },
    [dispatch]
  );

  const reorderPages = useCallback(
    (breakpoint: DashboardBreakpoint, pageIds: string[]) => {
      dispatch(reorderPagesAction({ breakpoint, pageIds }));
    },
    [dispatch]
  );

  // Returns the new page's id (generated in the action's `prepare`).
  const insertPage = useCallback(
    (breakpoint: DashboardBreakpoint, index: number): string => dispatch(insertPageAction(breakpoint, index)).payload.id,
    [dispatch]
  );

  const deletePage = useCallback(
    (breakpoint: DashboardBreakpoint, pageId: string) => {
      dispatch(deletePageAction({ breakpoint, pageId }));
    },
    [dispatch]
  );

  return {
    breakpoints,
    isLoading,
    addWidget,
    removeWidget,
    updateWidget,
    setLayout,
    setWidgetHeights,
    createPage,
    moveWidgetToPage,
    reorderPages,
    insertPage,
    deletePage,
  };
}
