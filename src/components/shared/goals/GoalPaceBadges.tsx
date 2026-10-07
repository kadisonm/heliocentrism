import { CalendarClock, Check, CircleAlert, TrendingDown, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import type { GoalPace, GoalPaceStatus } from '../../../lib/goals/goalPace';
import Badge, { type BadgeColor } from '../../common/Badge';

const STATUS_BADGES: Record<Exclude<GoalPaceStatus, 'none'>, { label: string; color: BadgeColor; icon: LucideIcon; hint: string }> = {
  complete: { label: 'Complete', color: 'success', icon: Trophy, hint: 'Target reached' },
  ahead: { label: 'Ahead', color: 'success', icon: TrendingUp, hint: 'Ahead of an even pace to the deadline' },
  'on-track': { label: 'On track', color: 'accent', icon: Check, hint: 'Keeping an even pace to the deadline' },
  behind: { label: 'Behind', color: 'warning', icon: TrendingDown, hint: 'Behind an even pace to the deadline' },
  overdue: { label: 'Overdue', color: 'error', icon: CircleAlert, hint: 'The deadline has passed' },
};

function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'Due today';
  if (daysLeft < 0) return `${-daysLeft}d over`;
  return `${daysLeft}d left`;
}

// Pace status plus days-left badges; renders nothing for an open-ended, unfinished goal.
export default function GoalPaceBadges({ pace }: { pace: GoalPace }) {
  const status = pace.status === 'none' ? null : STATUS_BADGES[pace.status];
  const showDays = pace.daysLeft !== null && pace.status !== 'complete' && pace.status !== 'overdue';
  if (!status && !showDays) return null;

  return (
    <div className="goal-pace-badges">
      {status && <Badge icon={status.icon} title={status.label} ariaLabel={status.hint} color={status.color} />}
      {showDays && (
        <Badge icon={CalendarClock} title={daysLeftLabel(pace.daysLeft!)} ariaLabel="Time until the deadline" color="muted" />
      )}
    </div>
  );
}
