import { formatRelativeDateTime } from '../../../lib/relativeDate';
import type { BadgeColor } from '../../common/Badge';

export type DueUrgency = 'overdue' | 'today' | 'none';

// Maps due-date urgency to the Badge color that gives the due badge its
// red/overdue, yellow/today, grey/later styling.
export function dueBadgeColor(urgency: DueUrgency): BadgeColor {
  if (urgency === 'overdue') return 'error';
  if (urgency === 'today') return 'warning';
  return 'muted';
}

export function getDueUrgency(due: string, now: Date = new Date()): DueUrgency {
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return 'none';

  if (dueDate.getTime() < now.getTime()) return 'overdue';

  const isSameDay =
    dueDate.getFullYear() === now.getFullYear() &&
    dueDate.getMonth() === now.getMonth() &&
    dueDate.getDate() === now.getDate();

  return isSameDay ? 'today' : 'none';
}

// "Yesterday, 11 pm" / "Today, 11 pm" / "Tomorrow, 11 pm" / "In 2 days,
// 11 pm" out to a week, then an absolute short date — see
// formatRelativeDateTime.
export function formatDue(due: string, now: Date = new Date()): string {
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return due;

  return formatRelativeDateTime(dueDate, now);
}

// Full date/time, used as the due badge's hover/aria label rather than its
// visible (abbreviated) text.
export function formatDueFull(due: string): string {
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return due;

  return dueDate.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
