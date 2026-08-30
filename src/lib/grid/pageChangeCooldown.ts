// Rate-limits how often a user's own gesture (wheel, keyboard, dot click,
// touch-swipe commit, clicking a peeking neighbor) can trigger a page
// change, regardless of which direction they're going or which input
// method they switch to mid-stream — a page's own slide animation needs to
// actually finish being legible before the next one starts. Module-level
// (not per-component state) so every trigger, in both Grid.tsx and
// page.tsx's PageDots, shares the same clock — same pattern as
// gestureLock.ts for the same reason.
//
// The required cooldown length differs by input: wheel/touch-swipe fire a
// burst of raw events per gesture and need a longer window to debounce that
// burst into one change (see PAGE_CHANGE_COOLDOWN_MS), while a discrete
// click/keypress already commits exactly once and only needs to wait out
// the slide animation (see DESKTOP_PAGE_CHANGE_COOLDOWN_MS) — callers pass
// whichever applies to them, against this same shared clock.
//
// Deliberately NOT applied to corrective/programmatic repositioning (e.g.
// landing on the new last page once a trailing page auto-deletes, or a
// drag-to-edge hop's own target correction) — those have to land regardless
// of a recent user gesture, or the view can end up silently stuck pointing
// at the wrong page.
let lastChangeAt = 0;

// Call immediately before actually committing a user-gesture-triggered page
// change. Returns false (skip the change) if still within `cooldownMs` of
// the last claimed change, true (and starts a new cooldown) otherwise.
export function tryClaimPageChange(cooldownMs: number): boolean {
  const now = Date.now();
  if (now - lastChangeAt < cooldownMs) return false;
  lastChangeAt = now;
  return true;
}
