'use client';

import { useCallback, useLayoutEffect, useReducer, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  createPageSlideState,
  pageSlideReducer,
  planPageRequest,
  planSlide,
  type PageSlideAction,
} from '../../lib/grid/pageSlideMachine';
import { isLookaheadFreshMount } from '../../lib/grid/pageNavigation';
import { waitForTransitionEnd } from '../../lib/grid/transitionSettle';
import type { DashboardPage } from '../../lib/types';

// How long to wait for the track's own transform transition to fire
// `transitionend` before forcing a settle anyway (an interrupted/cancelled
// transition, or one that never started). Deliberately generous and NOT
// tied to the CSS transition's actual duration — unlike the setTimeout-only
// approach this replaces, transitionend is the primary settle signal, so
// this only needs to be comfortably longer than any real slide, not
// precisely in sync with it.
const PAGE_SLIDE_SAFETY_TIMEOUT_MS = 600;

export type UsePageSlideParams = {
  committedIndex: number;
  // `pages`/`isEditMode` are only ever read fresh via liveRef, at the
  // moment the effect below actually runs (to compute showBlankSlot and
  // decide whether the incoming page needs a fresh-mount hold) — never
  // taken as a dependency-array trigger. Grid.tsx's own showBlankSlot/
  // isLookaheadFreshMount depend on THIS hook's own returned displayedIndex,
  // so passing either of those in directly would be circular; recomputing
  // them here from `pages`/`isEditMode` (which aren't derived from this
  // hook's output) avoids that without needing a render-time ref write,
  // which the react-hooks/refs lint rule forbids outright.
  pages: DashboardPage[];
  isEditMode: boolean;
  trackRef: React.RefObject<HTMLDivElement | null>;
  onCommit: (index: number) => void;
};

export type UsePageSlideResult = {
  displayedIndex: number;
  trackOffsetReady: boolean;
  // The one entry point for every discrete/continuous gesture (keyboard,
  // wheel, touch-commit, dot-click, peek-click) — resolves to an absolute
  // target and either commits immediately, queues behind an in-flight
  // slide, or is dropped as a duplicate/over-capacity request. See
  // pageSlideMachine.ts's planPageRequest for the exact rules.
  requestPage: (target: number) => void;
  // For delta-based gestures (keyboard arrows, wheel, touch-swipe commit):
  // resolves `delta` against the queue's own tail (or committedIndex, if
  // nothing's queued) — the same adjacency base planPageRequest itself uses
  // internally — so a caller can turn "one step further" into the absolute
  // target requestPage needs, without duplicating that tail logic or
  // reaching into this hook's internal state. Doesn't clamp to the page
  // count/blank-slot bounds — the caller (which owns that domain knowledge)
  // does that before calling requestPage.
  resolveDeltaTarget: (delta: number) => number;
  // For corrective/programmatic repositioning (drag-to-edge hop, page-auto-
  // delete, breakpoint switch) — interrupts and supersedes whatever's in
  // flight immediately, landing instantly with no animation, regardless of
  // adjacency. Pair with the caller's own goToIndex/state update to the
  // same target. Correctness beats smoothness here, unlike requestPage.
  forceLand: (target: number) => void;
  // For a gesture (touch-drag) that's about to take over the track's
  // transform/transition itself — cancels any in-flight slide and syncs
  // displayedIndex to the current committedIndex, WITHOUT touching the DOM
  // (the caller manages its own no-transition class for the gesture's
  // duration, unlike forceLand's auto-removed-next-frame toggle).
  resetToCommitted: () => void;
};

export function usePageSlide({
  committedIndex,
  pages,
  isEditMode,
  trackRef,
  onCommit,
}: UsePageSlideParams): UsePageSlideResult {
  const [state, dispatch] = useReducer(pageSlideReducer, committedIndex, createPageSlideState);

  // Mirrors Grid.tsx's own liveRef pattern: requestPage/forceLand/
  // resetToCommitted are called from gesture listeners that attach once and
  // live for the component's lifetime (wheel/touch/keyboard), so they read
  // committedIndex/state/onCommit off a ref rather than closing over
  // render-scoped values — avoids a second, differently-shaped staleness
  // guard alongside Grid's existing one. The "drives the slide" effect below
  // also reads pages/isEditMode off this same ref rather than depending on
  // them directly, so a `pages` array that's merely a new-but-equivalent
  // reference (e.g. from an unrelated Redux update) doesn't spuriously
  // cancel/restart an in-flight slide.
  const liveRef = useRef({ committedIndex, state, onCommit, pages, isEditMode });
  useLayoutEffect(() => {
    liveRef.current = { committedIndex, state, onCommit, pages, isEditMode };
  });

  const requestPage = useCallback((target: number) => {
    const { committedIndex: liveCommitted, state: liveState, onCommit: liveOnCommit } = liveRef.current;
    const outcome = planPageRequest(target, liveCommitted, liveState);
    if (outcome.kind === 'ignored') return;
    dispatch({ type: 'SYNC', state: outcome.state });
    if (outcome.kind === 'commit') liveOnCommit(outcome.target);
  }, []);

  // Applies a displayedIndex change (via `action`) without animating it —
  // used to settle a slide (transform reset to its resting value at the
  // same moment prev/active/next reassign, which visually cancel out) and
  // to cut straight to a non-adjacent/corrective target (no slide to play
  // at all). Toggling the class BEFORE dispatching, rather than after,
  // ensures it's already present on the DOM node by the time the resulting
  // re-render applies the new (non-overshot) transform value.
  const applyInstant = useCallback(
    (action: PageSlideAction) => {
      const el = trackRef.current;
      el?.classList.add('grid-page-track--no-transition');
      dispatch(action);
      requestAnimationFrame(() => el?.classList.remove('grid-page-track--no-transition'));
    },
    [trackRef]
  );

  const forceLand = useCallback(
    (target: number) => applyInstant({ type: 'FORCE_LAND', target }),
    [applyInstant]
  );

  const resetToCommitted = useCallback(() => {
    dispatch({ type: 'FORCE_LAND', target: liveRef.current.committedIndex });
  }, []);

  const resolveDeltaTarget = useCallback((delta: number) => {
    const { committedIndex: liveCommitted, state: liveState } = liveRef.current;
    const tail = liveState.queue.length > 0 ? liveState.queue[liveState.queue.length - 1] : liveCommitted;
    return tail + delta;
  }, []);

  // Drives the slide: an adjacent-step change to committedIndex overshoots
  // the track transform by one slot (see Grid.tsx's trackOffsetPx), then
  // this effect waits for that transition to actually finish — via
  // transitionend, not a hand-tuned duration — before swapping
  // prev/active/next to the new page. A non-adjacent commit has no adjacent
  // overshoot to play, so it cuts straight there.
  const cancelSettleRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    cancelSettleRef.current?.();
    cancelSettleRef.current = null;

    const { pages: livePages, isEditMode: liveIsEditMode } = liveRef.current;
    const showBlankSlot = liveIsEditMode || state.displayedIndex === livePages.length;
    const needsHold = isLookaheadFreshMount(livePages, showBlankSlot, committedIndex, state.displayedIndex);
    const plan = planSlide(committedIndex, state, needsHold);

    if (plan.kind === 'atRest') return;

    if (plan.kind === 'snap') {
      applyInstant({ type: 'FORCE_LAND', target: plan.to });
      return;
    }

    let armRaf1 = 0;
    let armRaf2 = 0;

    const arm = () => {
      dispatch({ type: 'START_OVERSHOOT' });
      const track = trackRef.current;
      if (!track) return;
      // Deferred one more frame so the dispatch above has actually landed
      // and the track's transform reflects the overshoot before we start
      // listening for it to finish — otherwise the listener can attach
      // against the pre-overshoot transform value and race the transition
      // that's about to start.
      requestAnimationFrame(() => {
        cancelSettleRef.current = waitForTransitionEnd(track, 'transform', PAGE_SLIDE_SAFETY_TIMEOUT_MS, () => {
          cancelSettleRef.current = null;
          const preSettleState = liveRef.current.state;
          const settledState = pageSlideReducer(preSettleState, { type: 'SETTLED', landedOn: committedIndex });
          // Read off the queue as it stood BEFORE this settle consumed it —
          // that's the step (if any) it dequeued, which now needs its own
          // onCommit to become the next committedIndex and start its slide.
          const [nextTarget] = preSettleState.queue;
          // Deliberately NOT applyInstant/a plain dispatch here. When a
          // chained step follows (nextTarget defined), naively dispatching
          // SYNC and calling onCommit a frame later (even from inside a
          // separate requestAnimationFrame) is NOT enough to guarantee the
          // browser ever sees this settle's own resting value as a real,
          // separate style checkpoint — React can (and does) defer actually
          // committing/painting the SYNC update until it's ready to process
          // the onCommit-triggered update too, coalescing both into ONE
          // paint. Since SETTLED always sets trackOffsetReady:true
          // unconditionally, that single paint already reflects the NEXT
          // step's overshoot — and for the step landing on the very first or
          // last page specifically (no lookahead past the edge, so no hold
          // to separate things), that overshoot value is numerically
          // IDENTICAL to whatever was already painted a moment ago (the
          // track's 3-slot geometry is symmetric once you're not sitting on
          // page 1), so the browser sees no property change at all and never
          // fires a transition — the settle callback below waits out the
          // full safety timeout every time, which is what "reaching the
          // first/last page" was actually triggering.
          //
          // flushSync forces the settle's own reset to actually commit and
          // paint-eligible right here, synchronously; the forced reflow
          // right after makes the browser register that value as a genuine
          // "before" checkpoint before anything else touches the property —
          // only then is it safe to flip the no-transition class off and let
          // the chained commit's overshoot register as a real, transitioning
          // change from THAT checkpoint. Same defensive shape as the
          // Chromium reflow fix and outline-transition suppression
          // elsewhere in Grid.tsx, applied to a subtler case of the same
          // underlying problem: a value change that never gets its own
          // paint can't have "a transition it was supposed to play."
          const el = trackRef.current;
          el?.classList.add('grid-page-track--no-transition');
          flushSync(() => dispatch({ type: 'SYNC', state: settledState }));
          void el?.offsetHeight;
          el?.classList.remove('grid-page-track--no-transition');
          void el?.offsetHeight;
          if (nextTarget !== undefined) liveRef.current.onCommit(nextTarget);
        });
      });
    };

    if (plan.needsHold) {
      // Hold the track at rest for two frames so the browser can finish
      // mounting/laying out the incoming page's subtree before the CSS
      // transition starts competing with it for frame budget — see
      // isLookaheadFreshMount above. HOLD's own dispatch snaps the
      // transform from its overshot value back to resting (trackOffsetReady
      // flips false) — done here under the SAME no-transition class
      // applyInstant uses, and deliberately NOT removed until right before
      // arm() applies the real overshoot. Without this, that snap fires its
      // own genuine CSS transition (transitions are on by default); when
      // arm() then retargets the same property to the overshoot value a
      // couple of frames later, the browser continues that transition
      // in-flight rather than starting a fresh one — and since the target
      // barely moved, the remaining duration can be too short for the
      // transitionend listener (armed one frame after arm()) to still be
      // attached when it fires, or short enough to look like a snap even
      // when caught. Either way the real animation gets silently skipped
      // and the settle only happens via the safety timeout, ~600ms later —
      // this is what "spamming next" was actually still triggering even
      // after the queue was made unbounded, since it's on the hold path
      // that runs for nearly every fresh page in a rapid chain, not a
      // queuing issue at all.
      const track = trackRef.current;
      track?.classList.add('grid-page-track--no-transition');
      dispatch({ type: 'HOLD' });
      armRaf1 = requestAnimationFrame(() => {
        armRaf2 = requestAnimationFrame(() => {
          track?.classList.remove('grid-page-track--no-transition');
          // Forces the browser to commit that removal before arm()'s
          // dispatch changes the transform value on the same tick — same
          // defensive pattern as the Chromium reflow fix and the outline-
          // transition suppression elsewhere in Grid.tsx, to avoid a style-
          // recalc batching the class removal together with the value
          // change and missing that transitions are re-enabled.
          void track?.offsetHeight;
          arm();
        });
      });
    } else {
      arm();
    }

    return () => {
      cancelAnimationFrame(armRaf1);
      cancelAnimationFrame(armRaf2);
      cancelSettleRef.current?.();
      cancelSettleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedIndex, state.displayedIndex]);

  return {
    displayedIndex: state.displayedIndex,
    trackOffsetReady: state.trackOffsetReady,
    requestPage,
    resolveDeltaTarget,
    forceLand,
    resetToCommitted,
  };
}
