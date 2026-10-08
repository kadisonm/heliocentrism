import gridReducer, { deletePage, insertPage, reorderPages, type GridState } from '../../lib/store/gridSlice';
import type { DashboardPage } from '../../lib/types';

// The grid slice imports Firestore sync, which can't load under Jest; the reducers never call it.
jest.mock('../../lib/firebase/firebaseSync', () => ({}));

const page = (id: string, widgetCount = 0): DashboardPage => ({
  id,
  widgets: Array.from({ length: widgetCount }, (_, i) => ({ id: `${id}-w${i}`, type: 'clock' })),
  layout: [],
});

const state = (): GridState => ({
  isLoading: false,
  breakpoints: {
    desktop: { pages: [page('p1', 2), page('p2'), page('p3', 1)] },
    tablet: { pages: [page('t1', 1)] },
    mobile: { pages: [page('m1')] },
  },
});

const ids = (s: GridState, breakpoint: 'desktop' | 'tablet' = 'desktop') => s.breakpoints[breakpoint].pages.map((p) => p.id);

describe('reorderPages', () => {
  it("puts one breakpoint's pages in the given order", () => {
    expect(ids(gridReducer(state(), reorderPages({ breakpoint: 'desktop', pageIds: ['p3', 'p1', 'p2'] })))).toEqual(['p3', 'p1', 'p2']);
  });

  it("ignores a list that isn't exactly that breakpoint's pages", () => {
    for (const pageIds of [['p1', 'p2'], ['p1', 'p1', 'p2'], ['p1', 'p2', 'x']]) {
      expect(ids(gridReducer(state(), reorderPages({ breakpoint: 'desktop', pageIds })))).toEqual(['p1', 'p2', 'p3']);
    }
  });
});

describe('insertPage', () => {
  it('adds a blank page at the given position, including before the first', () => {
    const first = insertPage('desktop', 0);
    expect(ids(gridReducer(state(), first))).toEqual([first.payload.id, 'p1', 'p2', 'p3']);
    const between = insertPage('desktop', 2);
    const next = gridReducer(state(), between);
    expect(ids(next)).toEqual(['p1', 'p2', between.payload.id, 'p3']);
    expect(next.breakpoints.desktop.pages[2].widgets).toEqual([]);
  });
});

describe('deletePage', () => {
  it('removes the page and its widgets, leaving other breakpoints alone', () => {
    const next = gridReducer(state(), deletePage({ breakpoint: 'desktop', pageId: 'p1' }));
    expect(ids(next)).toEqual(['p2', 'p3']);
    expect(ids(next, 'tablet')).toEqual(['t1']);
  });

  it('replaces the only page with a blank one', () => {
    const next = gridReducer(state(), deletePage({ breakpoint: 'tablet', pageId: 't1' }));
    expect(next.breakpoints.tablet.pages).toHaveLength(1);
    expect(next.breakpoints.tablet.pages[0]).toMatchObject({ widgets: [], layout: [] });
    expect(next.breakpoints.tablet.pages[0].id).not.toBe('t1');
  });
});
