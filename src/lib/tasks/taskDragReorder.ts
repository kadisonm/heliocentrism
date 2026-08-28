import { isTaskDone } from './taskCascade';
import type { Subtask, Task, TaskList } from '../types';
import { subtasksZoneId } from '../../components/shared/tasks/taskSortableTypes';

// Not-done tasks grouped by list id and ordered — the shape @dnd-kit/helpers'
// move() expects. Done tasks are excluded unconditionally so every task's
// sortable `index` stays consistent regardless of per-widget "show completed".
export function groupedTaskIds(taskLists: TaskList[], tasks: Task[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const list of taskLists) grouped[list.id] = [];
  for (const task of [...tasks].sort((a, b) => a.order - b.order)) {
    if (isTaskDone(task)) continue;
    (grouped[task.parentId] ??= []).push(task.id);
  }
  return grouped;
}

// Applies a new list->taskIds arrangement back onto the flat `tasks` array
// (order/parentId). Done tasks are left exactly as they were — see
// groupedTaskIds.
export function applyTaskGroups(tasks: Task[], grouped: Record<string, string[]>, now: string): Task[] {
  const included = new Set(Object.values(grouped).flat());
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const next: Task[] = [];

  for (const [listId, ids] of Object.entries(grouped)) {
    ids.forEach((id, order) => {
      const task = byId.get(id);
      if (!task) return;
      next.push(task.parentId === listId && task.order === order ? task : { ...task, parentId: listId, order, updatedAt: now });
    });
  }
  for (const task of tasks) if (!included.has(task.id)) next.push(task);
  return next;
}

// Not-done subtasks grouped by parent task id — mirrors groupedTaskIds/
// applyTaskGroups above. Subtasks never cross tasks (see SubtaskSortableRow's
// per-task sortable `type`), so this only ever runs once, at drop.
export function groupedSubtaskIds(tasks: Task[], subtasks: Subtask[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  const stagesByTaskId = new Map(tasks.map((t) => [t.id, t.stages]));
  for (const task of tasks) grouped[subtasksZoneId(task.id)] = [];
  for (const subtask of [...subtasks].sort((a, b) => a.order - b.order)) {
    const stages = stagesByTaskId.get(subtask.parentId);
    if (!stages || isTaskDone({ stage: subtask.stage, stages })) continue;
    (grouped[subtasksZoneId(subtask.parentId)] ??= []).push(subtask.id);
  }
  return grouped;
}

export function applySubtaskGroups(tasks: Task[], subtasks: Subtask[], grouped: Record<string, string[]>): Subtask[] {
  const included = new Set(Object.values(grouped).flat());
  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const taskIdByZone = new Map(tasks.map((t) => [subtasksZoneId(t.id), t.id]));
  const next: Subtask[] = [];

  for (const [zoneId, ids] of Object.entries(grouped)) {
    const taskId = taskIdByZone.get(zoneId);
    if (!taskId) continue;
    ids.forEach((id, order) => {
      const subtask = byId.get(id);
      if (!subtask) return;
      next.push(subtask.parentId === taskId && subtask.order === order ? subtask : { ...subtask, parentId: taskId, order });
    });
  }
  for (const subtask of subtasks) if (!included.has(subtask.id)) next.push(subtask);
  return next;
}
