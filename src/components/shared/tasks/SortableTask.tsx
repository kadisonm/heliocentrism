import type { Subtask, Task } from '../../../lib/types';
import TaskParent, { type TaskParentHandlers } from './TaskParent';
import { useSortableDragBindings } from './useSortableDragBindings';

type SortableTaskProps<T extends Task> = TaskParentHandlers & { task: T; subtasks: Subtask[] };

// Drag-sortable wrapper around TaskParent — kept separate so the
// DragOverlay copy (rendered via TaskParent directly, see index.tsx) never
// has its own nested useSortable/DndContext.
export default function SortableTask<T extends Task>({ task, subtasks, ...handlers }: SortableTaskProps<T>) {
  const dragBindings = useSortableDragBindings(task.id, { type: 'task', taskId: task.id, listId: task.parentId });
  return <TaskParent task={task} subtasks={subtasks} {...handlers} {...dragBindings} />;
}
