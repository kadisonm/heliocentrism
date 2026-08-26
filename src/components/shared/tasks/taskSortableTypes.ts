// Shared dnd-kit v7 type/id conventions for task and subtask sortables.
// A task's type is global, so tasks can move between lists; a subtask's
// type is scoped to its own parent task, so it can only reorder within
// that task (see useTaskLists.ts's groupedSubtaskIds).
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
