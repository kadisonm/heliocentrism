// Waits for a specific CSS transition on `el` to finish, falling back to a
// timeout if `transitionend` never fires (the transition gets interrupted,
// cancelled, or — for whatever reason — never starts). Generalizes the
// listener+timeout pattern this file's callers used to hand-roll individually
// (e.g. Grid.tsx's touch-drag snapBack) into one place.
//
// Idempotent: whichever of the listener/timeout fires first wins, and the
// other is torn down immediately, so `onSettle` is guaranteed to run exactly
// once. The returned cancel function is itself safe to call again after
// settling (or more than once) — it's a no-op past the first call.
export function waitForTransitionEnd(
  el: HTMLElement,
  propertyName: string,
  timeoutMs: number,
  onSettle: () => void
): () => void {
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    el.removeEventListener('transitionend', handleTransitionEnd);
    clearTimeout(timeoutId);
    onSettle();
  };

  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target === el && event.propertyName === propertyName) finish();
  };

  el.addEventListener('transitionend', handleTransitionEnd);
  const timeoutId = setTimeout(finish, timeoutMs);

  return () => {
    if (done) return;
    done = true;
    el.removeEventListener('transitionend', handleTransitionEnd);
    clearTimeout(timeoutId);
  };
}
