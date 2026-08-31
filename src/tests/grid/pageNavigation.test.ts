import { buildVirtualPages, clampPageIndex, isLookaheadFreshMount, virtualPageSignature } from '../../lib/grid/pageNavigation';
import { MAX_PAGES_PER_BREAKPOINT } from '../../lib/grid/gridConfig';
import type { DashboardPage } from '../../lib/types';

function makePages(count: number): DashboardPage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `page-${i}`,
    widgets: [],
    layout: [],
  }));
}

describe('clampPageIndex', () => {
  it('clamps below 0 up to 0', () => {
    expect(clampPageIndex(-5, 3, false)).toBe(0);
  });

  it('clamps above the last real page when not editing', () => {
    expect(clampPageIndex(10, 3, false)).toBe(2);
  });

  it('allows the blank-slot index (== pageCount) while editing', () => {
    expect(clampPageIndex(3, 3, true)).toBe(3);
  });

  it('still clamps past the blank-slot index while editing', () => {
    expect(clampPageIndex(10, 3, true)).toBe(3);
  });

  it('passes through values already in range unchanged', () => {
    expect(clampPageIndex(1, 3, false)).toBe(1);
    expect(clampPageIndex(2, 3, true)).toBe(2);
  });

  it('does not go negative when pageCount is 0', () => {
    expect(clampPageIndex(0, 0, false)).toBe(0);
    expect(clampPageIndex(-1, 0, false)).toBe(0);
  });
});

describe('buildVirtualPages', () => {
  it('maps real pages 1:1 in order', () => {
    const pages = makePages(3);
    const virtual = buildVirtualPages(pages, false);
    expect(virtual).toEqual(pages.map((page) => ({ kind: 'real', page })));
  });

  it('appends no blank entry when not editing, regardless of count', () => {
    const virtual = buildVirtualPages(makePages(5), false);
    expect(virtual.every((vp) => vp.kind === 'real')).toBe(true);
    expect(virtual).toHaveLength(5);
  });

  it('appends a blank entry while editing, under the page cap', () => {
    const pages = makePages(2);
    const virtual = buildVirtualPages(pages, true);
    expect(virtual).toHaveLength(3);
    expect(virtual[2]).toEqual({ kind: 'blank' });
  });

  it('omits the blank entry while editing once the page cap is reached', () => {
    const pages = makePages(MAX_PAGES_PER_BREAKPOINT);
    const virtual = buildVirtualPages(pages, true);
    expect(virtual).toHaveLength(MAX_PAGES_PER_BREAKPOINT);
    expect(virtual.every((vp) => vp.kind === 'real')).toBe(true);
  });

  it('produces a single blank entry for an empty page list while editing', () => {
    const virtual = buildVirtualPages([], true);
    expect(virtual).toEqual([{ kind: 'blank' }]);
  });
});

describe('virtualPageSignature', () => {
  it("identifies a real page by its id, not object identity", () => {
    const page = makePages(1)[0];
    expect(virtualPageSignature({ kind: 'real', page })).toBe(page.id);
  });

  it("identifies a blank slot as 'blank'", () => {
    expect(virtualPageSignature({ kind: 'blank' })).toBe('blank');
  });

  it("identifies a missing slot (null) as 'none'", () => {
    expect(virtualPageSignature(null)).toBe('none');
  });
});

describe('isLookaheadFreshMount', () => {
  const pages = makePages(5); // page-0 .. page-4

  it('is true when a real page 2 steps ahead exists and is not yet mounted', () => {
    // At rest on page-0 (displayedIndex=0), sliding forward to page-1
    // (committedIndex=1) — the lookahead is page-2, not currently prev/
    // current/next (prev=none, current=page-0, next=page-1).
    expect(isLookaheadFreshMount(pages, false, 1, 0)).toBe(true);
  });

  it('is true sliding backward too, symmetrically', () => {
    // Sitting on page-4 (displayedIndex=4), sliding back to page-3 — the
    // lookahead is page-2 (4 + (-1)*2), not currently mounted.
    expect(isLookaheadFreshMount(pages, false, 3, 4)).toBe(true);
  });

  it('is false when there is no page 2 steps ahead (out of bounds)', () => {
    // Sitting on the second-to-last page, sliding to the last — nothing
    // exists 2 steps beyond it.
    expect(isLookaheadFreshMount(pages, false, 4, 3)).toBe(false);
  });

  it('is false when committed and displayed are not adjacent (not really sliding)', () => {
    expect(isLookaheadFreshMount(pages, false, 3, 0)).toBe(false);
    expect(isLookaheadFreshMount(pages, false, 0, 0)).toBe(false);
  });

  it('treats the blank "new page" slot as a real lookahead target while editing', () => {
    // 5 real pages + a blank slot (virtual index 5). Sitting on page-3,
    // sliding to page-4 — the lookahead is the blank slot itself.
    expect(isLookaheadFreshMount(pages, true, 4, 3)).toBe(true);
  });
});
