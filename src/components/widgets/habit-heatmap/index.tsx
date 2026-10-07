'use client';

import { useMemo } from 'react';
import { addDaysToKey, parseDateKey } from '../../../lib/dateKey';
import { dayProgress, dayValue, habitStartKey } from '../../../lib/habits/habitGoal';
import type { Habit } from '../../../lib/types';
import { formatAmount } from '../../../lib/formatAmount';
import HabitDoneToggle from '../../shared/habits/HabitDoneToggle';
import HabitStatsLine from '../../shared/habits/HabitStatsLine';
import HabitWidgetFrame, { type HabitViewProps } from '../../shared/habits/HabitWidgetFrame';

// A year of columns; narrower widgets clip the oldest weeks off the left edge.
const WEEKS = 53;

type HeatmapCell = { key: string; className: string; title: string };

// 0 = nothing, 1–3 = partial progress, 4 = complete.
function progressLevel(progress: number): number {
  if (progress >= 1) return 4;
  return Math.ceil(progress * 3);
}

function cellTitle(habit: Habit, key: string, progress: number): string {
  const date = parseDateKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  if (habit.goal.type === 'quantity') {
    return `${date}: ${formatAmount(dayValue(habit, key))} / ${formatAmount(habit.goal.target)} ${habit.goal.unit}`;
  }
  return `${date}: ${progress >= 1 ? 'done' : 'missed'}`;
}

// Monday-first weeks ending with the week containing `today`, flattened column by column.
function buildCells(habit: Habit, today: string): HeatmapCell[] {
  const weekdayOffset = (parseDateKey(today).getDay() + 6) % 7;
  const first = addDaysToKey(today, -weekdayOffset - (WEEKS - 1) * 7);
  const start = habitStartKey(habit);
  const cells: HeatmapCell[] = [];

  for (let index = 0, key = first; index < WEEKS * 7; index++, key = addDaysToKey(key, 1)) {
    const classes = ['habit-heatmap__cell'];
    let title = '';
    if (key > today || key < start) {
      classes.push('habit-heatmap__cell--untracked');
    } else {
      const progress = dayProgress(habit, key);
      classes.push(`habit-heatmap__cell--level-${progressLevel(progress)}`);
      title = cellTitle(habit, key, progress);
    }
    if (key === today) classes.push('habit-heatmap__cell--today');
    cells.push({ key, className: classes.join(' '), title });
  }
  return cells;
}

function HabitHeatmap({ habit, today, setTodayValue }: HabitViewProps) {
  const cells = useMemo(() => buildCells(habit, today), [habit, today]);

  return (
    <div className="habit-heatmap__row">
      <div className="habit-heatmap__viewport">
        <div className="habit-heatmap__grid" role="img" aria-label={`${habit.name} history`}>
          {cells.map((cell) => (
            <span key={cell.key} className={cell.className} title={cell.title} />
          ))}
        </div>
      </div>
      <HabitDoneToggle habit={habit} today={today} onChange={setTodayValue} />
    </div>
  );
}

// GitHub-style history grid, shaded by each day's progress in the habit's colour.
export default function HabitHeatmapWidget() {
  return (
    <HabitWidgetFrame className="habit-heatmap">
      {(view) => (
        <>
          <HabitHeatmap {...view} />
          <HabitStatsLine habit={view.habit} today={view.today} />
        </>
      )}
    </HabitWidgetFrame>
  );
}
