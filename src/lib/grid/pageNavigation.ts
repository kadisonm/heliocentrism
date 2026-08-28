import type { DashboardPage } from '../types';
import { MAX_PAGES_PER_BREAKPOINT } from './gridConfig';

export type VirtualPage = { kind: 'real'; page: DashboardPage } | { kind: 'blank' };

// The "create a new page" placeholder is purely a UI concept — appended
// only while editing, and hidden once the breakpoint hits the page cap
// (which is what actually disables page creation, not a check elsewhere).
export function buildVirtualPages(pages: DashboardPage[], isEditMode: boolean): VirtualPage[] {
  const virtual: VirtualPage[] = pages.map((page) => ({ kind: 'real', page }));
  if (isEditMode && pages.length < MAX_PAGES_PER_BREAKPOINT) virtual.push({ kind: 'blank' });
  return virtual;
}

// index === pageCount (the blank slot) is only ever valid while editing.
// This one rule is the entire implementation of "exiting edit mode while
// on the blank page snaps back to the last real page."
export function clampPageIndex(index: number, pageCount: number, isEditMode: boolean): number {
  const maxIndex = isEditMode ? pageCount : Math.max(0, pageCount - 1);
  return Math.min(Math.max(index, 0), maxIndex);
}
