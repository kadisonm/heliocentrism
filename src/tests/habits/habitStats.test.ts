import { dayProgress, isDayComplete, nextHabitDay } from '../../lib/habits/habitGoal';
import { completionRate, currentStreak, longestStreak } from '../../lib/habits/habitStats';
import type { Habit, HabitGoal } from '../../lib/types';

const DONE = '2026-01-01T12:00:00.000Z';

function makeHabit(goal: HabitGoal, log: Habit['log'] = {}): Habit {
  return {
    id: 'h',
    name: 'Test',
    color: 'blue',
    goal,
    source: { kind: 'manual' },
    order: 0,
    createdAt: new Date(2026, 0, 1, 8).toISOString(), // local 2026-01-01
    log,
  };
}

const done = (value = 1) => ({ value, completedAt: DONE });

describe('nextHabitDay', () => {
  const quantity: HabitGoal = { type: 'quantity', target: 2, unit: 'times', step: 1 };

  it('stamps completion only once the target is met', () => {
    expect(nextHabitDay(quantity, undefined, 1, 'now')).toEqual({ value: 1, completedAt: null });
    expect(nextHabitDay(quantity, { value: 1, completedAt: null }, 2, 'now')).toEqual({ value: 2, completedAt: 'now' });
  });

  it('keeps the first completion time and clears it when dropping below target', () => {
    expect(nextHabitDay(quantity, { value: 2, completedAt: 'first' }, 3, 'later')?.completedAt).toBe('first');
    expect(nextHabitDay(quantity, { value: 2, completedAt: 'first' }, 1, 'later')?.completedAt).toBeNull();
  });

  it('drops empty days from the log', () => {
    expect(nextHabitDay({ type: 'check' }, done(), 0, 'now')).toBeNull();
  });
});

describe('isDayComplete / dayProgress', () => {
  it('treats abstain days as complete unless a slip is logged', () => {
    const habit = makeHabit({ type: 'abstain' }, { '2026-01-02': { value: 1, completedAt: null } });
    expect(isDayComplete(habit, '2026-01-01')).toBe(true);
    expect(isDayComplete(habit, '2026-01-02')).toBe(false);
  });

  it('never counts days before creation', () => {
    expect(isDayComplete(makeHabit({ type: 'abstain' }), '2025-12-31')).toBe(false);
  });

  it('reports partial progress for quantity goals', () => {
    const habit = makeHabit({ type: 'quantity', target: 4, unit: 'km', step: 1 }, { '2026-01-01': { value: 1, completedAt: null } });
    expect(dayProgress(habit, '2026-01-01')).toBe(0.25);
  });
});

describe('streaks and rates', () => {
  const habit = makeHabit(
    { type: 'check' },
    { '2026-01-01': done(), '2026-01-02': done(), '2026-01-03': done(), '2026-01-05': done(), '2026-01-06': done() }
  );

  it('counts the current streak through yesterday while today is unfinished', () => {
    expect(currentStreak(habit, '2026-01-07')).toBe(2);
    expect(currentStreak(habit, '2026-01-06')).toBe(2);
    expect(currentStreak(habit, '2026-01-08')).toBe(0);
  });

  it('finds the longest streak', () => {
    expect(longestStreak(habit, '2026-01-07')).toBe(3);
  });

  it('ignores an unfinished today and days before creation in the rate', () => {
    // Jan 1–6 tracked (today Jan 7 unfinished): 5 of 6 complete.
    expect(completionRate(habit, '2026-01-07', 30)).toBeCloseTo(5 / 6);
  });
});
