import { memo } from 'react';
import type { Subtask, Task } from '../../../lib/types';
import { isTaskDone } from '../../../lib/tasks/taskCascade';
import TaskParent, { type TaskParentHandlers } from './TaskParent';
import { TASK_TYPE } from './taskSortableTypes';
import { useTaskSortable } from './useTaskSortable';

type SortableTaskProps = TaskParentHandlers & { task: Task; subtasks: Subtask[]; index: number };

// Drag-sortable wrapper around TaskParent. A done task is excluded from
// the live sortable arrangement (see useTaskLists.ts's groupedTaskIds) via
// `disabled`. Memoized — see TaskListRow.tsx, which is what keeps its props
// referentially stable so unrelated rows skip re-rendering entirely.
function SortableTask({ task, subtasks, index, ...handlers }: SortableTaskProps) {
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

export default memo(SortableTask);
