import type { DashboardBreakpoint } from './types';

export const DASHBOARD_BREAKPOINTS: Record<DashboardBreakpoint, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 0,
};

export const DASHBOARD_COLS: Record<DashboardBreakpoint, number> = {
  desktop: 12,
  tablet: 8,
  mobile: 4,
};

// Shared with useDeviceTier (the real device/window) and DashboardGrid's
// view-mode selection (the grid's own measured container width) — same
// thresholds, applied to whichever width is the relevant one for the caller.
export function getBreakpointForWidth(width: number): DashboardBreakpoint {
  if (width >= DASHBOARD_BREAKPOINTS.desktop) return 'desktop';
  if (width >= DASHBOARD_BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

// Fixed pixel widths used to simulate each device tier while editing, so the
// grid locks onto that breakpoint's layout regardless of the real browser width.
// This is the frame's total on-screen footprint (chrome included) — see
// DASHBOARD_PREVIEW_FRAME_CHROME below for why the width fed to the grid
// itself ends up smaller than these numbers.
export const DASHBOARD_PREVIEW_WIDTHS: Record<DashboardBreakpoint, number> = {
  desktop: 1280,
  tablet: 900,
  mobile: 375,
};

// .dashboard-grid-preview-frame (dashboard-grid.scss) is deliberately
// content-box, so its padding/border sit *outside* the width passed to the
// grid rather than eating into it — otherwise react-grid-layout's column
// math would assume more space than the frame actually has room for, and
// widgets would poke out past the frame's edge. The tradeoff is that the
// frame's own padding + border then add to DASHBOARD_PREVIEW_WIDTHS rather
// than being included in it, so the on-screen frame ends up wider than the
// width it's meant to simulate — on mobile specifically, wide enough to
// overflow the real viewport, since a phone can enter edit mode too (see
// page.tsx's allowedBreakpoints). Subtract this from DASHBOARD_PREVIEW_WIDTHS
// before handing it to the grid so the frame's total footprint (padding/
// border included) matches the simulated width instead of exceeding it.
// Kept in sync by hand with dashboard-grid.scss's `padding: 1rem` (16px) +
// `border: 1px` on .dashboard-grid-preview-frame, same pattern as
// orbit-animation.scss's path constants.
export const DASHBOARD_PREVIEW_FRAME_CHROME = 2 * (16 + 1); // padding + border, each side

// Fallback size for a new widget if its definition has no defaultSize for some reason.
export const DEFAULT_WIDGET_SIZE = { w: 4, h: 6 };

// Fallback minimum size for a widget whose definition has no minSize for some reason.
export const DEFAULT_WIDGET_MIN_SIZE = { w: 2, h: 3 };
