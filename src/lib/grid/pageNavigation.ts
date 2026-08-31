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

// Identifies a slot by its content (page id, or 'blank'/'none') rather than
// the VirtualPage object itself — usePageNavigation rebuilds its virtual
// page list on every call, which would otherwise read as "changed" even
// when the actual page occupying a slot hasn't.
export function virtualPageSignature(vp: VirtualPage | null): string {
  return vp ? (vp.kind === 'real' ? vp.page.id : 'blank') : 'none';
}

// True exactly when the page 2 steps beyond `displayedIndex` in the
// direction of an adjacent slide toward `committedIndex` hasn't already been
// mounted as the prev/current/next slot — i.e. that slide is about to mount
// a brand-new page's whole subtree (GridLayout + every widget), not just
// promote one that was already sitting mounted as a peek neighbor. Shared
// by Grid.tsx (which also needs the actual lookahead VirtualPage for
// rendering, computed the same way) and usePageSlide (which only needs this
// boolean, to decide whether to hold the track at rest for a couple of
// frames before animating — see isLookaheadFreshMount's usage in Grid.tsx
// and usePageSlide.ts's own comment on why it can't just take this as a
// pre-computed argument).
export function isLookaheadFreshMount(
  pages: DashboardPage[],
  showBlankSlot: boolean,
  committedIndex: number,
  displayedIndex: number
): boolean {
  const slideDirection = committedIndex - displayedIndex;
  if (Math.abs(slideDirection) !== 1) return false;

  const virtualPages = buildVirtualPages(pages, showBlankSlot);
  const activeIndex = clampPageIndex(displayedIndex, pages.length, showBlankSlot);
  const lookaheadSignature = virtualPageSignature(virtualPages[activeIndex + slideDirection * 2] ?? null);
  if (lookaheadSignature === 'none') return false;

  const prev = activeIndex > 0 ? virtualPages[activeIndex - 1] : null;
  const current = virtualPages[activeIndex];
  const next = activeIndex < virtualPages.length - 1 ? virtualPages[activeIndex + 1] : null;
  return (
    lookaheadSignature !== virtualPageSignature(prev) &&
    lookaheadSignature !== virtualPageSignature(current) &&
    lookaheadSignature !== virtualPageSignature(next)
  );
}
