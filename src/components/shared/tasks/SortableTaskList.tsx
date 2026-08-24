'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';

type SortableTaskListProps = {
  // `list:${listId}` or `subtasks:${taskId}` — see useTaskDrag.ts. Matched
  // against the active drag's data in TaskDragProvider to resolve which
  // container an item was dropped into.
  containerId: string;
  ids: string[];
  children: ReactNode;
};

// Scoped SortableContext for one container's items (a list's own tasks, or
// one task's own subtasks). Sensors, collision detection, the single
// DndContext, and the shared DragOverlay all live once, in
// TaskDragProvider, wrapping the whole dashboard — that's what lets a drag
// cross from one Task List widget instance into another. This component
// just marks which ids belong to THIS one container so dnd-kit's sortable
// math (and TaskDragProvider's own resolution logic) can tell them apart.
export default function SortableTaskList({ containerId, ids, children }: SortableTaskListProps) {
  return (
    <SortableContext id={containerId} items={ids} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}
