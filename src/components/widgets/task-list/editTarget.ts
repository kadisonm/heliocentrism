import type { Subtask, Task } from '../../../lib/types';

// Which task or subtask a quick-edit modal is open for, routing its
// onSubmit to updateTask vs updateSubtask.
export type EditTarget = { type: 'task'; task: Task } | { type: 'subtask'; subtask: Subtask };

export function editTargetId(target: EditTarget): string {
  return target.type === 'task' ? target.task.id : target.subtask.id;
}
