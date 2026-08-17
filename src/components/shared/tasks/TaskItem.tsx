import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Pencil } from 'lucide-react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { Subtask, Task } from '../../../lib/types';
import SortableTaskList from './SortableTaskList';

const statusLabels = ['To do', 'In progress', 'Done'] as const;

type TaskItemHandlers<T extends Task> = {
  onToggle: (id: string) => void;
  onEdit: (task: T) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onReorderSubtasks?: (taskId: string, activeId: string, overId: string) => void;
  // Slot for a type-specific addition rendered next to the title (e.g. a
  // Todo's due date) — keeps this component generic across Task variants.
  extra?: ReactNode;
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
  onToggleSubtask,
  onReorderSubtasks,
  extra,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isPlaceholder,
  overlay,
}: TaskItemViewProps<T>) {
  const statusLabel = statusLabels[task.stage];
  const nextStatus = statusLabels[(task.stage + 1) % 3];

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
        className="task-toggle"
        data-stage={task.stage}
        onClick={() => onToggle(task.id)}
        aria-label={`Set ${task.title} to ${nextStatus}`}
      >
        <span className="task-toggle__mark" />
      </button>

      <div className="task-item__content">
        <div className="task-item__header">
          <p className={`task-item__title ${task.stage === 2 ? 'is-done' : ''}`}>
            {task.title}
          </p>

          {extra}

          <div className="task-item__header-actions">
            <span
              className={`task-status task-status--${statusLabel.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {statusLabel}
            </span>

            <button
              type="button"
              className="task-item__edit-button"
              onClick={() => onEdit(task)}
              title="Edit"
              aria-label={`Edit ${task.title}`}
            >
              <Pencil size={13} />
            </button>
          </div>
        </div>

        {task.description && <p className="task-item__description">{task.description}</p>}

        {task.subtasks.length > 0 &&
          (overlay ? (
            <div className="task-item__subtasks">
              {task.subtasks.map((subtask) => (
                <SubtaskRowView key={subtask.id} subtask={subtask} onToggle={() => {}} />
              ))}
            </div>
          ) : (
            <SortableTaskList
              ids={task.subtasks.map((subtask) => subtask.id)}
              onReorder={(activeId, overId) => onReorderSubtasks?.(task.id, activeId, overId)}
              renderOverlay={(activeId) => {
                const subtask = task.subtasks.find((s) => s.id === activeId);
                return subtask ? (
                  <SubtaskRowView subtask={subtask} onToggle={() => {}} />
                ) : null;
              }}
            >
              <div className="task-item__subtasks">
                {task.subtasks.map((subtask) => (
                  <SubtaskRow
                    key={subtask.id}
                    subtask={subtask}
                    onToggle={() => onToggleSubtask?.(task.id, subtask.id)}
                  />
                ))}
              </div>
            </SortableTaskList>
          ))}
      </div>
    </div>
  );
}

function SubtaskRow({ subtask, onToggle }: { subtask: Subtask; onToggle: () => void }) {
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
      onToggle={onToggle}
      isPlaceholder={isDragging}
      dragRef={setNodeRef}
      dragStyle={style}
      dragAttributes={attributes}
      dragListeners={listeners}
    />
  );
}

type SubtaskRowViewProps = DragBindings & { subtask: Subtask; onToggle: () => void };

function SubtaskRowView({
  subtask,
  onToggle,
  dragRef,
  dragStyle,
  dragAttributes,
  dragListeners,
  isPlaceholder,
}: SubtaskRowViewProps) {
  const subtaskStatusLabel = statusLabels[subtask.stage];

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
        className="task-toggle"
        data-stage={subtask.stage}
        onClick={onToggle}
        aria-label={`Set ${subtask.title} to next status`}
        title={subtaskStatusLabel}
      >
        <span className="task-toggle__mark" />
      </button>
      <p className={`subtask__title ${subtask.stage === 2 ? 'is-done' : ''}`}>
        {subtask.title}
      </p>
    </div>
  );
}
