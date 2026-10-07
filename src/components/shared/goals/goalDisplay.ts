import { formatAmount } from '../../../lib/formatAmount';
import type { GoalSources } from '../../../lib/goals/goalProgress';
import type { Goal } from '../../../lib/types';

// What the goal's numbers count, e.g. "books", "days", "km".
export function goalUnit(goal: Goal, sources: GoalSources): string {
  const { measure } = goal;
  switch (measure.type) {
    case 'milestones':
      return 'steps';
    case 'taskList':
      return 'tasks';
    case 'numeric':
      return measure.unit;
    case 'habit': {
      if (measure.metric === 'days') return 'days';
      const habit = sources.habits.find((h) => h.id === measure.habitId);
      return habit?.goal.type === 'quantity' ? habit.goal.unit : '';
    }
  }
}

// "1,200 km", or "$5,000" for single-symbol currency units.
export function formatGoalAmount(value: number, unit: string): string {
  if (/^[$€£¥]$/.test(unit)) return `${unit}${formatAmount(value)}`;
  return unit ? `${formatAmount(value)} ${unit}` : formatAmount(value);
}

// Names what a linked goal reads from, e.g. "From habit: Jog". Null for self-tracked goals.
export function goalLinkLabel(goal: Goal, sources: GoalSources): string | null {
  const { measure } = goal;
  if (measure.type === 'habit') {
    const habit = sources.habits.find((h) => h.id === measure.habitId);
    return habit ? `From habit: ${habit.name}` : 'Linked habit was deleted — edit this goal to relink it';
  }
  if (measure.type === 'taskList') {
    const list = sources.taskLists.find((l) => l.id === measure.listId);
    return list ? `From list: ${list.name}` : 'Linked task list was deleted — edit this goal to relink it';
  }
  return null;
}

// "12 / 24 books" — amounts both formatted in the goal's unit.
export function formatGoalFraction(goal: Goal, sources: GoalSources, current: number, target: number): string {
  const unit = goalUnit(goal, sources);
  return `${formatGoalAmount(current, unit)} / ${formatGoalAmount(target, unit)}`;
}
