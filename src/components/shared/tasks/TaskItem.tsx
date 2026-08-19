import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { createElement } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { getNextStageIndex, isTaskDone } from '../../../lib/taskCascade';
import { getTaskStageIcon } from '../../../lib/taskStageIcons';
import type { Subtask, Task, TaskStageDef } from '../../../lib/types';
import SortableTaskList from './SortableTaskList';
import { useSettings } from './useSettings';

function stageAriaLabel(stageDef: TaskStageDef, index: number): string {
  return stageDef.name || `stage ${index + 1}`;
}

function isBlankStage(stageDef: TaskStageDef): boolean {
  return stageDef.name === '' && stageDef.color === 'none' && !stageDef.icon;
}

// Purely presentational classification (drives CSS only) — kept local
// rather than in taskCascade.ts, unlike isTaskDone/the cascade functions,
// which non-UI modules also consume.
function getStagePosition(stage: number, stagesLength: number): 'start' | 'middle' | 'done' {
  if (stage === stagesLength - 1) return 'done';
  if (stage === 0) return 'start';
  return 'middle';
}

type TaskItemHandlers<T extends Task> = {
  onToggle: (id: string) => void;
  onEdit: (task: T) => void;
  onDelete: (id: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks?: (taskId: string, activeId: string, overId: string) => void;
  onAddSubtask?: (taskId: string) => void;
  // Slot for an extra bit of UI rendered next to the title (e.g. the due
  // date badge).
  extra?: ReactNode;
  // Per-subtask counterpart to `extra` — called once per subtask (not once
  // per Task) since each subtask's badges depend on its own due/repeat.
  renderSubtaskExtra?: (subtask: Subtask) => ReactNode;
};

type TaskItemProps<T extends Task> = TaskItemHandlers<T> & { task: T };

export default function TaskItem<T extends Task>({ task, ...handlers }: TaskItemProps<T>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  // CSS.Translate (not CSS.Transform) deliberately drops the scaleX/scaleY
  // the sortable strategy computes for neighboring items of a different
  // height — applying that scale to the dragged item itself is what made
  // multi-line tasks visibly stretch/squash while being dragged.
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    touchAction: 'none',
  };

  return (
    <TaskItemView
      task={task}
      {...handlers}
      isPlaceholder={isDragging}
      dragRef={setNodeRef}
      dragStyle={style}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

type DragBindings = {
  dragRef?: (node: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
  dragAttributes?: HTMLAttributes<HTMLElement>;
  dragListeners?: HTMLAttributes<HTMLElement>;
  isPlaceholder?: boolean;
};

type TaskItemViewProps<T extends Task> = TaskItemHandlers<T> &
  DragBindings & {
    task: T;
    // True only for the floating DragOverlay copy — renders subtasks as
    // plain, non-interactive rows instead of a nested sortable list, so a
    // drag in progress never has a second DndContext live under the pointer.
    overlay?: boolean;
  };

export function TaskItemView<T extends Task>({
  task,
  onToggle,
  onEdit,
  onDelete,
  onToggleSubtask,
  onReorderSubtasks,
  onAddSubtask,
  extra,
  renderSubtaskExtra,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isPlaceholder,
  overlay,
}: TaskItemViewProps<T>) {
  const nextIndex = getNextStageIndex(task.stage, task.stages.length);
  const activeStage = task.stages[task.stage];
  const nextStage = task.stages[nextIndex];
  const StageIcon = getTaskStageIcon(activeStage.icon);
  const { settings } = useSettings();
  const isWrap = settings.taskTitleOverflow === 'wrap';

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      className={`task-item ${isPlaceholder ? 'task-item--placeholder' : ''}`}
      {...dragAttributes}
      {...dragListeners}
    >
      <button
        type="button"
        className={`task-toggle task-toggle--${activeStage.color}`}
        data-stage={task.stage}
        data-position={getStagePosition(task.stage, task.stages.length)}
        onClick={() => onToggle(task.id)}
        aria-label={`Set ${task.title} to ${stageAriaLabel(nextStage, nextIndex)}`}
      >
        {StageIcon && createElement(StageIcon, { size: 12 })}
      </button>

      <div className="task-item__content">
        <div className="task-item__toolbar">
          {onAddSubtask && (
            <button
              type="button"
              className="task-item__toolbar-button"
              onClick={() => onAddSubtask(task.id)}
              title="Add subtask"
              aria-label={`Add subtask to ${task.title}`}
            >
              <Plus size={13} />
            </button>
          )}

          <button
            type="button"
            className="task-item__toolbar-button"
            onClick={() => onEdit(task)}
            title="Edit"
            aria-label={`Edit ${task.title}`}
          >
            <Pencil size={13} />
          </button>

          <button
            type="button"
            className="task-item__toolbar-button task-item__toolbar-button--danger"
            onClick={() => onDelete(task.id)}
            title="Delete"
            aria-label={`Delete ${task.title}`}
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className={`task-item__header ${isWrap ? 'task-item__header--wrap' : ''}`}>
          <p
            className={`task-item__title ${isTaskDone(task) ? 'is-done' : ''} ${isWrap ? 'task-item__title--wrap' : ''}`}
          >
            {task.title}
          </p>

          {extra}

          <div className="task-item__header-actions">
            {!isBlankStage(activeStage) && (
              <span className={`task-item__stage task-item__stage--${activeStage.color}`}>
                {StageIcon && createElement(StageIcon, { size: 12 })}
                {activeStage.name && <span>{activeStage.name}</span>}
              </span>
            )}
          </div>
        </div>

        {task.description && <p className="task-item__description">{task.description}</p>}

        {task.subtasks.length > 0 &&
          (overlay ? (
            <div className="task-item__subtasks">
              {task.subtasks.map((subtask) => (
                <SubtaskRowView
                  key={subtask.id}
                  subtask={subtask}
                  stages={task.stages}
                  onToggle={() => {}}
                  extra={renderSubtaskExtra?.(subtask)}
                />
              ))}
            </div>
          ) : (
            <SortableTaskList
              ids={task.subtasks.map((subtask) => subtask.id)}
              onReorder={(activeId, overId) => onReorderSubtasks?.(task.id, activeId, overId)}
              renderOverlay={(activeId) => {
                const subtask = task.subtasks.find((s) => s.id === activeId);
                return subtask ? (
                  <SubtaskRowView
                    subtask={subtask}
                    stages={task.stages}
                    onToggle={() => {}}
                    extra={renderSubtaskExtra?.(subtask)}
                  />
                ) : null;
              }}
            >
              <div className="task-item__subtasks">
                {task.subtasks.map((subtask) => (
                  <SubtaskRow
                    key={subtask.id}
                    subtask={subtask}
                    stages={task.stages}
                    onToggle={() => onToggleSubtask?.(task.id, subtask.id)}
                    extra={renderSubtaskExtra?.(subtask)}
                  />
                ))}
              </div>
            </SortableTaskList>
          ))}
      </div>
    </div>
  );
}

function SubtaskRow({
  subtask,
  stages,
  onToggle,
  extra,
}: {
  subtask: Subtask;
  stages: TaskStageDef[];
  onToggle: () => void;
  extra?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id,
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    touchAction: 'none',
  };

  return (
    <SubtaskRowView
      subtask={subtask}
      stages={stages}
      onToggle={onToggle}
      extra={extra}
      isPlaceholder={isDragging}
      dragRef={setNodeRef}
      dragStyle={style}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

type SubtaskRowViewProps = DragBindings & {
  subtask: Subtask;
  stages: TaskStageDef[];
  onToggle: () => void;
  extra?: ReactNode;
};

function SubtaskRowView({
  subtask,
  stages,
  onToggle,
  extra,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isPlaceholder,
}: SubtaskRowViewProps) {
  const subtaskStage = stages[subtask.stage];
  const subtaskStageLabel = stageAriaLabel(subtaskStage, subtask.stage);
  const SubtaskStageIcon = getTaskStageIcon(subtaskStage.icon);

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      className={`subtask ${isPlaceholder ? 'subtask--placeholder' : ''}`}
      {...dragAttributes}
      {...dragListeners}
    >
      <button
        type="button"
        className={`task-toggle task-toggle--${subtaskStage.color}`}
        data-stage={subtask.stage}
        data-position={getStagePosition(subtask.stage, stages.length)}
        onClick={onToggle}
        aria-label={`Set ${subtask.title} to next status`}
        title={subtaskStageLabel}
      >
        {SubtaskStageIcon && createElement(SubtaskStageIcon, { size: 12 })}
      </button>
      <p className={`subtask__title ${isTaskDone({ stage: subtask.stage, stages }) ? 'is-done' : ''}`}>
        {subtask.title}
      </p>
      {extra}
    </div>
  );
}
