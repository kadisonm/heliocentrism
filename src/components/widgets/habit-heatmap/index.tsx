'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { addDaysToKey, parseDateKey } from '../../../lib/dateKey';
import { formatAmount } from '../../../lib/formatAmount';
import { dayProgress, dayValue, habitStartKey, isDayComplete, toggledValue } from '../../../lib/habits/habitGoal';
import type { Habit } from '../../../lib/types';
import HabitDoneToggle from '../../shared/habits/HabitDoneToggle';
import HabitStatsLine from '../../shared/habits/HabitStatsLine';
import HabitWidgetFrame, { type HabitViewProps } from '../../shared/habits/HabitWidgetFrame';
import { useElementSize } from '../../shared/hooks/useElementSize';

// One column per week; each cell + gap takes one "pitch", sized so 7 rows fill the height.
const MAX_PITCH_PX = 19;
const GAP_RATIO = 0.18; // must match the cell/gap split in habit-heatmap/index.scss

// Past days are clickable (back-filling before tracking began extends it); future days aren't.
type HeatmapCell = { key: string; className: string; label: string; clickable: boolean };

// 0 = nothing, 1–3 = partial progress, 4 = complete.
function progressLevel(progress: number): number {
  if (progress >= 1) return 4;
  return Math.ceil(progress * 3);
}

function formatDay(key: string, withWeekday = false): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    ...(withWeekday && { weekday: 'short' }),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function cellStatus(habit: Habit, key: string, progress: number): string {
  if (habit.goal.type === 'quantity') {
    return `${formatAmount(dayValue(habit, key))} / ${formatAmount(habit.goal.target)} ${habit.goal.unit}`;
  }
  if (habit.goal.type === 'abstain') return progress >= 1 ? 'clean' : 'slipped';
  return progress >= 1 ? 'done' : 'missed';
}

// Monday-first weeks from `firstKey`, flattened column by column. Days before tracking began stay unfilled.
function buildCells(habit: Habit, today: string, firstKey: string, weeks: number): HeatmapCell[] {
  const start = habitStartKey(habit);
  const cells: HeatmapCell[] = [];

  for (let index = 0, key = firstKey; index < weeks * 7; index++, key = addDaysToKey(key, 1)) {
    const classes = ['habit-heatmap__cell'];
    let label = formatDay(key, true);
    if (key >= start && key <= today) {
      const progress = dayProgress(habit, key);
      classes.push(`habit-heatmap__cell--level-${progressLevel(progress)}`);
      label += `: ${cellStatus(habit, key, progress)}`;
    } else {
      classes.push('habit-heatmap__cell--untracked');
    }
    const clickable = key <= today;
    if (clickable) classes.push('habit-heatmap__cell--clickable');
    if (key === today) classes.push('habit-heatmap__cell--today');
    cells.push({ key, className: classes.join(' '), label, clickable });
  }
  return cells;
}

function HabitHeatmap({ habit, today, setTodayValue, setDayValue }: HabitViewProps) {
  const [viewportRef, { width, height }] = useElementSize<HTMLDivElement>();
  // How many screenfuls back from the current week the grid is paged.
  const [page, setPage] = useState(0);

  const pitch = Math.min(height / 7, MAX_PITCH_PX);
  const weeks = pitch > 0 ? Math.max(1, Math.floor((width + pitch * GAP_RATIO) / pitch)) : 0;
  const thisMonday = addDaysToKey(today, -((parseDateKey(today).getDay() + 6) % 7));
  const firstKey = addDaysToKey(thisMonday, -((page + 1) * weeks - 1) * 7);
  const lastKey = addDaysToKey(firstKey, weeks * 7 - 1);

  const cells = buildCells(habit, today, firstKey, weeks);

  return (
    <>
      <div className="habit-heatmap__row">
        <div className="habit-heatmap__viewport" ref={viewportRef}>
          {weeks > 0 && (
            <div
              className="habit-heatmap__grid"
              role="group"
              aria-label={`${habit.name} history`}
              style={{ '--pitch': `${pitch}px` } as CSSProperties}
            >
              {cells.map((cell) =>
                cell.clickable ? (
                  <button
                    key={cell.key}
                    type="button"
                    className={cell.className}
                    title={cell.label}
                    aria-label={cell.label}
                    onClick={() => setDayValue(cell.key, toggledValue(habit.goal, isDayComplete(habit, cell.key)))}
                  />
                ) : (
                  <span key={cell.key} className={cell.className} title={cell.label} aria-label={cell.label} role="img" />
                )
              )}
            </div>
          )}
        </div>
        <HabitDoneToggle habit={habit} today={today} onChange={setTodayValue} />
      </div>

      {weeks > 0 && (
        <div className="habit-heatmap__nav">
          <button
            type="button"
            className="habit-heatmap__nav-button"
            onClick={() => setPage((current) => current + 1)}
            aria-label="Show earlier weeks"
            title="Earlier"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="habit-heatmap__range">
            {formatDay(firstKey)} – {formatDay(lastKey < today ? lastKey : today)}
          </span>
          <button
            type="button"
            className="habit-heatmap__nav-button"
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
            disabled={page === 0}
            aria-label="Show later weeks"
            title="Later"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
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
