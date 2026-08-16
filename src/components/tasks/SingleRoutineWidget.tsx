'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RecurrenceValue, Todo } from '../../lib/types';
import AddTaskModal from './AddTaskModal';
import TodoEditorPanel from './TodoEditorPanel';
import TodoSection from './TodoSection';
import { useTodos } from './useTodos';

type SingleRoutineWidgetProps = {
  title: string;
  recurrence: RecurrenceValue;
};

export default function SingleRoutineWidget({ title, recurrence }: SingleRoutineWidgetProps) {
  const { todos, isLoading, updateTodoStage, updateTodo, addTodo } = useTodos();
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  const sectionTodos = useMemo(
    () =>
      todos.filter(
        (todo) => todo.recurrence === recurrence && (showCompleted || todo.stage !== 2)
      ),
    [todos, recurrence, showCompleted]
  );

  return (
    <>
      <aside className="routine-panel-shell">
        <div className="routine-panel">
          <div className="routine-panel-header">
            <h2>{title}</h2>

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
              <TodoSection
                recurrence={recurrence}
                todos={sectionTodos}
                onToggle={updateTodoStage}
                onEdit={setSelectedTodo}
              />
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

      <AddTaskModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onAdd={addTodo}
        fixedRecurrence={recurrence}
      />
    </>
  );
}
