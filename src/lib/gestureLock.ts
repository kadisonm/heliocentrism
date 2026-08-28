// Lets a widget's own internal touch gesture (currently: dragging a task/
// subtask row — see useTaskLists.ts's setDraggingId) claim the touch surface
// for its duration, so an outer gesture recognizer that has no idea it's
// happening — Grid.tsx's page-swipe paging — can back off instead of
// fighting over the same touchmove events. A counter rather than a boolean
// so two independent claims (unlikely today, but cheap to make safe) can't
// clobber each other's release.
let activeCount = 0;

export function lockGestures() {
  activeCount += 1;
}

export function unlockGestures() {
  activeCount = Math.max(0, activeCount - 1);
}

export function areGesturesLocked(): boolean {
  return activeCount > 0;
}
