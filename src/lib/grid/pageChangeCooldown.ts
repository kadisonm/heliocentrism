// Rate-limits wheel and touch-swipe page changes specifically — both fire a
// burst of raw events per gesture (wheel deltas, touchmove ticks) and need
// a window long enough to debounce that whole burst into one change (see
// PAGE_CHANGE_COOLDOWN_MS in gridConfig.ts). Module-level (not per-
// component state) so both callers share the same clock — same pattern as
// gestureLock.ts for the same reason.
//
// Keyboard, dot-click, and peek-click don't use this at all: each commits
// exactly once per gesture, so usePageSlide's own bounded request queue
// (see pageSlideMachine.ts) rate-limits them without a wall-clock cooldown.
//
// Also deliberately NOT applied to corrective/programmatic repositioning
// (e.g. landing on the new last page once a trailing page auto-deletes, or
// a drag-to-edge hop's own target correction) — those have to land
// regardless of a recent user gesture, or the view can end up silently
// stuck pointing at the wrong page.
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
