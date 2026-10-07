import { CalendarCheck, Flame, Trophy } from 'lucide-react';
import { completionRate, currentStreak, longestStreak } from '../../../lib/habits/habitStats';
import type { Habit } from '../../../lib/types';

type HabitStatsLineProps = {
  habit: Habit;
  today: string;
};

const RATE_WINDOW_DAYS = 30;

// Compact streak / best / 30-day-rate summary shared by the habit widgets.
export default function HabitStatsLine({ habit, today }: HabitStatsLineProps) {
  const streak = currentStreak(habit, today);
  const best = longestStreak(habit, today);
  const rate = Math.round(completionRate(habit, today, RATE_WINDOW_DAYS) * 100);

  return (
    <div className="habit-stats-line">
      <span className="habit-stats-line__stat" title="Current streak">
        <Flame size={13} />
        {streak} day{streak === 1 ? '' : 's'}
      </span>
      <span className="habit-stats-line__stat" title="Longest streak">
        <Trophy size={13} />
        {best}
      </span>
      <span className="habit-stats-line__stat" title={`Completion over the last ${RATE_WINDOW_DAYS} days`}>
        <CalendarCheck size={13} />
        {rate}%
      </span>
    </div>
  );
}
