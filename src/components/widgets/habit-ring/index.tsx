'use client';

import { Check } from 'lucide-react';
import { dayProgress, dayValue, isDayComplete } from '../../../lib/habits/habitGoal';
import ProgressRing from '../../common/ProgressRing';
import { formatHabitAmount } from '../../shared/habits/habitDisplay';
import HabitStatsLine from '../../shared/habits/HabitStatsLine';
import HabitTodayControl from '../../shared/habits/HabitTodayControl';
import HabitWidgetFrame, { type HabitViewProps } from '../../shared/habits/HabitWidgetFrame';

function RingLabel({ habit, today }: Omit<HabitViewProps, 'setTodayValue'>) {
  if (habit.goal.type === 'quantity') {
    return (
      <>
        <span className="habit-ring__value">{formatHabitAmount(dayValue(habit, today))}</span>
        <span className="habit-ring__caption">
          of {formatHabitAmount(habit.goal.target)} {habit.goal.unit}
        </span>
      </>
    );
  }
  return isDayComplete(habit, today) ? (
    <Check className="habit-ring__check" size={28} />
  ) : (
    <span className="habit-ring__caption">{habit.goal.type === 'abstain' ? 'Slipped' : 'Not yet'}</span>
  );
}

// Today's progress as a completion wheel.
export default function HabitRingWidget() {
  return (
    <HabitWidgetFrame className="habit-ring">
      {({ habit, today, setTodayValue }) => (
        <>
          <div className="habit-ring__ring">
            <ProgressRing progress={dayProgress(habit, today)} color="var(--habit-color)" ariaLabel={`${habit.name} today`}>
              <RingLabel habit={habit} today={today} />
            </ProgressRing>
          </div>
          <HabitTodayControl habit={habit} today={today} onChange={setTodayValue} />
          <HabitStatsLine habit={habit} today={today} />
        </>
      )}
    </HabitWidgetFrame>
  );
}
