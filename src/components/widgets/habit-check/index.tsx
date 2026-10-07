'use client';

import HabitStatsLine from '../../shared/habits/HabitStatsLine';
import HabitTodayControl from '../../shared/habits/HabitTodayControl';
import HabitWidgetFrame from '../../shared/habits/HabitWidgetFrame';

// Compact "log today" view — a checkbox, stepper, or slip toggle depending on the habit.
export default function HabitCheckWidget() {
  return (
    <HabitWidgetFrame className="habit-check">
      {({ habit, today, setTodayValue }) => (
        <>
          <HabitTodayControl habit={habit} today={today} onChange={setTodayValue} />
          <HabitStatsLine habit={habit} today={today} />
        </>
      )}
    </HabitWidgetFrame>
  );
}
