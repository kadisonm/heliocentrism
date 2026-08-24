import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { getNextStageIndex, isTaskDone } from '../../../lib/taskCascade';
import type { Subtask, Task, TaskStageDef } from '../../../lib/types';
import type { ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import SortableTaskList from './SortableTaskList';
import { getStagePosition, stageAriaLabel } from './taskStageDisplay';
import TaskRow from './TaskRow';
import { subtasksContainerId, useTaskDrag } from './useTaskDrag';
import { useSortableDragBindings, type DragBindings } from './useSortableDragBindings';

export type TaskParentHandlers = {
  onToggle: (id: string) => void;
  onToggleSubtask?: (subtaskId: string) => void;
  // The caller owns the actual "..." menu UI, rendered as a floating popup
  // at the reported click position rather than inside this component.
  isActive?: boolean;
  onRowClick?: (position: ContextMenuPosition) => void;
  activeSubtaskId?: string | null;
  onSubtaskRowClick?: (subtaskId: string, position: ContextMenuPosition) => void;
  // Task-only — subtasks share their parent's `stages` array.
  onEditStages?: (task: Task) => void;
  onUpdateTask?: (task: Task) => void;
  onUpdateSubtask?: (subtaskId: string, patch: Partial<Pick<Subtask, 'title' | 'description'>>) => void;
  extra?: ReactNode;
  renderSubtaskExtra?: (subtask: Subtask) => ReactNode;
  editExtra?: ReactNode;
  renderSubtaskEditExtra?: (subtask: Subtask) => ReactNode;
  // Row-level "edit mode" — entered by clicking the title/description, or
  // any of the row's badges (stage/due/repeat), all wired by the caller.
  // Drives whether editExtra/the description placeholder are revealed.
  isEditingRow?: boolean;
  onEnterEditMode?: () => void;
  editingSubtaskId?: string | null;
  onSubtaskEnterEditMode?: (subtaskId: string) => void;
};

type TaskParentProps<T extends Task> = TaskParentHandlers &
  DragBindings & {
    task: T;
    // Subtasks live in their own flat store now (see useTaskLists.ts) — the
    // caller filters+sorts the ones belonging to this task and passes them
    // in, the same way it already supplies extra/editExtra per task.
    subtasks: Subtask[];
    // True only for the floating DragOverlay copy — subtasks render as
    // plain rows instead of a nested sortable list, so a drag in progress
    // never has a second DndContext live under the pointer.
    overlay?: boolean;
  };

export function subtaskProps(subtask: Subtask, stages: TaskStageDef[]) {
  const stageDef = stages[subtask.stage];
  return {
    variant: 'subtask' as const,
    title: subtask.title,
    description: subtask.description,
    isDone: isTaskDone({ stage: subtask.stage, stages }),
    stageDef,
    stageIndex: subtask.stage,
    stagePosition: getStagePosition(subtask.stage, stages.length),
    toggleAriaLabel: `Set ${subtask.title} to next status`,
    toggleTitle: stageAriaLabel(stageDef, subtask.stage),
  };
}

// Plain (non-sortable) render — used for the whole-task drag overlay's
// static subtask list, for an individual subtask's own drag overlay, and
// (via TaskDragProvider, which has no rendering context of its own to
// delegate to) the shared DragOverlay's copy of whichever subtask is
// currently being dragged.
export function SubtaskOverlayRow({
  subtask,
  stages,
  extra,
  editExtra,
}: {
  subtask: Subtask;
  stages: TaskStageDef[];
  extra?: ReactNode;
  editExtra?: ReactNode;
}) {
  return (
    <TaskRow
      {...subtaskProps(subtask, stages)}
      onToggleStage={() => {}}
      onCommitTitle={() => {}}
      onCommitDescription={() => {}}
      onRowClick={() => {}}
      extra={extra}
      editExtra={editExtra}
    />
  );
}

function SubtaskSortableRow({
  subtask,
  stages,
  handlers,
}: {
  subtask: Subtask;
  stages: TaskStageDef[];
  handlers: TaskParentHandlers;
}) {
  const dragBindings = useSortableDragBindings(subtask.id, {
    type: 'subtask',
    subtaskId: subtask.id,
    parentTaskId: subtask.parentId,
  });
  return (
    <TaskRow
      {...subtaskProps(subtask, stages)}
      {...dragBindings}
      onToggleStage={() => handlers.onToggleSubtask?.(subtask.id)}
      onCommitTitle={(title) => handlers.onUpdateSubtask?.(subtask.id, { title })}
      onCommitDescription={(description) => handlers.onUpdateSubtask?.(subtask.id, { description })}
      isActive={handlers.activeSubtaskId === subtask.id}
      onRowClick={(position) => handlers.onSubtaskRowClick?.(subtask.id, position)}
      extra={handlers.renderSubtaskExtra?.(subtask)}
      editExtra={handlers.renderSubtaskEditExtra?.(subtask)}
      isEditingRow={handlers.editingSubtaskId === subtask.id}
      onEnterEditMode={() => handlers.onSubtaskEnterEditMode?.(subtask.id)}
    />
  );
}

// The task's own row, plus its nested subtasks — a task shows a Stage
// badge and can hold subtasks; a subtask (rendered via the same TaskRow)
// shows neither.
export default function TaskParent<T extends Task>({
  task,
  subtasks,
  onToggle,
  onToggleSubtask,
  isActive,
  onRowClick,
  activeSubtaskId,
  onSubtaskRowClick,
  onEditStages,
  onUpdateTask,
  onUpdateSubtask,
  extra,
  renderSubtaskExtra,
  editExtra,
  renderSubtaskEditExtra,
  isEditingRow,
  onEnterEditMode,
  editingSubtaskId,
  onSubtaskEnterEditMode,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isPlaceholder,
  overlay,
}: TaskParentProps<T>) {
  const nextIndex = getNextStageIndex(task.stage, task.stages.length);
  const activeStage = task.stages[task.stage];
  const nextStage = task.stages[nextIndex];

  // Always registered (even with zero subtasks) so dropping one of this
  // task's OWN subtasks into otherwise-empty space (the only remaining
  // valid drop here — see TaskDragProvider's resolution table: a subtask
  // can only reorder within its OWN parent, and a task can never nest
  // under another) still has something to hit-test against. The floating
  // DragOverlay copy (see TaskDragProvider) renders this SAME task a
  // second time while the real row stays mounted (just hidden — see
  // .task-item--placeholder) — disabled alone isn't enough to make that
  // safe, since dnd-kit still tracks a disabled droppable's id; giving the
  // overlay copy its own distinct id avoids two simultaneous registrations
  // of the same one.
  const containerId = subtasksContainerId(task.id);
  const droppableId = overlay ? `overlay:${containerId}` : containerId;
  const { setNodeRef: setSubtasksDropRef } = useDroppable({
    id: droppableId,
    data: { type: 'subtasks', taskId: task.id },
    disabled: overlay,
  });
  const dragState = useTaskDrag();
  // An empty subtasks zone has no content to hold it open (see
  // .task-item__subtasks:empty in task-item.scss) — it only takes up any
  // space at all while a drag that could ACTUALLY land here is in
  // progress, so a task with no subtasks stays perfectly invisible at
  // rest, exactly like before this container existed. Scoped to a subtask
  // drag whose OWN parent is this task specifically — a task being
  // dragged, or a subtask belonging to some OTHER task, can never validly
  // drop here, so this container has no business waking up (and inviting
  // a drop) for either.
  const isDropTargetCandidate =
    dragState.activeType === 'subtask' && (dragState.activeRecord as Subtask | null)?.parentId === task.id;
  const isSubtaskDropTarget = dragState.previewContainerId === containerId && dragState.isValidDrop;

  const handlers: TaskParentHandlers = {
    onToggle,
    onToggleSubtask,
    isActive,
    onRowClick,
    activeSubtaskId,
    onSubtaskRowClick,
    onEditStages,
    onUpdateTask,
    onUpdateSubtask,
    extra,
    renderSubtaskExtra,
    editExtra,
    renderSubtaskEditExtra,
    isEditingRow,
    onEnterEditMode,
    editingSubtaskId,
    onSubtaskEnterEditMode,
  };

  return (
    <TaskRow
      variant="task"
      title={task.title}
      description={task.description}
      isDone={isTaskDone(task)}
      stageDef={activeStage}
      stageIndex={task.stage}
      stagePosition={getStagePosition(task.stage, task.stages.length)}
      toggleAriaLabel={`Set ${task.title} to ${stageAriaLabel(nextStage, nextIndex)}`}
      onToggleStage={() => onToggle(task.id)}
      onCommitTitle={(title) => onUpdateTask?.({ ...task, title })}
      onCommitDescription={(description) => onUpdateTask?.({ ...task, description })}
      showStageBadge
      onStageBadgeClick={() => onEditStages?.(task)}
      isActive={isActive}
      onRowClick={onRowClick}
      showMenuButton={!overlay}
      extra={extra}
      editExtra={editExtra}
      isEditingRow={isEditingRow}
      onEnterEditMode={onEnterEditMode}
      dragRef={dragRef}
      dragStyle={dragStyle}
      dragAttributes={dragAttributes}
      dragListeners={dragListeners}
      isPlaceholder={isPlaceholder}
    >
      {overlay
        ? subtasks.length > 0 && (
            <div className="task-item__subtasks">
              {subtasks.map((subtask) => (
                <SubtaskOverlayRow
                  key={subtask.id}
                  subtask={subtask}
                  stages={task.stages}
                  extra={renderSubtaskExtra?.(subtask)}
                  editExtra={renderSubtaskEditExtra?.(subtask)}
                />
              ))}
            </div>
          )
        : (
          <SortableTaskList containerId={containerId} ids={subtasks.map((subtask) => subtask.id)}>
            <div
              ref={setSubtasksDropRef}
              className={[
                'task-item__subtasks',
                isDropTargetCandidate && 'task-item__subtasks--droppable',
                isSubtaskDropTarget && 'task-item__subtasks--drop-target',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {subtasks.map((subtask) => (
                <SubtaskSortableRow key={subtask.id} subtask={subtask} stages={task.stages} handlers={handlers} />
              ))}
            </div>
          </SortableTaskList>
        )}
    </TaskRow>
  );
}
