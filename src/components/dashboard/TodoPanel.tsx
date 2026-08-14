'use client';

import { useMemo, useState } from 'react';
import TodoEditorPanel from './TodoEditorPanel';
import TodoItem from './TodoItem';

export type TodoStage = 0 | 1 | 2;
export type Recurrence = 'daily' | 'weekly' | 'monthly';

export type Todo = {
  id: string;
  title: string;
  due: string;
  stage: TodoStage;
  recurrence: Recurrence;
};

const statusLabels = ['To do', 'In progress', 'Done'] as const;
const recurrenceOrder: Recurrence[] = ['daily', 'weekly', 'monthly'];

const initialTodos: Todo[] = [
  { id: '1', title: 'Finalize dashboard layout', due: 'Today', stage: 0, recurrence: 'daily' },
  { id: '2', title: 'Review onboarding checklist', due: 'Tomorrow', stage: 1, recurrence: 'weekly' },
  { id: '3', title: 'Prepare weekly summary', due: 'Fri', stage: 2, recurrence: 'monthly' },
  { id: '4', title: 'Inbox cleanup', due: 'Everyday', stage: 0, recurrence: 'daily' },
  { id: '5', title: 'KPI check-in', due: 'Every week', stage: 1, recurrence: 'weekly' },
  { id: '6', title: 'Quarter review', due: 'Every month', stage: 2, recurrence: 'monthly' },
];

function getNextStage(stage: TodoStage): TodoStage {
  return ((stage + 1) % 3) as TodoStage;
}

export default function TodoPanel() {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);

  const visibleTodos = useMemo(
    () => (showCompleted ? todos : todos.filter((todo) => todo.stage !== 2)),
    [showCompleted, todos]
  );

  const updateTodoStage = (todoId: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === todoId ? { ...todo, stage: getNextStage(todo.stage) } : todo
      )
    );
  };

  const updateTodo = (updatedTodo: Todo) => {
    setTodos((current) =>
      current.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo))
    );
    setSelectedTodo(null);
  };

  const groupedTodos = useMemo(
    () =>
      recurrenceOrder.reduce(
        (acc, key) => {
          acc[key] = visibleTodos.filter((todo) => todo.recurrence === key);
          return acc;
        },
        { daily: [], weekly: [], monthly: [] } as Record<Recurrence, Todo[]>
      ),
    [visibleTodos]
  );

  return (
    <>
      <aside className="todo-panel-shell">
        <div className="todo-panel">
          <div className="todo-panel-header">
            <h2>To do</h2>

            <div className="todo-panel-actions">
              <button
                type="button"
                className="todo-show-toggle"
                onClick={() => setShowCompleted((current) => !current)}
              >
                {showCompleted ? 'Hide complete' : 'Show complete'}
              </button>

              <button type="button" className="todo-add-button">
                + Add
              </button>
            </div>
          </div>

          <div className="todo-sections">
            {recurrenceOrder.map((recurrence) => (
              <div key={recurrence} className="todo-section">
                <div className="todo-section__header">
                  <h3>{recurrence}</h3>
                </div>

                <div className="todo-list">
                  {groupedTodos[recurrence].length > 0 ? (
                    groupedTodos[recurrence].map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={updateTodoStage}
                        onEdit={setSelectedTodo}
                        statusLabel={statusLabels[todo.stage]}
                      />
                    ))
                  ) : (
                    <p className="todo-empty">No {recurrence} tasks</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <TodoEditorPanel
        todo={selectedTodo}
        onClose={() => setSelectedTodo(null)}
        onSave={updateTodo}
      />
    </>
  );
}