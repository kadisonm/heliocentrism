import { verticalCompactor, type Layout } from 'react-grid-layout';
import { DEFAULT_DASHBOARD } from '../data';
import { GRID_COLS } from './gridConfig';
import type { DashboardBreakpoint, DashboardBreakpointState, DashboardWidget, DashboardPage } from '../types';

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
export function migrateDashboardState(synced: unknown): Record<DashboardBreakpoint, DashboardBreakpointState> {
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
