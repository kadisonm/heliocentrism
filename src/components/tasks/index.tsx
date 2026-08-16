import type { Todo, TodoStage } from '../../lib/types';

type TaskProps = {
  todo: Todo;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
  statusLabel: 'To do' | 'In progress' | 'Done';
};

export default function Task({ todo, onToggle, onEdit, statusLabel }: TaskProps) {
  const nextStatus =
    statusLabel === 'To do'
      ? 'In progress'
      : statusLabel === 'In progress'
        ? 'Done'
        : 'To do';

  return (
    <div className="todo-item">
      <button
        type="button"
        className="todo-toggle"
        data-stage={todo.stage as TodoStage}
        onClick={() => onToggle(todo.id)}
        aria-label={`Set ${todo.title} to ${nextStatus}`}
      >
        <span className="todo-toggle__mark" />
      </button>

      <div className="todo-item__content">
        <div className="todo-item__header">
          <p className={`todo-item__title ${todo.stage === 2 ? 'is-done' : ''}`}>
            {todo.title}
          </p>

          <span
            className={`todo-status todo-status--${statusLabel.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="todo-item__meta">
          <p className="todo-item__due">Due {todo.due}</p>
        </div>

        <button type="button" className="todo-item__edit-button" onClick={() => onEdit(todo)}>
          Edit
        </button>
      </div>
    </div>
  );
}
