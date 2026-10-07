import { toDateKey } from '../dateKey';
import type { Habit, HabitDay, HabitGoal } from '../types';

export function meetsGoal(goal: HabitGoal, value: number): boolean {
  switch (goal.type) {
    case 'check':
      return value >= 1;
    case 'quantity':
      return value >= goal.target;
    case 'abstain':
      return value === 0;
  }
}

// The amount that counts as a full day — the denominator for progress.
export function goalTarget(goal: HabitGoal): number {
  return goal.type === 'quantity' ? goal.target : 1;
}

// The value that flips a day between complete and not — what a one-tap "mark done" logs.
export function toggledValue(goal: HabitGoal, complete: boolean): number {
  if (goal.type === 'abstain') return complete ? 1 : 0;
  return complete ? 0 : goalTarget(goal);
}

// First day the habit is tracked from (its creation day).
export function habitStartKey(habit: Habit): string {
  return toDateKey(new Date(habit.createdAt));
}

export function dayValue(habit: Habit, key: string): number {
  return habit.log[key]?.value ?? 0;
}

// Builds the log entry for a newly logged value, or null when there's nothing worth storing.
// completedAt keeps the first time the goal was met, and clears if the value drops below it.
export function nextHabitDay(goal: HabitGoal, previous: HabitDay | undefined, value: number, nowIso: string): HabitDay | null {
  if (value <= 0) return null;
  return { value, completedAt: meetsGoal(goal, value) ? previous?.completedAt ?? nowIso : null };
}

// Abstain days are complete unless a slip was logged; other goals need a stored completion.
export function isDayComplete(habit: Habit, key: string): boolean {
  if (key < habitStartKey(habit)) return false;
  if (habit.goal.type === 'abstain') return dayValue(habit, key) === 0;
  return habit.log[key]?.completedAt != null;
}

// 0..1 — partial progress only exists for quantity goals.
export function dayProgress(habit: Habit, key: string): number {
  if (isDayComplete(habit, key)) return 1;
  if (habit.goal.type !== 'quantity') return 0;
  return Math.min(dayValue(habit, key) / habit.goal.target, 1);
}
