import {
  createPageSlideState,
  MAX_QUEUED_PAGE_REQUESTS,
  pageSlideReducer,
  planPageRequest,
  planSlide,
  type PageSlideState,
} from '../../lib/grid/pageSlideMachine';

describe('planPageRequest', () => {
  it('commits immediately when idle, for an adjacent target', () => {
    const state = createPageSlideState(0);
    const outcome = planPageRequest(1, 0, state);
    expect(outcome).toMatchObject({ kind: 'commit', target: 1 });
  });

  it('commits immediately when idle, for a distant target', () => {
    const state = createPageSlideState(0);
    const outcome = planPageRequest(5, 0, state);
    expect(outcome).toMatchObject({ kind: 'commit', target: 5 });
  });

  it('queues a request adjacent to the queue tail while mid-slide', () => {
    // committedIndex=1, displayedIndex=0 — a slide from 0 to 1 is in flight.
    const state = createPageSlideState(0);
    const outcome = planPageRequest(2, 1, state);
    expect(outcome.kind).toBe('queued');
    expect((outcome as { state: PageSlideState }).state.queue).toEqual([2]);
  });

  it('recognizes a 3rd rapid request as adjacent to the queue tail, not a distant jump off the stale committedIndex', () => {
    let state = createPageSlideState(0);
    const first = planPageRequest(2, 1, state); // mid-slide (0->1), queue: [2]
    expect(first.kind).toBe('queued');
    state = (first as { state: PageSlideState }).state;

    // committedIndex is still 1 (hasn't advanced — nothing has settled yet),
    // but the queue's own tail is 2. A naive delta against committedIndex
    // (3 - 1 = 2) would misread this as a distant jump and wrongly supersede
    // the already-queued step 2, snapping instead of animating it. Judged
    // against the tail (3 - 2 = 1) it's correctly adjacent, so it queues
    // right behind it instead.
    const second = planPageRequest(3, 1, state);
    expect(second.kind).toBe('queued');
    expect((second as { state: PageSlideState }).state.queue).toEqual([2, 3]);
  });

  it('never drops an adjacent request for being over capacity — the queue is uncapped', () => {
    expect(MAX_QUEUED_PAGE_REQUESTS).toBe(Infinity);

    let state = createPageSlideState(0);
    const BURST = 50; // far more than any realistic click/key-repeat burst
    for (let i = 0; i < BURST; i++) {
      const outcome = planPageRequest(2 + i, 1, state);
      expect(outcome.kind).toBe('queued'); // never 'ignored' for hitting a cap
      state = (outcome as { state: PageSlideState }).state;
    }
    expect(state.queue).toHaveLength(BURST);
  });

  it('ignores a duplicate of the in-flight target', () => {
    const state = createPageSlideState(0);
    const outcome = planPageRequest(1, 1, state); // already the in-flight target
    expect(outcome).toEqual({ kind: 'ignored', state });
  });

  it('ignores a duplicate of the queue tail', () => {
    let state = createPageSlideState(0);
    const first = planPageRequest(2, 1, state);
    state = (first as { state: PageSlideState }).state;
    const second = planPageRequest(2, 1, state);
    expect(second).toEqual({ kind: 'ignored', state });
  });

  it('supersedes and clears the queue on a non-adjacent request mid-slide', () => {
    let state = createPageSlideState(0);
    const first = planPageRequest(2, 1, state); // queue: [2]
    state = (first as { state: PageSlideState }).state;

    const jump = planPageRequest(10, 1, state);
    expect(jump.kind).toBe('commit');
    expect((jump as { target: number }).target).toBe(10);
    expect((jump as { state: PageSlideState }).state.queue).toEqual([]);
  });
});

describe('planSlide', () => {
  it('reports atRest when committed matches displayed', () => {
    const state = createPageSlideState(3);
    expect(planSlide(3, state, false)).toEqual({ kind: 'atRest' });
  });

  it('reports animate for an adjacent gap, passing needsHold through unchanged', () => {
    const state = createPageSlideState(0);
    expect(planSlide(1, state, false)).toEqual({ kind: 'animate', needsHold: false });
    expect(planSlide(1, state, true)).toEqual({ kind: 'animate', needsHold: true });
    expect(planSlide(-1, state, false)).toEqual({ kind: 'animate', needsHold: false });
  });

  it('reports snap for a non-adjacent gap', () => {
    const state = createPageSlideState(0);
    expect(planSlide(5, state, false)).toEqual({ kind: 'snap', to: 5 });
  });

  it('has no special case for who changed committedIndex — an externally-arrived adjacent change animates the same as an internal request', () => {
    // e.g. page.tsx clamping activePageIndex on edit-mode-exit vs. a
    // keyboard/dot request calling onCommit — planSlide only ever looks at
    // the committedIndex/displayedIndex gap, never the caller's identity.
    const state = createPageSlideState(4);
    expect(planSlide(5, state, false)).toEqual({ kind: 'animate', needsHold: false });
  });
});

describe('pageSlideReducer', () => {
  it('SETTLED with an empty queue returns to idle at the landed index', () => {
    const state: PageSlideState = { displayedIndex: 0, phase: 'overshooting', trackOffsetReady: true, queue: [] };
    const next = pageSlideReducer(state, { type: 'SETTLED', landedOn: 1 });
    expect(next).toEqual({ displayedIndex: 1, phase: 'idle', trackOffsetReady: true, queue: [] });
  });

  it('SETTLED with a queued item dequeues it and starts the next step', () => {
    const state: PageSlideState = { displayedIndex: 0, phase: 'overshooting', trackOffsetReady: true, queue: [2] };
    const next = pageSlideReducer(state, { type: 'SETTLED', landedOn: 1 });
    expect(next).toEqual({ displayedIndex: 1, phase: 'overshooting', trackOffsetReady: true, queue: [] });
  });

  it('FORCE_LAND clears the queue and lands regardless of adjacency', () => {
    const state: PageSlideState = { displayedIndex: 0, phase: 'overshooting', trackOffsetReady: false, queue: [2] };
    const next = pageSlideReducer(state, { type: 'FORCE_LAND', target: 9 });
    expect(next).toEqual({ displayedIndex: 9, phase: 'idle', trackOffsetReady: true, queue: [] });
  });

  it('HOLD marks trackOffsetReady false while entering overshoot', () => {
    const state = createPageSlideState(0);
    const next = pageSlideReducer(state, { type: 'HOLD' });
    expect(next).toEqual({ displayedIndex: 0, phase: 'overshooting', trackOffsetReady: false, queue: [] });
  });
});

describe('end-to-end sequencing', () => {
  // Drives the same request/settle loop usePageSlide's effect does, purely
  // in terms of this module's own functions, so these tests exercise the
  // real interaction between planPageRequest/pageSlideReducer rather than
  // re-deriving the rules by hand.
  function makeHarness() {
    let state = createPageSlideState(0);
    let committedIndex = 0;
    const settledOrder: number[] = [];

    const request = (target: number) => {
      const outcome = planPageRequest(target, committedIndex, state);
      if (outcome.kind === 'ignored') return;
      state = pageSlideReducer(state, { type: 'SYNC', state: outcome.state });
      if (outcome.kind === 'commit') committedIndex = outcome.target;
    };

    const settle = () => {
      const [nextTarget] = state.queue; // capture before the reducer dequeues it
      state = pageSlideReducer(state, { type: 'SETTLED', landedOn: committedIndex });
      settledOrder.push(committedIndex);
      if (nextTarget !== undefined) committedIndex = nextTarget;
    };

    // Settles repeatedly until the queue is fully drained (idle) — mirrors
    // usePageSlide playing out every chained step one settle at a time.
    const settleUntilIdle = () => {
      settle();
      while (state.phase !== 'idle') settle();
    };

    return { request, settle, settleUntilIdle, getState: () => state, getSettledOrder: () => settledOrder };
  }

  it('a long rapid-click burst chains every step in order, skipping none', () => {
    const { request, settleUntilIdle, getState, getSettledOrder } = makeHarness();

    // Far more rapid "next" requests than any realistic click/key-repeat
    // burst, all fired before anything settles — one commits immediately,
    // every other one queues right behind it (see MAX_QUEUED_PAGE_REQUESTS's
    // own comment on why this queue is deliberately uncapped: a finite cap
    // just moves the point at which the "some pages skip" bug resurfaces).
    const BURST = 50;
    for (let target = 1; target <= BURST; target++) request(target);

    settleUntilIdle();

    expect(getState().displayedIndex).toBe(BURST);
    expect(getState().phase).toBe('idle');
    // Every page from 1 through the final target landed, in order — none
    // skipped, no matter how long the burst.
    expect(getSettledOrder()).toEqual(Array.from({ length: BURST }, (_, i) => i + 1));
  });

  it('a distant (non-adjacent) request mid-burst supersedes the queue and jumps straight there', () => {
    const { request, settleUntilIdle, getState } = makeHarness();

    for (let target = 1; target <= 10; target++) request(target);
    expect(getState().queue).toHaveLength(9); // 1 committed immediately, 2..10 queued

    // Not adjacent to the queue's tail (10) — supersedes it outright,
    // discarding the queued 2..10 rather than playing them out first. This
    // is the one deliberate case a page can still visibly skip: a genuine
    // distant jump (e.g. clicking a far-away dot), never a same-direction
    // rapid-click/key-repeat burst.
    request(100);
    expect(getState().queue).toEqual([]);

    settleUntilIdle();
    expect(getState().displayedIndex).toBe(100);
  });
});
