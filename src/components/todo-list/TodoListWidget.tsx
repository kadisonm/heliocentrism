'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Todo } from '../../lib/types';
import TaskItem from '../tasks/TaskItem';
import AddTodoModal from './AddTodoModal';
import TodoEditorPanel from './TodoEditorPanel';
import { useTodos } from './useTodos';

export default function TodoListWidget() {
  const { todos, isLoading, updateTodoStage, updateSubtaskStage, updateTodo, addTodo } =
    useTodos();
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  const visibleTodos = useMemo(
    () => todos.filter((todo) => showCompleted || todo.stage !== 2),
    [todos, showCompleted]
  );

  return (
    <>
      <aside className="routine-panel-shell">
        <div className="routine-panel">
          <div className="routine-panel-header">
            <h2>Todo List</h2>

            <div className="routine-panel-actions">
              <button
                type="button"
                className="routine-show-toggle"
                onClick={() => setShowCompleted((current) => !current)}
                title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
                aria-label={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
              >
                {showCompleted ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              <button
                type="button"
                className="routine-add-button"
                onClick={() => setIsAddTaskOpen(true)}
                title="Add task"
                aria-label="Add task"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="routine-sections">
            {!isLoading && (
              <div className="routine-list">
                {visibleTodos.length > 0 ? (
                  visibleTodos.map((todo) => (
                    <TaskItem
                      key={todo.id}
                      task={todo}
                      onToggle={updateTodoStage}
                      onToggleSubtask={updateSubtaskStage}
                      onEdit={setSelectedTodo}
                      extra={
                        todo.due ? <p className="todo-item__due">Due {todo.due}</p> : undefined
                      }
                    />
                  ))
                ) : (
                  <p className="routine-empty">No tasks</p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <TodoEditorPanel
        key={selectedTodo?.id ?? 'no-selection'}
        todo={selectedTodo}
        onClose={() => setSelectedTodo(null)}
        onSave={(todo) => {
          updateTodo(todo);
          setSelectedTodo(null);
        }}
      />

      <AddTodoModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={addTodo}
      />
    </>
  );
}
