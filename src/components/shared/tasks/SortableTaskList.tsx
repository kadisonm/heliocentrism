'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type SortableTaskListProps = {
  ids: string[];
  onReorder: (activeId: string, overId: string) => void;
  // Given the currently-dragged item's id, returns a plain (non-sortable)
  // visual copy for the floating DragOverlay — see TaskItem's TaskItemView.
  renderOverlay: (activeId: string) => ReactNode;
  children: ReactNode;
};

// A press-and-hold before a drag activates, so a normal click on a task's
// checkbox, edit button, etc. is never mistaken for the start of a reorder
// — the sensor only calls preventDefault once the delay elapses, so a quick
// click completes normally either way.
const ACTIVATION_CONSTRAINT = { delay: 500, tolerance: 5 };

export default function SortableTaskList({
  ids,
  onReorder,
  renderOverlay,
  children,
}: SortableTaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: ACTIVATION_CONSTRAINT })
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  // DragOverlay renders position: fixed content, which — like Modal — gets
  // trapped inside a react-grid-layout widget's transformed containing
  // block unless portaled to document.body. document doesn't exist during
  // SSR, so the portal only renders once mounted on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
    setActiveId(null);
  };

  const handleDragCancel = () => setActiveId(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>

      {mounted &&
        createPortal(
          <DragOverlay>
            {activeId ? (
              <div className="sortable-drag-overlay" style={{ pointerEvents: 'none' }}>
                {renderOverlay(activeId)}
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
