'use client';

import { useState } from 'react';
import TodoItem from './TodoItem';

export type TodoStage = 0 | 1 | 2;

export type Todo = {
  title: string;
  due: string;
  stage: TodoStage;
};

const statusLabels = ['To do', 'In progress', 'Done'] as const;

const initialTodos: Todo[] = [
  { title: 'Finalize dashboard layout', due: 'Today', stage: 0 },
  { title: 'Review onboarding checklist', due: 'Tomorrow', stage: 1 },
  { title: 'Prepare weekly summary', due: 'Fri', stage: 2 },
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

  return (
    <aside className="todo-panel-shell">
      <div className="todo-panel">
        <div className="todo-panel-header">
          <h2>To do</h2>
          <button type="button" className="todo-add-button">
            + Add
          </button>
        </div>

        <div className="todo-list">
          {todos.map((todo) => (
            <TodoItem
              key={todo.title}
              todo={todo}
              onToggle={updateTodoStage}
              statusLabel={statusLabels[todo.stage]}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}