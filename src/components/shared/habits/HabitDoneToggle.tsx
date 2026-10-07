'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { isDayComplete, toggledValue } from '../../../lib/habits/habitGoal';
import type { Habit } from '../../../lib/types';

type HabitDoneToggleProps = {
  habit: Habit;
  today: string;
  onChange: (value: number) => void;
  icon?: ReactNode;
  // Visible text; omit for a square icon-only button.
  children?: ReactNode;
};

function defaultLabel(habit: Habit, complete: boolean): string {
  if (habit.goal.type === 'abstain') return complete ? 'Log a slip' : 'Undo slip';
  if (habit.goal.type === 'quantity') return complete ? 'Clear today' : 'Mark target reached';
  return complete ? 'Undo today' : 'Mark done';
}

// One-tap button that flips today between complete and not, tinted with --item-color.
export default function HabitDoneToggle({ habit, today, onChange, icon = <Check size={16} />, children }: HabitDoneToggleProps) {
  const complete = isDayComplete(habit, today);
  const label = children ? undefined : defaultLabel(habit, complete);
  const className = [
    'habit-done-toggle',
    complete && 'habit-done-toggle--complete',
    !children && 'habit-done-toggle--icon-only',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      aria-pressed={complete}
      aria-label={label}
      title={label}
      onClick={() => onChange(toggledValue(habit.goal, complete))}
    >
      {icon}
      {children}
    </button>
  );
}
