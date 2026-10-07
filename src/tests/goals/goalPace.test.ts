import { goalPace } from '../../lib/goals/goalPace';
import type { GoalSources } from '../../lib/goals/goalProgress';
import type { Goal } from '../../lib/types';

const NO_SOURCES: GoalSources = { habits: [], tasks: [], taskLists: [] };

// 0 → 10 over the 10 days 2026-01-01..2026-01-10, with `done` logged on day one.
function makeGoal(done: number, deadline: string | null = '2026-01-10'): Goal {
  return {
    id: 'g',
    name: 'Goal',
    color: 'blue',
    measure: { type: 'numeric', start: 0, target: 10, unit: '', entries: [{ id: '1', date: '2026-01-01', amount: done }] },
    startDate: '2026-01-01',
    deadline,
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('goalPace', () => {
  it('compares progress to an even pace up to yesterday', () => {
    // On Jan 6, five of ten days have passed: expected 0.5.
    expect(goalPace(makeGoal(5), NO_SOURCES, '2026-01-06').status).toBe('on-track');
    expect(goalPace(makeGoal(8), NO_SOURCES, '2026-01-06').status).toBe('ahead');
    expect(goalPace(makeGoal(2), NO_SOURCES, '2026-01-06').status).toBe('behind');
  });

  it('works out the weekly rate still needed', () => {
    // 7 left with 7 days (incl. today) remaining.
    const pace = goalPace(makeGoal(3), NO_SOURCES, '2026-01-04');
    expect(pace.daysLeft).toBe(6);
    expect(pace.requiredPerWeek).toBeCloseTo(7);
  });

  it('reports complete, overdue, and no-deadline goals', () => {
    expect(goalPace(makeGoal(10), NO_SOURCES, '2026-01-06').status).toBe('complete');
    expect(goalPace(makeGoal(5), NO_SOURCES, '2026-01-12').status).toBe('overdue');
    expect(goalPace(makeGoal(5, null), NO_SOURCES, '2026-01-06').status).toBe('none');
  });
});
