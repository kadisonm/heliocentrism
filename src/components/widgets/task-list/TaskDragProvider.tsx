'use client';

import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { DragDropProvider, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/react';
import type { ReactNode } from 'react';
import { TASK_TYPE } from '../../shared/tasks/taskSortableTypes';
import { useTaskLists } from './useTaskLists';

// A press-and-hold before a drag activates, so a normal click on a task's
// checkbox, edit button, etc. is never mistaken for the start of a
// reorder — every row already used this constraint before it moved here.
const sensors = [
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Delay({ value: 500, tolerance: 5 })],
  }),
  KeyboardSensor,
];

function isSubtaskDrag(type: unknown): boolean {
  return typeof type === 'string' && type.startsWith('subtask:');
}

// Matches task-item.scss's .task-item--dropped/.subtask--dropped animation
// duration — how long the drop-shrink class stays applied before clearing.
const DROP_SHRINK_MS = 200;

// One shared dnd-kit DragDropProvider for the whole dashboard's task rows,
// letting a drag cross from one Task List widget instance to another.
export default function TaskDragProvider({ children }: { children: ReactNode }) {
  const { beginTaskDrag, applyTaskDragOver, endTaskDrag, commitSubtaskDragEnd, setDraggingId, setDroppingId } =
    useTaskLists();

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(typeof event.operation.source?.id === 'string' ? event.operation.source.id : null);
    if (event.operation.source?.type === TASK_TYPE) beginTaskDrag();
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.operation.source?.type === TASK_TYPE) applyTaskDragOver(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const id = event.operation.source?.id;
    setDraggingId(null);
    if (typeof id === 'string') {
      setDroppingId(id);
      setTimeout(() => setDroppingId(null), DROP_SHRINK_MS);
    }
    const type = event.operation.source?.type;
    if (type === TASK_TYPE) endTaskDrag(event);
    else if (isSubtaskDrag(type)) commitSubtaskDragEnd(event);
  };

  return (
    <DragDropProvider sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      {children}
    </DragDropProvider>
  );
}
