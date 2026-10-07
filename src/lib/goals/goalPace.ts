import { daysBetweenKeys } from '../dateKey';
import type { Goal } from '../types';
import { goalCurrent, goalStartValue, goalTarget, progressOf, type GoalSources } from './goalProgress';

export type GoalPaceStatus = 'complete' | 'ahead' | 'on-track' | 'behind' | 'overdue' | 'none';

export type GoalPace = {
  status: GoalPaceStatus;
  daysLeft: number | null; // 0 = due today, negative = overdue, null = no deadline
  expected: number | null; // 0..1 an even pace would have reached by now
  requiredPerWeek: number | null; // amount still needed per week to finish on time
};

// Progress within this much of the even pace still counts as on track.
const ON_TRACK_TOLERANCE = 0.05;

export function goalPace(goal: Goal, sources: GoalSources, today: string): GoalPace {
  const current = goalCurrent(goal, sources, today);
  const target = goalTarget(goal, sources);
  const progress = progressOf(goal, current, target);
  const daysLeft = goal.deadline ? daysBetweenKeys(today, goal.deadline) : null;

  if (progress >= 1) return { status: 'complete', daysLeft, expected: null, requiredPerWeek: null };
  if (!goal.deadline || daysLeft === null) return { status: 'none', daysLeft, expected: null, requiredPerWeek: null };
  if (daysLeft < 0) return { status: 'overdue', daysLeft, expected: 1, requiredPerWeek: null };

  // Today is still in progress, so the even pace is measured up to the end of yesterday.
  const totalDays = daysBetweenKeys(goal.startDate, goal.deadline) + 1;
  const elapsedDays = Math.max(daysBetweenKeys(goal.startDate, today), 0);
  const expected = Math.min(elapsedDays / totalDays, 1);

  const status = progress >= expected + ON_TRACK_TOLERANCE ? 'ahead' : progress < expected - ON_TRACK_TOLERANCE ? 'behind' : 'on-track';
  const remaining = Math.abs(target - current);
  const weeksLeft = (daysLeft + 1) / 7;
  const requiredPerWeek = goalStartValue(goal) === target ? null : remaining / weeksLeft;

  return { status, daysLeft, expected, requiredPerWeek };
}
