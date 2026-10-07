import { addDaysToKey, toDateKey } from '../dateKey';
import { dayValue, habitStartKey, isDayComplete } from '../habits/habitGoal';
import { isTaskDone } from '../tasks/taskCascade';
import type { Goal, Habit, Task, TaskList } from '../types';

// The other collections linked goals read their progress from.
export type GoalSources = { habits: Habit[]; tasks: Task[]; taskLists: TaskList[] };

export type GoalPoint = { date: string; value: number };

// Whether a linked goal's habit / task list has since been deleted.
export function isGoalLinkMissing(goal: Goal, sources: GoalSources): boolean {
  const { measure } = goal;
  if (measure.type === 'habit') return !sources.habits.some((habit) => habit.id === measure.habitId);
  if (measure.type === 'taskList') return !sources.taskLists.some((list) => list.id === measure.listId);
  return false;
}

export function goalStartValue(goal: Goal): number {
  return goal.measure.type === 'numeric' ? goal.measure.start : 0;
}

export function goalTarget(goal: Goal, sources: GoalSources): number {
  const { measure } = goal;
  switch (measure.type) {
    case 'milestones':
      return measure.milestones.length;
    case 'numeric':
    case 'habit':
      return measure.target;
    case 'taskList':
      return sources.tasks.filter((task) => task.parentId === measure.listId).length;
  }
}

function isoToKey(iso: string): string {
  return toDateKey(new Date(iso));
}

// How much the goal's value moved on each day, keyed by date (through `today` for habit goals).
function gainsByDay(goal: Goal, sources: GoalSources, today: string): Map<string, number> {
  const gains = new Map<string, number>();
  const add = (key: string, amount: number) => gains.set(key, (gains.get(key) ?? 0) + amount);
  const { measure } = goal;

  switch (measure.type) {
    case 'milestones':
      for (const milestone of measure.milestones) if (milestone.completedAt) add(isoToKey(milestone.completedAt), 1);
      break;
    case 'numeric':
      for (const entry of measure.entries) add(entry.date, entry.amount);
      break;
    case 'taskList':
      for (const task of sources.tasks) {
        if (task.parentId === measure.listId && task.completedAt && isTaskDone(task)) add(isoToKey(task.completedAt), 1);
      }
      break;
    case 'habit': {
      // Walks days rather than the log, since clean abstain days are never logged.
      const habit = sources.habits.find((h) => h.id === measure.habitId);
      if (!habit) break;
      const start = goal.startDate > habitStartKey(habit) ? goal.startDate : habitStartKey(habit);
      for (let key = start; key <= today; key = addDaysToKey(key, 1)) {
        add(key, measure.metric === 'days' ? Number(isDayComplete(habit, key)) : dayValue(habit, key));
      }
      break;
    }
  }
  return gains;
}

// The goal's value as of today. Anything done before the start date counts from day one.
export function goalCurrent(goal: Goal, sources: GoalSources, today: string): number {
  let value = goalStartValue(goal);
  for (const [key, gain] of gainsByDay(goal, sources, today)) if (key <= today) value += gain;
  return value;
}

// Running value for every day from the start date through today.
export function goalSeries(goal: Goal, sources: GoalSources, today: string): GoalPoint[] {
  const gains = gainsByDay(goal, sources, today);
  let value = goalStartValue(goal);
  for (const [key, gain] of gains) if (key < goal.startDate) value += gain;

  const series: GoalPoint[] = [];
  for (let key = goal.startDate; key <= today; key = addDaysToKey(key, 1)) {
    value += gains.get(key) ?? 0;
    series.push({ date: key, value });
  }
  return series;
}

// 0..1 for a value along the start → target span; works for decreasing goals too.
export function progressOf(goal: Goal, value: number, target: number): number {
  const span = target - goalStartValue(goal);
  if (span === 0) return 0;
  return Math.min(Math.max((value - goalStartValue(goal)) / span, 0), 1);
}

export function goalProgress(goal: Goal, sources: GoalSources, today: string): number {
  return progressOf(goal, goalCurrent(goal, sources, today), goalTarget(goal, sources));
}

// First day the goal reached its target, or null if it hasn't.
export function goalCompletedOn(goal: Goal, sources: GoalSources, today: string): string | null {
  const target = goalTarget(goal, sources);
  return goalSeries(goal, sources, today).find((point) => progressOf(goal, point.value, target) >= 1)?.date ?? null;
}
