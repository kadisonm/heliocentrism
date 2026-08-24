import type { Subtask, Task } from '../../../lib/types';

// Which task or subtask a repeat/due/stages quick-edit modal is open for —
// shared by TaskRepeatModal/TaskDueModal (which work on a plain value
// rather than a Task) so this is what routes their onSubmit to updateTask
// vs updateSubtask. A subtask's own parentId is its owning task's id, so
// there's no need to carry that separately.
export type EditTarget = { type: 'task'; task: Task } | { type: 'subtask'; subtask: Subtask };

export function editTargetId(target: EditTarget): string {
  return target.type === 'task' ? target.task.id : target.subtask.id;
}
