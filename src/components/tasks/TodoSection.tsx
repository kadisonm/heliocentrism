import Task from '.';
import type { RecurrenceValue, Todo } from '../../lib/types';

const statusLabels = ['To do', 'In progress', 'Done'] as const;

type TodoSectionProps = {
  recurrence: RecurrenceValue;
  todos: Todo[];
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
};

export default function TodoSection({ recurrence, todos, onToggle, onEdit }: TodoSectionProps) {
  return (
    <div className="routine-section">
      <div className="routine-section__header">
        <h3>{recurrence}</h3>
      </div>

      <div className="routine-list">
        {todos.length > 0 ? (
          todos.map((todo) => (
            <Task
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onEdit={onEdit}
              statusLabel={statusLabels[todo.stage]}
            />
          ))
        ) : (
          <p className="routine-empty">No {recurrence} tasks</p>
        )}
      </div>
    </div>
  );
}
