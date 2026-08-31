// Pure decision logic for the page-slide carousel — no DOM, no timers, so it
// can be unit tested directly. See usePageSlide.ts for the hook that wires
// this up to the actual track transform/CSS transition.
//
// Two indices drive the carousel: `committedIndex` (the target, owned by the
// caller/parent state) and `state.displayedIndex` (which page is actually on
// screen right now, lagging one slide behind during a transition). A gap of
// exactly 1 between them is what "mid-slide, animating toward the next step"
// looks like; anything else is either "at rest" or "a distant jump that cuts
// straight there with no animation" — see planSlide.

export type SlidePhase = 'idle' | 'overshooting';

export type PageSlideState = {
  displayedIndex: number;
  phase: SlidePhase;
  // Gates whether the track's transform actually overshoots toward the new
  // page yet — false only for the couple of frames a fresh-page-subtree
  // mount needs to land before competing with the CSS transition for frame
  // budget (see isLookaheadFreshMount in Grid.tsx).
  trackOffsetReady: boolean;
  // Absolute targets requested while a slide is already in flight, in the
  // order they were accepted. Replaces the old signed-delta accumulator —
  // adjacency for a new request is judged against this queue's own tail
  // (falling back to committedIndex when empty), not always against
  // committedIndex directly, so a 3rd rapid request chains correctly even
  // once one step is already queued.
  queue: number[];
};

// Uncapped: every adjacent same-direction request queues, however many
// arrive before the current slide settles. A finite cap was tried first
// (1, then 5) but any finite number just moves the breaking point — spam
// past it and the overflowing request is no longer adjacent to the queue's
// own tail, so it supersedes and snaps straight there, skipping every page
// in between. That's the exact "some pages skip the animation" bug this
// whole machine exists to prevent, so there's no cap that fully satisfies
// it except none. The tradeoff: a long enough burst keeps the carousel
// visibly sliding for a while after the user stops clicking/holding a key,
// working through the backlog one animated step at a time — never a skip,
// just a delay.
export const MAX_QUEUED_PAGE_REQUESTS = Infinity;

export function createPageSlideState(initialIndex: number): PageSlideState {
  return {
    displayedIndex: initialIndex,
    phase: 'idle',
    trackOffsetReady: true,
    queue: [],
  };
}

export type PageRequestOutcome =
  // Nothing in flight, or this target supersedes what was — caller should
  // call onCommit(target) immediately. `state` already has the queue
  // cleared where a supersede discarded one; apply it via SYNC.
  | { kind: 'commit'; target: number; state: PageSlideState }
  // Adjacent to the queue's current tail, and there's room — apply `state`
  // via SYNC; no immediate commit.
  | { kind: 'queued'; state: PageSlideState }
  // Duplicate of the in-flight/queued target (or, in principle, the queue
  // is already at MAX_QUEUED_PAGE_REQUESTS — unreachable in practice now
  // that it's uncapped) — no-op, state unchanged.
  | { kind: 'ignored'; state: PageSlideState };

// `committedIndex` is passed in rather than read off `state` because it's
// owned by the caller (a prop, in Grid.tsx) — this machine only owns the
// display/queue side of the picture.
export function planPageRequest(
  target: number,
  committedIndex: number,
  state: PageSlideState
): PageRequestOutcome {
  const inFlight = committedIndex !== state.displayedIndex || state.queue.length > 0;
  if (!inFlight) return { kind: 'commit', target, state };

  const tail = state.queue.length > 0 ? state.queue[state.queue.length - 1] : committedIndex;
  const delta = target - tail;

  if (delta === 0) return { kind: 'ignored', state }; // duplicate of what's already the effective target

  if (Math.abs(delta) !== 1) {
    // Not adjacent to what's already queued/in-flight — supersedes it and
    // cuts straight there, same as an already-settled distant jump. Clear
    // the queue: whatever was pending no longer means anything once the
    // target moves somewhere non-adjacent.
    return { kind: 'commit', target, state: { ...state, queue: [] } };
  }

  if (state.queue.length >= MAX_QUEUED_PAGE_REQUESTS) return { kind: 'ignored', state };

  return { kind: 'queued', state: { ...state, queue: [...state.queue, target] } };
}

export type SlidePlan =
  | { kind: 'atRest' }
  | { kind: 'snap'; to: number }
  | { kind: 'animate'; needsHold: boolean };

export function planSlide(committedIndex: number, state: PageSlideState, needsHold: boolean): SlidePlan {
  const diff = committedIndex - state.displayedIndex;
  if (diff === 0) return { kind: 'atRest' };
  if (Math.abs(diff) !== 1) return { kind: 'snap', to: committedIndex };
  return { kind: 'animate', needsHold };
}

export type PageSlideAction =
  // The transform is about to change this commit (overshoot toward the new
  // page starts now).
  | { type: 'START_OVERSHOOT' }
  // Entering the fresh-mount pre-hold — trackOffsetReady goes false until
  // the hold clears.
  | { type: 'HOLD' }
  // transitionend (or its safety-timeout fallback) fired — land on the
  // target and, if anything was queued, dequeue the next step (the caller
  // is responsible for committing that dequeued target — see usePageSlide).
  | { type: 'SETTLED'; landedOn: number }
  // Corrective/programmatic reposition (drag-hop, auto-delete, breakpoint
  // switch, a manual drag seizing control mid-slide) — clears the queue and
  // lands instantly regardless of adjacency, interrupting whatever was in
  // flight rather than animating or queuing behind it.
  | { type: 'FORCE_LAND'; target: number }
  // Applies a state produced by planPageRequest (the 'queued' and
  // queue-clearing 'commit' cases) verbatim.
  | { type: 'SYNC'; state: PageSlideState };

export function pageSlideReducer(state: PageSlideState, action: PageSlideAction): PageSlideState {
  switch (action.type) {
    case 'START_OVERSHOOT':
      // Also un-does HOLD's trackOffsetReady:false — this is the moment the
      // overshoot transform is actually allowed to apply, whether or not a
      // hold preceded it.
      return { ...state, phase: 'overshooting', trackOffsetReady: true };
    case 'HOLD':
      return { ...state, phase: 'overshooting', trackOffsetReady: false };
    case 'SETTLED': {
      const [nextTarget, ...rest] = state.queue;
      return {
        displayedIndex: action.landedOn,
        phase: nextTarget !== undefined ? 'overshooting' : 'idle',
        trackOffsetReady: true,
        queue: rest,
      };
    }
    case 'FORCE_LAND':
      return {
        displayedIndex: action.target,
        phase: 'idle',
        trackOffsetReady: true,
        queue: [],
      };
    case 'SYNC':
      return action.state;
    default:
      return state;
  }
}
