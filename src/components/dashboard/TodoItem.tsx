type TodoItemProps = {
  todo: {
    title: string;
    due: string;
    stage: 0 | 1 | 2;
  };
  onToggle: (title: string) => void;
  statusLabel: 'To do' | 'In progress' | 'Done';
};

export default function TodoItem({ todo, onToggle, statusLabel }: TodoItemProps) {
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
        data-stage={todo.stage}
        onClick={() => onToggle(todo.title)}
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

        <p className="todo-item__due">Due {todo.due}</p>
      </div>
    </div>
  );
}