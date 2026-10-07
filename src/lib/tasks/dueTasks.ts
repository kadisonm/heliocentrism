import type { Subtask, Task } from '../types';
import { isTaskDone } from './taskCascade';

// A parent task with whichever of its subtasks are due, shown together.
export type DueTaskGroup = {
  task: Task;
  subtasks: Subtask[]; // only unfinished subtasks due within the window, soonest first
};

type DueTaskOptions = {
  now: Date;
  includeList: (listId: string) => boolean;
  // Only items due before the end of the day N days from now; null = no limit. Overdue items always count.
  withinDays: number | null;
};

const dueTime = (due: string) => new Date(due).getTime();

// Groups unfinished tasks with due dates (on the task or any of its subtasks), ordered by each group's
// earliest due date — whether that's the parent's or one of its subtasks'.
export function buildDueTaskGroups(tasks: Task[], subtasks: Subtask[], { now, includeList, withinDays }: DueTaskOptions): DueTaskGroup[] {
  const cutoff =
    withinDays === null ? Infinity : new Date(now.getFullYear(), now.getMonth(), now.getDate() + withinDays + 1).getTime();
  const isDueInWindow = (due: string) => !!due && !Number.isNaN(dueTime(due)) && dueTime(due) < cutoff;

  const subtasksByParent = new Map<string, Subtask[]>();
  for (const subtask of subtasks) {
    const siblings = subtasksByParent.get(subtask.parentId) ?? [];
    siblings.push(subtask);
    subtasksByParent.set(subtask.parentId, siblings);
  }

  const groups: (DueTaskGroup & { sortTime: number })[] = [];
  for (const task of tasks) {
    if (isTaskDone(task) || !includeList(task.parentId)) continue;
    const dueSubtasks = (subtasksByParent.get(task.id) ?? [])
      .filter((subtask) => !isTaskDone({ stage: subtask.stage, stages: task.stages }) && isDueInWindow(subtask.due))
      .sort((a, b) => dueTime(a.due) - dueTime(b.due));
    const parentDue = isDueInWindow(task.due);
    if (!parentDue && dueSubtasks.length === 0) continue;

    const sortTime = Math.min(parentDue ? dueTime(task.due) : Infinity, dueSubtasks[0] ? dueTime(dueSubtasks[0].due) : Infinity);
    groups.push({ task, subtasks: dueSubtasks, sortTime });
  }

  return groups.sort((a, b) => a.sortTime - b.sortTime).map(({ task, subtasks: due }) => ({ task, subtasks: due }));
}
