export type DueUrgency = 'overdue' | 'today' | 'none';

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

export function formatDue(due: string): string {
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return due;

  return dueDate.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
