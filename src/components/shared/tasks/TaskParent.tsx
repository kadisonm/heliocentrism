'use client';

import { useDragOperation, useDroppable } from '@dnd-kit/react';
import type { ReactNode } from 'react';
import { getNextStageIndex, isTaskDone } from '../../../lib/tasks/taskCascade';
import type { Subtask, Task, TaskStageDef } from '../../../lib/types';
import type { ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import { subtaskType, subtasksZoneId } from './taskSortableTypes';
import { getStagePosition, stageAriaLabel } from './taskStageDisplay';
import TaskRow from './TaskRow';
import { useTaskSortable } from './useTaskSortable';

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
  // Which task/subtask id is currently mid-drag or just dropped — drives
  // the row's stable, one-shot "picked up"/"dropped" scale pop (see
  // TaskRow.tsx's dragPhase).
  draggingId?: string | null;
  droppingId?: string | null;
};

type TaskParentProps<T extends Task> = TaskParentHandlers & {
  task: T;
  // Subtasks live in their own flat store now (see useTaskLists.ts) — the
  // caller filters+sorts the ones belonging to this task and passes them
  // in, the same way it already supplies extra/editExtra per task.
  subtasks: Subtask[];
  dragRef?: (element: Element | null) => void;
};

function dragPhaseFor(id: string, draggingId?: string | null, droppingId?: string | null) {
  if (draggingId === id) return 'dragging' as const;
  if (droppingId === id) return 'dropped' as const;
  return undefined;
}

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

// A done subtask is excluded from the live sortable arrangement entirely
// (see useTaskLists.ts's groupedSubtaskIds) — `disabled` keeps it a fixed,
// non-draggable, non-drop-target row while every other handler stays live.
function SubtaskSortableRow({
  subtask,
  index,
  stages,
  handlers,
}: {
  subtask: Subtask;
  index: number;
  stages: TaskStageDef[];
  handlers: TaskParentHandlers;
}) {
  const done = isTaskDone({ stage: subtask.stage, stages });
  const { dragRef } = useTaskSortable({
    id: subtask.id,
    index: done ? 0 : index,
    group: subtasksZoneId(subtask.parentId),
    type: subtaskType(subtask.parentId),
    disabled: done,
  });
  return (
    <TaskRow
      {...subtaskProps(subtask, stages)}
      dragRef={dragRef}
      onToggleStage={() => handlers.onToggleSubtask?.(subtask.id)}
      onCommitTitle={(title) => handlers.onUpdateSubtask?.(subtask.id, { title })}
      onCommitDescription={(description) => handlers.onUpdateSubtask?.(subtask.id, { description })}
      isActive={handlers.activeSubtaskId === subtask.id}
      onRowClick={(position) => handlers.onSubtaskRowClick?.(subtask.id, position)}
      extra={handlers.renderSubtaskExtra?.(subtask)}
      editExtra={handlers.renderSubtaskEditExtra?.(subtask)}
      isEditingRow={handlers.editingSubtaskId === subtask.id}
      onEnterEditMode={() => handlers.onSubtaskEnterEditMode?.(subtask.id)}
      dragPhase={dragPhaseFor(subtask.id, handlers.draggingId, handlers.droppingId)}
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
  draggingId,
  droppingId,
  dragRef,
}: TaskParentProps<T>) {
  const nextIndex = getNextStageIndex(task.stage, task.stages.length);
  const activeStage = task.stages[task.stage];
  const nextStage = task.stages[nextIndex];

  // Always registered (even with zero subtasks) so dropping one of this
  // task's own subtasks into otherwise-empty space still has something to
  // hit-test against — an empty zone has no rows of its own to register a
  // sortable against.
  const { ref: setSubtasksDropRef } = useDroppable({
    id: subtasksZoneId(task.id),
    type: subtaskType(task.id),
    accept: subtaskType(task.id),
  });

  // Only takes up space while dragging one of THIS task's own subtasks —
  // otherwise an empty zone stays invisible at rest (see
  // .task-item__subtasks:empty in task-item.scss).
  const { source } = useDragOperation();
  const isDropTargetCandidate = source?.type === subtaskType(task.id);

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
    draggingId,
    droppingId,
  };

  let notDoneIndex = 0;

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
      extra={extra}
      editExtra={editExtra}
      isEditingRow={isEditingRow}
      onEnterEditMode={onEnterEditMode}
      dragPhase={dragPhaseFor(task.id, draggingId, droppingId)}
      dragRef={dragRef}
    >
      <div
        ref={setSubtasksDropRef}
        className={['task-item__subtasks', isDropTargetCandidate && 'task-item__subtasks--droppable'].filter(Boolean).join(' ')}
      >
        {subtasks.map((subtask) => (
          <SubtaskSortableRow
            key={subtask.id}
            subtask={subtask}
            index={isTaskDone({ stage: subtask.stage, stages: task.stages }) ? 0 : notDoneIndex++}
            stages={task.stages}
            handlers={handlers}
          />
        ))}
      </div>
    </TaskRow>
  );
}
