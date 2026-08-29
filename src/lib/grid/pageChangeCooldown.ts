import { PAGE_CHANGE_COOLDOWN_MS } from './gridConfig';

// Rate-limits how often a user's own gesture (wheel, keyboard, dot click,
// touch-swipe commit, clicking a peeking neighbor) can trigger a page
// change, regardless of which direction they're going or which input
// method they switch to mid-stream — a page's own slide animation needs to
// actually finish being legible before the next one starts. Module-level
// (not per-component state) so every trigger, in both Grid.tsx and
// page.tsx's PageDots, shares the same clock — same pattern as
// gestureLock.ts for the same reason.
//
// Deliberately NOT applied to corrective/programmatic repositioning (e.g.
// landing on the new last page once a trailing page auto-deletes, or a
// drag-to-edge hop's own target correction) — those have to land regardless
// of a recent user gesture, or the view can end up silently stuck pointing
// at the wrong page.
let lastChangeAt = 0;

// Call immediately before actually committing a user-gesture-triggered page
// change. Returns false (skip the change) if still within the cooldown
// window, true (and starts a new cooldown) otherwise.
export function tryClaimPageChange(): boolean {
  const now = Date.now();
  if (now - lastChangeAt < PAGE_CHANGE_COOLDOWN_MS) return false;
  lastChangeAt = now;
  return true;
}
