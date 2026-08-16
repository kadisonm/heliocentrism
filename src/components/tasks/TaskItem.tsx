import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Task } from '../../lib/types';

const statusLabels = ['To do', 'In progress', 'Done'] as const;

type TaskItemProps<T extends Task> = {
  task: T;
  onToggle: (id: string) => void;
  onEdit: (task: T) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  // Slot for a type-specific addition rendered next to the title (e.g. a
  // Todo's due date) — keeps this component generic across Task variants.
  extra?: ReactNode;
};

export default function TaskItem<T extends Task>({
  task,
  onToggle,
  onEdit,
  onToggleSubtask,
  extra,
}: TaskItemProps<T>) {
  const statusLabel = statusLabels[task.stage];
  const nextStatus = statusLabels[(task.stage + 1) % 3];

  return (
    <div className="todo-item">
      <button
        type="button"
        className="todo-toggle"
        data-stage={task.stage}
        onClick={() => onToggle(task.id)}
        aria-label={`Set ${task.title} to ${nextStatus}`}
      >
        <span className="todo-toggle__mark" />
      </button>

      <div className="todo-item__content">
        <div className="todo-item__header">
          <p className={`todo-item__title ${task.stage === 2 ? 'is-done' : ''}`}>
            {task.title}
          </p>

          {extra}

          <div className="todo-item__header-actions">
            <span
              className={`todo-status todo-status--${statusLabel.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {statusLabel}
            </span>

            <button
              type="button"
              className="todo-item__edit-button"
              onClick={() => onEdit(task)}
              title="Edit"
              aria-label={`Edit ${task.title}`}
            >
              <Pencil size={13} />
            </button>
          </div>
        </div>

        {task.description && <p className="todo-item__description">{task.description}</p>}

        {task.subtasks.length > 0 && (
          <div className="todo-item__subtasks">
            {task.subtasks.map((subtask) => {
              const subtaskStatusLabel = statusLabels[subtask.stage];
              return (
                <div key={subtask.id} className="todo-subtask">
                  <button
                    type="button"
                    className="todo-toggle"
                    data-stage={subtask.stage}
                    onClick={() => onToggleSubtask?.(task.id, subtask.id)}
                    aria-label={`Set ${subtask.title} to next status`}
                    title={subtaskStatusLabel}
                  >
                    <span className="todo-toggle__mark" />
                  </button>
                  <p className={`todo-subtask__title ${subtask.stage === 2 ? 'is-done' : ''}`}>
                    {subtask.title}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
