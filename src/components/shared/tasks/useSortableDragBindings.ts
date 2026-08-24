import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, HTMLAttributes } from 'react';
import type { TaskDragData } from './useTaskDrag';

// dnd-kit sortable bindings, threaded from a sortable wrapper (SortableTask/
// the subtask-level equivalent in TaskParent.tsx) down to the plain TaskRow
// it renders.
export type DragBindings = {
  dragRef?: (node: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
  dragAttributes?: HTMLAttributes<HTMLElement>;
  dragListeners?: HTMLAttributes<HTMLElement>;
  isPlaceholder?: boolean;
};

// Shared by the task-level and subtask-level sortable wrappers — same
// dnd-kit hook, same DragBindings shape either way. `data` tags the
// registration with what's actually being dragged, so TaskDragProvider's
// (the one shared DndContext, see widgets/task-list/TaskDragProvider.tsx)
// onDragStart/onDragEnd handlers can tell rows apart without a separate
// lookup keyed only by id.
export function useSortableDragBindings(id: string, data: TaskDragData): DragBindings {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data });
  return {
    dragRef: setNodeRef,
    // CSS.Translate (not CSS.Transform) drops the scaleX/scaleY the
    // sortable strategy computes for neighboring items of a different
    // height — applying that to the dragged item itself stretched/squashed
    // multi-line rows.
    dragStyle: { transform: CSS.Translate.toString(transform), transition, touchAction: 'none' },
    dragAttributes: attributes,
    dragListeners: listeners,
    isPlaceholder: isDragging,
  };
}
