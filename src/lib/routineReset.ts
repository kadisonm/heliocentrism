import type { RecurrenceValue, RoutineResetTimes, RoutineTask } from './types';

// The most recent past instant at which a given recurrence's configured
// reset time occurred. Always <= now — if today's/this week's/this month's
// occurrence hasn't happened yet, steps back to the previous cycle's.
export function getMostRecentResetBoundary(
  recurrence: RecurrenceValue,
  resetTimes: RoutineResetTimes,
  now: Date
): Date {
  if (recurrence === 'daily') {
    const { hour, minute } = resetTimes.daily;
    const boundary = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (boundary > now) boundary.setDate(boundary.getDate() - 1);
    return boundary;
  }

  if (recurrence === 'weekly') {
    const { dayOfWeek, hour, minute } = resetTimes.weekly;
    const boundary = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    const dayDiff = (boundary.getDay() - dayOfWeek + 7) % 7;
    boundary.setDate(boundary.getDate() - dayDiff);
    if (boundary > now) boundary.setDate(boundary.getDate() - 7);
    return boundary;
  }

  // monthly
  const { dayOfMonth, hour, minute } = resetTimes.monthly;
  const daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const boundary = new Date(
    now.getFullYear(),
    now.getMonth(),
    Math.min(dayOfMonth, daysInThisMonth),
    hour,
    minute,
    0,
    0
  );
  if (boundary > now) {
    const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    boundary.setFullYear(now.getFullYear(), now.getMonth() - 1, Math.min(dayOfMonth, daysInLastMonth));
  }
  return boundary;
}

// A completed routine task is stale — and should reset back to "not done"
// — once its recurrence's reset boundary has passed since it was completed
// (or if we don't know when it was completed at all, e.g. pre-existing data).
export function shouldResetRoutineTask(
  task: RoutineTask,
  resetTimes: RoutineResetTimes,
  now: Date
): boolean {
  if (task.stage !== 2) return false;

  const boundary = getMostRecentResetBoundary(task.recurrence, resetTimes, now);
  if (!task.completedAt) return true;

  return new Date(task.completedAt) < boundary;
}
