'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Subtask, Task } from '../../../lib/types';
import TaskParent, { SubtaskOverlayRow } from '../../shared/tasks/TaskParent';
import {
  endTaskDrag,
  listContainerId,
  setDragPreview,
  startTaskDrag,
  subtasksContainerId,
  useTaskDrag,
  type DropContainerData,
  type TaskDragData,
} from '../../shared/tasks/useTaskDrag';
import { renderDueBadge, renderRepeatBadge, renderSubtaskExtra, renderSubtaskEditExtra, renderTaskEditExtra } from './taskBadges';
import { useTaskLists } from './useTaskLists';

// A press-and-hold before a drag activates, so a normal click on a task's
// checkbox, edit button, etc. is never mistaken for the start of a reorder
// — matches the constraint every row already used before this moved here.
const ACTIVATION_CONSTRAINT = { delay: 500, tolerance: 5 };

type ResolvedContainer = { type: 'list'; listId: string } | { type: 'subtasks'; taskId: string };

// Normalizes whatever dnd-kit resolved `over` to — a specific task/subtask
// ROW (hovering a sibling directly, for same-container reordering or
// precise cross-container positioning) or a CONTAINER's own droppable zone
// (an empty list, or a task's empty subtasks area) — down to which
// container it belongs to, so onDragEnd doesn't need to care which of the
// two it actually was.
function resolveOverContainer(data: unknown): ResolvedContainer | null {
  const tag = data as TaskDragData | DropContainerData | undefined;
  if (!tag) return null;
  if (tag.type === 'task') return { type: 'list', listId: tag.listId };
  if (tag.type === 'subtask') return { type: 'subtasks', taskId: tag.parentTaskId };
  if (tag.type === 'list') return { type: 'list', listId: tag.listId };
  return { type: 'subtasks', taskId: tag.taskId };
}

// Only set when `over` is a specific sibling ROW (not a container's own
// droppable zone) — that's what reorderTasks/reorderSubtasks need to
// position relative to; dropping on bare empty space has nothing to anchor
// to, so those calls are just skipped.
function resolveOverItemId(over: Over): string | null {
  const data = over.data.current as TaskDragData | undefined;
  return data && (data.type === 'task' || data.type === 'subtask') ? String(over.id) : null;
}

// closestCenter alone measures every droppable/sortable rect on the WHOLE
// dashboard by raw center-distance — with a single shared DndContext
// spanning every widget (see this component's own comment below), a
// dragged row near the edge of its own list can end up momentarily
// "closer" to a row in a neighboring widget than to its actual neighbor,
// flipping `over` to a different SortableContext for a frame and back.
// Each flip resets that context's own FLIP animation, which is what reads
// as a sibling "jumping" into place instead of sliding smoothly out of
// the way. pointerWithin checks literal containment instead — resolving
// to whichever droppable the pointer is actually inside first removes
// that ambiguity; closestCenter is kept only as a fallback for the gap
// between rows (or past the last one), where nothing literally contains
// the pointer yet.
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

function overlayExtraForTask(task: Task) {
  return (
    <>
      {renderRepeatBadge(task, () => {})}
      {renderDueBadge(task, () => {})}
    </>
  );
}

// Wraps <Grid> (see src/app/(dashboard)/page.tsx) with the one shared
// dnd-kit DndContext + DragOverlay the whole dashboard's task rows
// register into — see useTaskDrag.ts for why a single shared context is
// what makes dragging a task from one Task List widget instance onto a
// DIFFERENT instance possible at all (today, each list/subtask-list built
// its own independent context, so a drag could never resolve `over`
// anything outside its own one container).
export default function TaskDragProvider({ children }: { children: ReactNode }) {
  const { tasks, subtasks, reorderTasks, reorderSubtasks, moveTask } = useTaskLists();
  const dragState = useTaskDrag();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: ACTIVATION_CONSTRAINT }));

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as TaskDragData | undefined;
    if (!data) return;
    if (data.type === 'task') {
      const task = tasks.find((t) => t.id === data.taskId);
      if (task) startTaskDrag(task.id, 'task', task);
    } else {
      const subtask = subtasks.find((s) => s.id === data.subtaskId);
      if (subtask) startTaskDrag(subtask.id, 'subtask', subtask);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setDragPreview(null, true);
      return;
    }
    const activeData = active.data.current as TaskDragData | undefined;
    const container = resolveOverContainer(over.data.current);
    if (!activeData || !container) {
      setDragPreview(null, true);
      return;
    }

    // A task can only ever land in a list (reordered within its own, or
    // moved to a different one) — it can never become a subtask by being
    // dragged onto a task/subtasks area. A subtask can only be reordered
    // within its OWN parent's subtasks area — it can't be dragged onto a
    // different task (reparenting) or onto a list (promoting to a
    // top-level task).
    const isValid =
      activeData.type === 'task'
        ? container.type === 'list'
        : container.type === 'subtasks' && container.taskId === activeData.parentTaskId;

    const originContainerId =
      activeData.type === 'task' ? listContainerId(activeData.listId) : subtasksContainerId(activeData.parentTaskId);
    const containerId = container.type === 'list' ? listContainerId(container.listId) : subtasksContainerId(container.taskId);

    // Only worth highlighting a container when landing there would
    // actually move the item somewhere new — hovering back over its own
    // current container is just ordinary reordering (unrestricted, for
    // both tasks and subtasks), which has nothing to preview. A subtask's
    // own container is now its ONLY ever-valid target (see isValid above),
    // so this also means a subtask drag never highlights anything at all.
    setDragPreview(containerId === originContainerId ? null : containerId, isValid);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    endTaskDrag();
    if (!over) return;

    const activeData = active.data.current as TaskDragData | undefined;
    if (!activeData) return;
    const container = resolveOverContainer(over.data.current);
    if (!container) return;
    const overItemId = resolveOverItemId(over);

    if (activeData.type === 'task') {
      // A task only ever reorders/reparents within list containers — see
      // handleDragOver's isValid, which is what keeps the drop-target
      // highlight from ever appearing over a subtasks area in the first
      // place; this is the matching no-op if one somehow got dropped there
      // anyway (e.g. a stale `over` from a fast pointer move).
      if (container.type !== 'list') return;
      const activeId = activeData.taskId;
      if (container.listId !== activeData.listId) moveTask(activeId, container.listId);
      if (overItemId && overItemId !== activeId) reorderTasks(container.listId, activeId, overItemId);
      return;
    }

    // A subtask only ever reorders within its OWN parent's subtasks area —
    // same reasoning as above.
    if (container.type !== 'subtasks' || container.taskId !== activeData.parentTaskId) return;
    const activeId = activeData.subtaskId;
    if (overItemId && overItemId !== activeId) reorderSubtasks(container.taskId, activeId, overItemId);
  };

  const handleDragCancel = () => endTaskDrag();

  // The overlay is inert (pointer-events: none, see task-item.scss's
  // .sortable-drag-overlay) — every click handler below is a no-op, same
  // as the static copies TaskParent already renders for a task's own
  // nested subtasks overlay (see SubtaskOverlayRow).
  const renderOverlayContent = () => {
    if (!dragState.activeId || !dragState.activeType || !dragState.activeRecord) return null;

    if (dragState.activeType === 'task') {
      const task = dragState.activeRecord as Task;
      const taskSubtasks = subtasks.filter((s) => s.parentId === task.id).sort((a, b) => a.order - b.order);
      return (
        <TaskParent
          task={task}
          subtasks={taskSubtasks}
          onToggle={() => {}}
          extra={overlayExtraForTask(task)}
          renderSubtaskExtra={(subtask) => renderSubtaskExtra(subtask, () => {}, () => {})}
          editExtra={renderTaskEditExtra(task, () => {}, () => {})}
          renderSubtaskEditExtra={(subtask) => renderSubtaskEditExtra(subtask, () => {}, () => {})}
          overlay
        />
      );
    }

    const subtask = dragState.activeRecord as Subtask;
    const parentTask = tasks.find((t) => t.id === subtask.parentId);
    if (!parentTask) return null;
    return (
      <SubtaskOverlayRow
        subtask={subtask}
        stages={parentTask.stages}
        extra={renderSubtaskExtra(subtask, () => {}, () => {})}
        editExtra={renderSubtaskEditExtra(subtask, () => {}, () => {})}
      />
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}

      {mounted &&
        createPortal(
          <DragOverlay>
            {dragState.activeId ? (
              <div className="sortable-drag-overlay" style={{ pointerEvents: 'none' }}>
                {renderOverlayContent()}
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
