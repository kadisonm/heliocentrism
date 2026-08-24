import type { Subtask, Task } from '../../../lib/types';
import { isTaskDone } from '../../../lib/taskCascade';
import TaskParent, { type TaskParentHandlers } from './TaskParent';
import { TASK_TYPE } from './taskSortableTypes';
import { useTaskSortable } from './useTaskSortable';

type SortableTaskProps<T extends Task> = TaskParentHandlers & { task: T; subtasks: Subtask[]; index: number };

// Drag-sortable wrapper around TaskParent. A done task is excluded from
// the live sortable arrangement entirely (see useTaskLists.ts's
// groupedTaskIds) — `disabled` keeps it a fixed, non-draggable,
// non-drop-target row while every other handler stays live.
export default function SortableTask<T extends Task>({ task, subtasks, index, ...handlers }: SortableTaskProps<T>) {
  const done = isTaskDone(task);
  const { dragRef } = useTaskSortable({
    id: task.id,
    index: done ? 0 : index,
    group: task.parentId,
    type: TASK_TYPE,
    disabled: done,
  });
  return <TaskParent task={task} subtasks={subtasks} {...handlers} dragRef={dragRef} />;
}
