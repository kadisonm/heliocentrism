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

// Fixed pixel widths used to simulate each device tier while editing, so the
// grid locks onto that breakpoint's layout regardless of the real browser width.
export const DASHBOARD_PREVIEW_WIDTHS: Record<DashboardBreakpoint, number> = {
  desktop: 1280,
  tablet: 900,
  mobile: 375,
};

// Fallback size for a new widget if its definition has no defaultSize for some reason.
export const DEFAULT_WIDGET_SIZE = { w: 4, h: 6 };
