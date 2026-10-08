import type { LayoutItem } from 'react-grid-layout';
import { layoutBottom, pushDownOverlaps } from '../../lib/grid/layoutPush';

const item = (i: string, x: number, y: number, w: number, h: number): LayoutItem => ({ i, x, y, w, h });
const ys = (layout: LayoutItem[]) => Object.fromEntries(layout.map((it) => [it.i, it.y]));

describe('pushDownOverlaps', () => {
  it('leaves gaps alone — no gravity', () => {
    const layout = [item('a', 0, 0, 4, 2), item('b', 0, 10, 4, 2)];
    expect(ys(pushDownOverlaps(layout))).toEqual({ a: 0, b: 10 });
  });

  it('pushes overlapped items down and cascades', () => {
    // `a` has grown from 2 to 6 rows, into `b`, which then sits on `c`.
    const layout = [item('a', 0, 0, 4, 6), item('b', 0, 3, 4, 2), item('c', 0, 5, 4, 2), item('d', 6, 3, 2, 2)];
    expect(ys(pushDownOverlaps(layout))).toEqual({ a: 0, b: 6, c: 8, d: 3 });
  });

  it('returns pushed items home once the overlap is gone', () => {
    // Same homes as above, but `a` has shrunk back — recomputing from homes undoes the push.
    const layout = [item('a', 0, 0, 4, 2), item('b', 0, 3, 4, 2), item('c', 0, 5, 4, 2)];
    expect(ys(pushDownOverlaps(layout))).toEqual({ a: 0, b: 3, c: 5 });
  });

  it('keeps anchored items in place and pushes the others out of their way', () => {
    // `b` is dragged up onto `a`'s spot.
    const layout = [item('a', 0, 0, 4, 2), item('b', 0, 1, 4, 2)];
    expect(ys(pushDownOverlaps(layout, ['b']))).toEqual({ a: 3, b: 1 });
  });

  it('does not mutate its input', () => {
    const layout = [item('a', 0, 0, 4, 4), item('b', 0, 1, 4, 2)];
    pushDownOverlaps(layout);
    expect(layout[1].y).toBe(1);
  });
});

describe('layoutBottom', () => {
  it('finds the first free row, ignoring unresolved positions', () => {
    expect(layoutBottom([item('a', 0, 2, 4, 3), item('b', 0, Infinity, 4, 2)])).toBe(5);
    expect(layoutBottom([])).toBe(0);
  });
});
