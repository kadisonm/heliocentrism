import type { DashboardBreakpoint } from './types';

export const GRID_BREAKPOINTS: Record<DashboardBreakpoint, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 0,
};

export const GRID_COLS: Record<DashboardBreakpoint, number> = {
  desktop: 12,
  tablet: 8,
  mobile: 4,
};

// Single source of truth for the pixel-to-row conversion, shared by Grid's
// react-grid-layout config and WidgetShell's auto-expand measurement.
export const GRID_ROW_HEIGHT = 40;
export const GRID_ITEM_MARGIN: [number, number] = [16, 16];

// Passed to react-grid-layout's own `containerPadding` config (GridPage.tsx)
// rather than as CSS padding on .grid — the library bakes this inset
// directly into each item's computed left/top/width/height, so it has to be
// the one source of truth for it; raw CSS padding on .grid would shrink the
// actual box without the library's math knowing, letting items sized for
// the full width overflow past the now-smaller box. Also reused by Grid.tsx
// for the pixel<->grid math when a cross-page drag hands a widget off to
// a different page's grid mid-gesture (see the relocation logic there).
export const GRID_CONTAINER_PADDING: [number, number] = [10, 10];

// Converts a measured content height in pixels to the number of grid rows
// needed to contain it without clipping — the inverse of react-grid-
// layout's own `h rows -> px` formula (h * rowHeight + (h - 1) * marginY).
export function pxToGridRows(px: number): number {
  const marginY = GRID_ITEM_MARGIN[1];
  return Math.max(1, Math.ceil((px + marginY) / (GRID_ROW_HEIGHT + marginY)));
}

// Shared with useDeviceTier (the real device/window) and Grid's view-mode
// selection (the grid's own measured container width) — same thresholds,
// applied to whichever width is the relevant one for the caller.
export function getBreakpointForWidth(width: number): DashboardBreakpoint {
  if (width >= GRID_BREAKPOINTS.desktop) return 'desktop';
  if (width >= GRID_BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

// Fixed pixel widths used to simulate each device tier while editing, so the
// grid locks onto that breakpoint's layout regardless of real browser width.
// This is the frame's total on-screen footprint (chrome included) — see
// GRID_PREVIEW_FRAME_CHROME for why the width fed to the grid is smaller.
export const GRID_PREVIEW_WIDTHS: Record<DashboardBreakpoint, number> = {
  desktop: 1280,
  tablet: 900,
  mobile: 375,
};

// .grid-preview-frame is content-box, so its padding/border add on top of
// GRID_PREVIEW_WIDTHS rather than eating into it. Subtract this before handing
// the width to the grid so the frame's total footprint matches the simulated
// size. Kept in sync by hand with grid.scss's padding (16px) + border (1px).
export const GRID_PREVIEW_FRAME_CHROME = 2 * (16 + 1); // padding + border, each side

// Fallback size for a new widget if its definition has no defaultSize for some reason.
export const DEFAULT_WIDGET_SIZE = { w: 4, h: 6 };

// Fallback minimum size for a widget whose definition has no minSize for some reason.
export const DEFAULT_WIDGET_MIN_SIZE = { w: 2, h: 3 };

export const MAX_PAGES_PER_BREAKPOINT = 30;

// Advisory-only per-page length ceiling (~10 viewport-heights of grid rows).
// Never blocks placement/resize — only decides whether GridPage renders the
// warning line under the active page.
export const PAGE_SOFT_HEIGHT_SCREENS = 10;

export function pageSoftHeightRows(viewportHeightPx: number): number {
  const rowSpan = GRID_ROW_HEIGHT + GRID_ITEM_MARGIN[1];
  return Math.ceil((viewportHeightPx * PAGE_SOFT_HEIGHT_SCREENS) / rowSpan);
}

// Edit mode renders neighboring pages at full (unscaled) size, sliding the
// track so the active page sits centered — this is how much of a neighbor
// peeks in at each screen edge, reserved whether or not one actually exists
// there, so the canvas doesn't resize as you page toward an end.
export const PAGE_PEEK_SLIVER_PX = 48;

// Breathing room between the active page's edge and the sliver of the
// neighbor beside it (also used as the gap between adjacent pages while
// mid-slide). Kept in sync by hand with .grid-page-track's `gap` in
// grid.scss, same pattern as GRID_PREVIEW_FRAME_CHROME.
export const PAGE_GAP_PX = 16;

// Each page (active or neighbor) renders at this same width — the canvas
// width minus `reservePx` reserved on each edge for the neighbor peeking in
// plus the gap before it. Centering the active page at this width against
// the full canvas naturally leaves exactly `reservePx` clear on either side.
// View mode passes reservePx=0 (no sliver, no gap — a neighbor is fully
// off-screen at rest, only passing through during the slide transition).
export function pageTrackWidth(canvasWidth: number, reservePx: number): number {
  return Math.max(200, canvasWidth - 2 * reservePx);
}
