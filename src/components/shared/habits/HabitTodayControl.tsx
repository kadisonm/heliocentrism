'use client';

import { ShieldCheck, ShieldX } from 'lucide-react';
import { dayValue, isDayComplete } from '../../../lib/habits/habitGoal';
import type { Habit } from '../../../lib/types';
import NumberStepper from '../../common/NumberStepper';
import { formatHabitAmount } from './habitDisplay';
import HabitDoneToggle from './HabitDoneToggle';

type HabitTodayControlProps = {
  habit: Habit;
  today: string;
  onChange: (value: number) => void;
};

// The input for logging today's value, shaped by the habit's goal type.
export default function HabitTodayControl({ habit, today, onChange }: HabitTodayControlProps) {
  const { goal } = habit;
  const complete = isDayComplete(habit, today);

  if (goal.type === 'check') {
    return (
      <HabitDoneToggle habit={habit} today={today} onChange={onChange}>
        {complete ? 'Done' : 'Mark done'}
      </HabitDoneToggle>
    );
  }

  if (goal.type === 'abstain') {
    return (
      <HabitDoneToggle
        habit={habit}
        today={today}
        onChange={onChange}
        icon={complete ? <ShieldCheck size={16} /> : <ShieldX size={16} />}
      >
        {complete ? 'Clean today' : 'Slipped — tap to undo'}
      </HabitDoneToggle>
    );
  }

  return (
    <div className="habit-today-control__quantity">
      <NumberStepper value={dayValue(habit, today)} step={goal.step} onChange={onChange} ariaLabel={`${habit.name} today`} />
      <span className="habit-today-control__target">
        / {formatHabitAmount(goal.target)} {goal.unit}
      </span>
      {/* Boolean shortcut: jump straight to the target, or clear back to zero. */}
      <HabitDoneToggle habit={habit} today={today} onChange={onChange} />
    </div>
  );
}
