'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { verticalCompactor, type Layout } from 'react-grid-layout';
import { DEFAULT_DASHBOARD } from '../../lib/data';
import { GRID_COLS, DEFAULT_WIDGET_SIZE, MAX_PAGES_PER_BREAKPOINT } from '../../lib/gridConfig';
import { readDashboardState, writeDashboardState } from '../../lib/firebaseSync';
import type {
  DashboardBreakpoint,
  DashboardBreakpointState,
  DashboardPage,
  DashboardState,
  DashboardWidget,
} from '../../lib/types';
import { findWidgetDefinition } from '../../lib/widgetRegistry';

export const ALL_BREAKPOINTS: DashboardBreakpoint[] = ['desktop', 'tablet', 'mobile'];

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

function toPage(widgets: DashboardWidget[], layout: Layout): DashboardPage {
  return { id: crypto.randomUUID(), widgets, layout };
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

// Guards against corrupted layout data (e.g. a stray null/Infinity y) that
// would otherwise feed react-grid-layout's internal compaction/sync into an
// infinite "Maximum update depth" loop and render widgets overlapping.
function isValidLayout(layout: unknown): layout is Layout {
  return (
    Array.isArray(layout) &&
    layout.every(
      (item) =>
        item &&
        isFiniteNumber(item.x) &&
        isFiniteNumber(item.y) &&
        isFiniteNumber(item.w) &&
        isFiniteNumber(item.h)
    )
  );
}

// Replaces any non-finite coordinate with a safe fallback (unresolved `y`
// goes to Infinity, matching addWidget's own "place at the bottom"
// convention) and re-compacts so nothing overlaps.
function sanitizeLayout(layout: Layout, cols: number): Layout {
  const fixed = layout.map((item) => ({
    ...item,
    x: isFiniteNumber(item.x) ? item.x : 0,
    y: isFiniteNumber(item.y) ? item.y : Infinity,
    w: isFiniteNumber(item.w) ? item.w : 1,
    h: isFiniteNumber(item.h) ? item.h : 1,
  }));
  return verticalCompactor.compact(fixed, cols);
}

function sameWidgetIds(a: DashboardWidget[], b: DashboardWidget[]): boolean {
  if (a.length !== b.length) return false;
  const idsA = new Set(a.map((w) => w.id));
  return b.every((w) => idsA.has(w.id));
}

// Normalizes one breakpoint's raw stored value, which may already be the
// current {pages} shape (pass through) or the pre-pages {widgets, layout}
// shape (wrap as a single page). Firestore's merge:true writes never delete
// fields a newer write omits, so a doc can end up with both the current
// `pages` field AND the older sibling `widgets`/`layout` fields left behind
// by an earlier (possibly buggy) version — if a page's layout looks
// corrupted, and its widget set exactly matches those sibling fields, that
// page is the one the old shape was wrapped forward from, so recover its
// layout from there. Any other invalid page (no matching sibling) is
// sanitized in place rather than dropped, so no page is ever silently lost.
function migrateBreakpointState(raw: unknown, breakpoint: DashboardBreakpoint): DashboardBreakpointState {
  if (!raw || typeof raw !== 'object') return { pages: [toPage([], [])] };
  const r = raw as { pages?: DashboardPage[]; widgets?: DashboardWidget[]; layout?: Layout };

  if (Array.isArray(r.pages) && r.pages.length > 0) {
    const cols = GRID_COLS[breakpoint];
    const pages = r.pages.map((page) => {
      if (isValidLayout(page.layout)) return page;
      if (r.layout && isValidLayout(r.layout) && r.widgets && sameWidgetIds(page.widgets, r.widgets)) {
        return { ...page, layout: r.layout };
      }
      return { ...page, layout: sanitizeLayout(page.layout as Layout, cols) };
    });
    return { pages };
  }
  return { pages: [toPage(r.widgets ?? [], r.layout ?? [])] };
}

// Migrates two legacy shapes (a flat shared widget list, and a split
// widgets/layouts pair) plus the pre-pages per-breakpoint shape, all up to
// the current pages format, without changing what's actually displayed.
function migrateDashboardState(synced: unknown): Record<DashboardBreakpoint, DashboardBreakpointState> {
  if (!synced || typeof synced !== 'object') return DEFAULT_DASHBOARD.breakpoints;

  const data = synced as {
    breakpoints?: Partial<Record<DashboardBreakpoint, unknown>>;
    widgets?: DashboardWidget[] | Partial<Record<DashboardBreakpoint, DashboardWidget[]>>;
    layouts?: Partial<Record<DashboardBreakpoint, Layout>>;
  };

  if (data.breakpoints) {
    return {
      desktop: migrateBreakpointState(data.breakpoints.desktop, 'desktop'),
      tablet: migrateBreakpointState(data.breakpoints.tablet, 'tablet'),
      mobile: migrateBreakpointState(data.breakpoints.mobile, 'mobile'),
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
    desktop: { pages: [toPage(widgetsByBreakpoint.desktop, data.layouts?.desktop ?? [])] },
    tablet: { pages: [toPage(widgetsByBreakpoint.tablet, data.layouts?.tablet ?? [])] },
    mobile: { pages: [toPage(widgetsByBreakpoint.mobile, data.layouts?.mobile ?? [])] },
  };
}

// A page needs >=1 widget or it's deleted, except the dashboard's last
// remaining page is never auto-deleted even if emptied.
function withEmptyPageCollapsed(pages: DashboardPage[], pageId: string): DashboardPage[] {
  const page = pages.find((p) => p.id === pageId);
  if (!page || page.widgets.length > 0 || pages.length === 1) return pages;
  return pages.filter((p) => p.id !== pageId);
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

  const hasAnyWidgets = ALL_BREAKPOINTS.some((breakpoint) =>
    breakpoints[breakpoint].pages.some((page) => page.widgets.length > 0)
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

  // Empty dep array is safe — these only use the setState updater form and
  // never close over `breakpoints`. Stable identity matters: they're passed
  // to every React.memo'd WidgetShell, and a fresh reference each render
  // would defeat that memoization.
  const addWidget = useCallback((type: string, breakpoint: DashboardBreakpoint, pageId: string) => {
    const id = crypto.randomUUID();
    const size = findWidgetDefinition(type)?.defaultSize ?? DEFAULT_WIDGET_SIZE;
    const w = Math.min(size.w, GRID_COLS[breakpoint]);

    setBreakpoints((current) => {
      const tier = current[breakpoint];
      const pages = tier.pages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              widgets: [...page.widgets, { id, type }],
              layout: [...page.layout, { i: id, x: 0, y: Infinity, w, h: size.h }],
            }
          : page
      );
      return { ...current, [breakpoint]: { pages } };
    });
  }, []);

  const removeWidget = useCallback((id: string, breakpoint: DashboardBreakpoint, pageId: string) => {
    setBreakpoints((current) => {
      const tier = current[breakpoint];
      const updatedPages = tier.pages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              widgets: page.widgets.filter((widget) => widget.id !== id),
              layout: page.layout.filter((item) => item.i !== id),
            }
          : page
      );
      return { ...current, [breakpoint]: { pages: withEmptyPageCollapsed(updatedPages, pageId) } };
    });
  }, []);

  // Generic per-instance field patch — covers type (the chrome dropdown),
  // autoExpand (the auto-expand toggle), and any widget-specific config
  // (e.g. Photo's url/alt/fit, applied together as one `photo` patch via
  // WidgetContext's onUpdate) through the same path.
  const updateWidget = useCallback(
    (id: string, breakpoint: DashboardBreakpoint, pageId: string, patch: Partial<Omit<DashboardWidget, 'id'>>) => {
      setBreakpoints((current) => {
        const tier = current[breakpoint];
        const pages = tier.pages.map((page) =>
          page.id === pageId
            ? { ...page, widgets: page.widgets.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget)) }
            : page
        );
        return { ...current, [breakpoint]: { pages } };
      });
    },
    []
  );

  // Bails out with the same `current` reference when the layout is
  // item-for-item unchanged, since GridLayout can report a no-op layout
  // (e.g. across a column-count change); otherwise a fresh reference each
  // time ping-pongs with GridLayout's own prop sync ("Maximum update depth").
  const setLayout = useCallback((breakpoint: DashboardBreakpoint, pageId: string, layout: Layout) => {
    setBreakpoints((current) => {
      const tier = current[breakpoint];
      const page = tier.pages.find((p) => p.id === pageId);
      if (!page || layoutsEqual(page.layout, layout)) return current;
      const pages = tier.pages.map((p) => (p.id === pageId ? { ...p, layout } : p));
      return { ...current, [breakpoint]: { pages } };
    });
  }, []);

  // Called by GridPage's coalesced flush of WidgetShell's ResizeObserver
  // callbacks during auto-expand (see GridPage's HEIGHT_COALESCE_MS) — all
  // widgets that remeasured together land in one compaction pass here,
  // rather than one setState per widget. That matters: react-grid-layout's
  // own internal layout-sync effect can't cleanly reconcile against a drip
  // of separate incremental layout-prop changes (each landing in its own
  // commit) — it can echo back a stale intermediate value, which gets
  // immediately re-measured and pushed forward again, forever ("Maximum
  // update depth exceeded"). One atomic update per settle avoids that race.
  const setWidgetHeights = useCallback(
    (breakpoint: DashboardBreakpoint, pageId: string, patches: Array<{ id: string; h: number }>) => {
      if (patches.length === 0) return;
      setBreakpoints((current) => {
        const tier = current[breakpoint];
        const page = tier.pages.find((p) => p.id === pageId);
        if (!page) return current;

        const heightById = new Map(patches.map(({ id, h }) => [id, h]));
        let changed = false;
        const resized = page.layout.map((entry) => {
          const h = heightById.get(entry.i);
          if (h === undefined || entry.h === h) return entry;
          changed = true;
          return { ...entry, h };
        });
        if (!changed) return current;

        const compacted = verticalCompactor.compact(resized, GRID_COLS[breakpoint]);
        const pages = tier.pages.map((p) => (p.id === pageId ? { ...p, layout: compacted } : p));

        return { ...current, [breakpoint]: { pages } };
      });
    },
    []
  );

  const createPage = useCallback((breakpoint: DashboardBreakpoint): string => {
    const id = crypto.randomUUID();
    setBreakpoints((current) => {
      const tier = current[breakpoint];
      // Defensive only — the UI already hides the "new page" affordance at
      // the cap (see buildVirtualPages), so this should never actually apply.
      if (tier.pages.length >= MAX_PAGES_PER_BREAKPOINT) return current;
      return { ...current, [breakpoint]: { pages: [...tier.pages, { id, widgets: [], layout: [] }] } };
    });
    return id;
  }, []);

  const moveWidgetToPage = useCallback(
    (id: string, breakpoint: DashboardBreakpoint, fromPageId: string, toPageId: string) => {
      if (fromPageId === toPageId) return;
      setBreakpoints((current) => {
        const tier = current[breakpoint];
        const fromPage = tier.pages.find((p) => p.id === fromPageId);
        const toPage = tier.pages.find((p) => p.id === toPageId);
        const widget = fromPage?.widgets.find((w) => w.id === id);
        const layoutItem = fromPage?.layout.find((item) => item.i === id);
        if (!fromPage || !toPage || !widget || !layoutItem) return current;

        const cols = GRID_COLS[breakpoint];
        const toLayout = verticalCompactor.compact([...toPage.layout, { ...layoutItem, x: 0, y: Infinity }], cols);

        const updatedFrom = {
          ...fromPage,
          widgets: fromPage.widgets.filter((w) => w.id !== id),
          layout: fromPage.layout.filter((item) => item.i !== id),
        };

        const rawPages = tier.pages.map((page) => {
          if (page.id === fromPageId) return updatedFrom;
          if (page.id === toPageId) return { ...page, widgets: [...page.widgets, widget], layout: toLayout };
          return page;
        });

        return { ...current, [breakpoint]: { pages: withEmptyPageCollapsed(rawPages, fromPageId) } };
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
    setWidgetHeights,
    createPage,
    moveWidgetToPage,
  };
}
