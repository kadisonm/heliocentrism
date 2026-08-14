'use client';

import { useMemo, useState } from 'react';
import TodoItem from './TodoItem';

export type TodoStage = 0 | 1 | 2;
export type Recurrence = 'daily' | 'weekly' | 'monthly';

export type Todo = {
  title: string;
  due: string;
  stage: TodoStage;
  recurrence: Recurrence;
};

const statusLabels = ['To do', 'In progress', 'Done'] as const;
const recurrenceOrder: Recurrence[] = ['daily', 'weekly', 'monthly'];

const initialTodos: Todo[] = [
  { title: 'Finalize dashboard layout', due: 'Today', stage: 0, recurrence: 'daily' },
  { title: 'Review onboarding checklist', due: 'Tomorrow', stage: 1, recurrence: 'weekly' },
  { title: 'Prepare weekly summary', due: 'Fri', stage: 2, recurrence: 'monthly' },
  { title: 'Inbox cleanup', due: 'Everyday', stage: 0, recurrence: 'daily' },
  { title: 'KPI check-in', due: 'Every week', stage: 1, recurrence: 'weekly' },
  { title: 'Quarter review', due: 'Every month', stage: 0, recurrence: 'monthly' },
];

function getNextStage(stage: TodoStage): TodoStage {
  return ((stage + 1) % 3) as TodoStage;
}

export default function TodoPanel() {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);

  const updateTodoStage = (targetTitle: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.title === targetTitle ? { ...todo, stage: getNextStage(todo.stage) } : todo
      )
    );
  };

  const updateTodoRecurrence = (targetTitle: string, recurrence: Recurrence) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.title === targetTitle ? { ...todo, recurrence } : todo
      )
    );
  };

  const groupedTodos = useMemo(
    () =>
      recurrenceOrder.reduce(
        (acc, key) => {
          acc[key] = todos.filter((todo) => todo.recurrence === key);
          return acc;
        },
        { daily: [], weekly: [], monthly: [] } as Record<Recurrence, Todo[]>
      ),
    [todos]
  );

  return (
    <aside className="todo-panel-shell">
      <div className="todo-panel">
        <div className="todo-panel-header">
          <h2>To do</h2>
          <button type="button" className="todo-add-button">
            + Add
          </button>
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
                      key={todo.title}
                      todo={todo}
                      onToggle={updateTodoStage}
                      onRecurrenceChange={updateTodoRecurrence}
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
  );
}