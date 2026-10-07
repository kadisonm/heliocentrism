import { addDaysToKey } from '../dateKey';
import type { Habit } from '../types';
import { habitStartKey, isDayComplete } from './habitGoal';

// Consecutive complete days ending today — or yesterday, since today is still in progress.
export function currentStreak(habit: Habit, today: string): number {
  const start = habitStartKey(habit);
  let key = isDayComplete(habit, today) ? today : addDaysToKey(today, -1);
  let streak = 0;
  while (key >= start && isDayComplete(habit, key)) {
    streak++;
    key = addDaysToKey(key, -1);
  }
  return streak;
}

export function longestStreak(habit: Habit, today: string): number {
  let longest = 0;
  let run = 0;
  for (let key = habitStartKey(habit); key <= today; key = addDaysToKey(key, 1)) {
    run = isDayComplete(habit, key) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

// Share (0..1) of the last `days` days that were complete, ignoring days before creation.
// Today only counts once it's complete, so an unfinished morning doesn't drag the rate down.
export function completionRate(habit: Habit, today: string, days: number): number {
  const start = habitStartKey(habit);
  let tracked = 0;
  let complete = 0;
  for (let offset = 0; offset < days; offset++) {
    const key = addDaysToKey(today, -offset);
    if (key < start) break;
    const done = isDayComplete(habit, key);
    if (key === today && !done) continue;
    tracked++;
    if (done) complete++;
  }
  return tracked === 0 ? 0 : complete / tracked;
}
