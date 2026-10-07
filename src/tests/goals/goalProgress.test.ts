import { goalCompletedOn, goalCurrent, goalProgress, goalSeries, isGoalLinkMissing, type GoalSources } from '../../lib/goals/goalProgress';
import type { Goal, GoalMeasure, Habit, Task } from '../../lib/types';

const NO_SOURCES: GoalSources = { habits: [], tasks: [], taskLists: [] };
// Local-time ISO stamp for a 'YYYY-MM-DD' day, so date keys don't shift with the test machine's timezone.
const at = (key: string) => new Date(`${key}T12:00:00`).toISOString();

function makeGoal(measure: GoalMeasure, startDate = '2026-01-01'): Goal {
  return { id: 'g', name: 'Goal', color: 'blue', measure, startDate, deadline: null, order: 0, createdAt: at(startDate) };
}

describe('milestone goals', () => {
  const goal = makeGoal({
    type: 'milestones',
    milestones: [
      { id: 'a', title: 'A', completedAt: at('2026-01-02') },
      { id: 'b', title: 'B', completedAt: null },
      { id: 'c', title: 'C', completedAt: at('2026-01-03') },
      { id: 'd', title: 'D', completedAt: null },
    ],
  });

  it('measures steps done out of total', () => {
    expect(goalProgress(goal, NO_SOURCES, '2026-01-05')).toBe(0.5);
  });

  it('builds a running series from the start date', () => {
    expect(goalSeries(goal, NO_SOURCES, '2026-01-03').map((p) => p.value)).toEqual([0, 1, 2]);
  });
});

describe('numeric goals', () => {
  it('adds dated entries to the start value', () => {
    const goal = makeGoal({
      type: 'numeric',
      start: 0,
      target: 10,
      unit: 'books',
      entries: [
        { id: '1', date: '2026-01-02', amount: 3 },
        { id: '2', date: '2026-01-04', amount: 2 },
      ],
    });
    expect(goalCurrent(goal, NO_SOURCES, '2026-01-03')).toBe(3);
    expect(goalProgress(goal, NO_SOURCES, '2026-01-05')).toBe(0.5);
  });

  it('supports decreasing goals and finds the completion day', () => {
    const goal = makeGoal({
      type: 'numeric',
      start: 80,
      target: 76,
      unit: 'kg',
      entries: [
        { id: '1', date: '2026-01-02', amount: -2 },
        { id: '2', date: '2026-01-04', amount: -2 },
      ],
    });
    expect(goalProgress(goal, NO_SOURCES, '2026-01-02')).toBe(0.5);
    expect(goalCompletedOn(goal, NO_SOURCES, '2026-01-10')).toBe('2026-01-04');
  });
});

describe('habit-linked goals', () => {
  const habit: Habit = {
    id: 'h',
    name: 'Jog',
    color: 'red',
    goal: { type: 'quantity', target: 2, unit: 'km', step: 0.5 },
    source: { kind: 'manual' },
    order: 0,
    createdAt: at('2025-12-01'),
    log: {
      '2025-12-31': { value: 5, completedAt: at('2025-12-31') }, // before the goal started
      '2026-01-01': { value: 3, completedAt: at('2026-01-01') },
      '2026-01-02': { value: 1, completedAt: null },
    },
  };
  const sources: GoalSources = { ...NO_SOURCES, habits: [habit] };

  it('sums values from the start date for a total metric', () => {
    const goal = makeGoal({ type: 'habit', habitId: 'h', metric: 'total', target: 8 });
    expect(goalCurrent(goal, sources, '2026-01-03')).toBe(4);
  });

  it('counts complete days for a days metric', () => {
    const goal = makeGoal({ type: 'habit', habitId: 'h', metric: 'days', target: 10 });
    expect(goalCurrent(goal, sources, '2026-01-03')).toBe(1);
  });

  it('flags a deleted habit', () => {
    const goal = makeGoal({ type: 'habit', habitId: 'gone', metric: 'days', target: 10 });
    expect(isGoalLinkMissing(goal, sources)).toBe(true);
  });
});

describe('task-list goals', () => {
  const task = (id: string, done: boolean): Task => ({
    id,
    parentId: 'list',
    order: 0,
    title: id,
    stage: done ? 1 : 0,
    stages: [
      { id: 's0', name: '', color: 'none' },
      { id: 's1', name: '', color: 'none' },
    ],
    due: '',
    createdAt: at('2026-01-01'),
    updatedAt: at('2026-01-01'),
    completedAt: done ? at('2026-01-02') : null,
  });

  it('measures done tasks out of every task in the list', () => {
    const goal = makeGoal({ type: 'taskList', listId: 'list' });
    const sources: GoalSources = { ...NO_SOURCES, tasks: [task('a', true), task('b', false)], taskLists: [{ id: 'list', name: 'L' }] };
    expect(goalProgress(goal, sources, '2026-01-05')).toBe(0.5);
    expect(isGoalLinkMissing(goal, sources)).toBe(false);
  });
});
