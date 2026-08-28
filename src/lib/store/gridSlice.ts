import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { verticalCompactor, type Layout } from 'react-grid-layout';
import { DEFAULT_DASHBOARD } from '../data';
import { GRID_COLS, MAX_PAGES_PER_BREAKPOINT } from '../gridConfig';
import { readDashboardState } from '../firebaseSync';
import type {
  DashboardBreakpoint,
  DashboardBreakpointState,
  DashboardPage,
  DashboardWidget,
} from '../types';
import type { AppDispatch } from './store';

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
// remaining page is never auto-deleted even if emptied. Generic over the
// page type (rather than fixed to DashboardPage, whose `layout: Layout` is
// react-grid-layout's readonly array type) so callers building Immer-draft
// pages here don't need to detour their mutable layout arrays through a
// readonly-typed return.
function withEmptyPageCollapsed<P extends { id: string; widgets: DashboardWidget[] }>(pages: P[], pageId: string): P[] {
  const page = pages.find((p) => p.id === pageId);
  if (!page || page.widgets.length > 0 || pages.length === 1) return pages;
  return pages.filter((p) => p.id !== pageId);
}

export type GridState = {
  breakpoints: Record<DashboardBreakpoint, DashboardBreakpointState>;
  isLoading: boolean;
};

const initialState: GridState = {
  breakpoints: DEFAULT_DASHBOARD.breakpoints,
  isLoading: true,
};

let hasStartedLoad = false;

// Guarded the same way the old module singleton guarded its one-time mount
// effect, so StrictMode's double-invoke (or ClientRoot re-rendering) can't
// kick off a second concurrent read.
export const loadGridState = createAsyncThunk('grid/load', async () => {
  const syncedState = await readDashboardState();
  return syncedState ? migrateDashboardState(syncedState) : null;
});

export function ensureGridLoaded(dispatch: AppDispatch) {
  if (hasStartedLoad) return;
  hasStartedLoad = true;
  dispatch(loadGridState());
}

const gridSlice = createSlice({
  name: 'grid',
  initialState,
  reducers: {
    // `size` is resolved by the caller (see useGridState.ts) rather than
    // looked up here via widgetRegistry — that registry eagerly imports
    // every widget component, and one of them (Pomodoro) reaches back into
    // this same Redux store, which would make this slice circularly import
    // the store it's part of.
    addWidget: {
      reducer: (
        state,
        action: PayloadAction<{
          id: string;
          type: string;
          breakpoint: DashboardBreakpoint;
          pageId: string;
          size: { w: number; h: number };
        }>
      ) => {
        const { id, type, breakpoint, pageId, size } = action.payload;
        const w = Math.min(size.w, GRID_COLS[breakpoint]);

        const page = state.breakpoints[breakpoint].pages.find((p) => p.id === pageId);
        if (!page) return;
        page.widgets.push({ id, type });
        page.layout.push({ i: id, x: 0, y: Infinity, w, h: size.h });
      },
      prepare: (type: string, breakpoint: DashboardBreakpoint, pageId: string, size: { w: number; h: number }) => ({
        payload: { id: crypto.randomUUID(), type, breakpoint, pageId, size },
      }),
    },

    removeWidget: (
      state,
      action: PayloadAction<{ id: string; breakpoint: DashboardBreakpoint; pageId: string }>
    ) => {
      const { id, breakpoint, pageId } = action.payload;
      const tier = state.breakpoints[breakpoint];
      const updatedPages = tier.pages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              widgets: page.widgets.filter((widget) => widget.id !== id),
              layout: page.layout.filter((item) => item.i !== id),
            }
          : page
      );
      tier.pages = withEmptyPageCollapsed(updatedPages, pageId);
    },

    // Generic per-instance field patch — covers type (the chrome dropdown),
    // autoExpand (the auto-expand toggle), and any widget-specific config
    // (e.g. Photo's url/alt/fit, applied together as one `photo` patch via
    // WidgetContext's onUpdate) through the same path.
    updateWidget: (
      state,
      action: PayloadAction<{
        id: string;
        breakpoint: DashboardBreakpoint;
        pageId: string;
        patch: Partial<Omit<DashboardWidget, 'id'>>;
      }>
    ) => {
      const { id, breakpoint, pageId, patch } = action.payload;
      const page = state.breakpoints[breakpoint].pages.find((p) => p.id === pageId);
      if (!page) return;
      const widget = page.widgets.find((w) => w.id === id);
      if (widget) Object.assign(widget, patch);
    },

    // Bails out with no-op when the layout is item-for-item unchanged, since
    // GridLayout can report a no-op layout (e.g. across a column-count
    // change); otherwise a fresh reference each time ping-pongs with
    // GridLayout's own prop sync ("Maximum update depth").
    setLayout: (
      state,
      action: PayloadAction<{ breakpoint: DashboardBreakpoint; pageId: string; layout: Layout }>
    ) => {
      const { breakpoint, pageId, layout } = action.payload;
      const page = state.breakpoints[breakpoint].pages.find((p) => p.id === pageId);
      if (!page || layoutsEqual(page.layout, layout)) return;
      // Copied rather than assigned directly — react-grid-layout's `Layout`
      // is a readonly array type, which Immer's mutable draft won't accept.
      page.layout = [...layout];
    },

    // Called by GridPage's coalesced flush of WidgetShell's ResizeObserver
    // callbacks during auto-expand (see GridPage's HEIGHT_COALESCE_MS) — all
    // widgets that remeasured together land in one compaction pass here,
    // rather than one setState per widget. That matters: react-grid-layout's
    // own internal layout-sync effect can't cleanly reconcile against a drip
    // of separate incremental layout-prop changes (each landing in its own
    // commit) — it can echo back a stale intermediate value, which gets
    // immediately re-measured and pushed forward again, forever ("Maximum
    // update depth exceeded"). One atomic update per settle avoids that race.
    setWidgetHeights: (
      state,
      action: PayloadAction<{
        breakpoint: DashboardBreakpoint;
        pageId: string;
        patches: Array<{ id: string; h: number }>;
      }>
    ) => {
      const { breakpoint, pageId, patches } = action.payload;
      if (patches.length === 0) return;
      const page = state.breakpoints[breakpoint].pages.find((p) => p.id === pageId);
      if (!page) return;

      const heightById = new Map(patches.map(({ id, h }) => [id, h]));
      let changed = false;
      const resized = page.layout.map((entry) => {
        const h = heightById.get(entry.i);
        if (h === undefined || entry.h === h) return entry;
        changed = true;
        return { ...entry, h };
      });
      if (!changed) return;

      page.layout = [...verticalCompactor.compact(resized, GRID_COLS[breakpoint])];
    },

    createPage: {
      reducer: (state, action: PayloadAction<{ breakpoint: DashboardBreakpoint; id: string }>) => {
        const { breakpoint, id } = action.payload;
        const tier = state.breakpoints[breakpoint];
        // Defensive only — the UI already hides the "new page" affordance at
        // the cap (see buildVirtualPages), so this should never actually apply.
        if (tier.pages.length >= MAX_PAGES_PER_BREAKPOINT) return;
        tier.pages.push({ id, widgets: [], layout: [] });
      },
      prepare: (breakpoint: DashboardBreakpoint) => ({ payload: { breakpoint, id: crypto.randomUUID() } }),
    },

    moveWidgetToPage: (
      state,
      action: PayloadAction<{ id: string; breakpoint: DashboardBreakpoint; fromPageId: string; toPageId: string }>
    ) => {
      const { id, breakpoint, fromPageId, toPageId } = action.payload;
      if (fromPageId === toPageId) return;
      const tier = state.breakpoints[breakpoint];
      const fromPage = tier.pages.find((p) => p.id === fromPageId);
      const toPage = tier.pages.find((p) => p.id === toPageId);
      const widget = fromPage?.widgets.find((w) => w.id === id);
      const layoutItem = fromPage?.layout.find((item) => item.i === id);
      if (!fromPage || !toPage || !widget || !layoutItem) return;

      const cols = GRID_COLS[breakpoint];
      const toLayout = [...verticalCompactor.compact([...toPage.layout, { ...layoutItem, x: 0, y: Infinity }], cols)];

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

      tier.pages = withEmptyPageCollapsed(rawPages, fromPageId);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadGridState.fulfilled, (state, action) => {
      if (!action.payload) {
        state.isLoading = false;
        return;
      }
      // Returned wholesale (rather than assigned into the draft) since the
      // migrated data's `Layout` fields are react-grid-layout's readonly
      // array type, which Immer's mutable draft won't accept.
      return { breakpoints: action.payload, isLoading: false };
    });
  },
});

export const { addWidget, removeWidget, updateWidget, setLayout, setWidgetHeights, createPage, moveWidgetToPage } =
  gridSlice.actions;
export default gridSlice.reducer;
