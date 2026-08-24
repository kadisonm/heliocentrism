// Shared dnd-kit v7 `type`/id conventions for task and subtask sortables
// (see useTaskSortable.ts, TaskParent.tsx, and widgets/task-list/index.tsx).
//
// A task's type is global — any list's task accepts any other list's task,
// which is what lets a task cross between lists. A subtask's type is
// scoped to its own parent task, so a different task's subtask area is
// never a valid target for it (dragging a subtask can only ever reorder
// within its own task — see useTaskLists.ts's groupedSubtaskIds).
export const TASK_TYPE = 'task';

export function subtaskType(taskId: string): string {
  return `subtask:${taskId}`;
}

// A task's own dnd-kit id already equals its `task.id` (see SortableTask),
// so the empty-subtasks drop zone needs a distinct id of its own to avoid
// colliding with it in the droppable registry — see useTaskLists.ts's
// groupedSubtaskIds/applySubtaskGroups, which key by this same id.
export function subtasksZoneId(taskId: string): string {
  return `subtasks:${taskId}`;
}
