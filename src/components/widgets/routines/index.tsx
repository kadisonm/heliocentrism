'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RecurrenceValue, Todo } from '../../../lib/types';
import AddTaskModal from '../../tasks/AddTaskModal';
import TodoEditorPanel from '../../tasks/TodoEditorPanel';
import TodoSection from '../../tasks/TodoSection';
import { useTodos } from '../../tasks/useTodos';

const recurrenceOrder: RecurrenceValue[] = ['daily', 'weekly', 'monthly'];

export default function RoutinesWidget() {
  const { todos, isLoading, updateTodoStage, updateTodo, addTodo } = useTodos();
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  const visibleTodos = useMemo(
    () => (showCompleted ? todos : todos.filter((todo) => todo.stage !== 2)),
    [showCompleted, todos]
  );

  const groupedTodos = useMemo(
    () =>
      recurrenceOrder.reduce(
        (acc, key) => {
          acc[key] = visibleTodos.filter((todo) => todo.recurrence === key);
          return acc;
        },
        { daily: [], weekly: [], monthly: [] } as Record<RecurrenceValue, Todo[]>
      ),
    [visibleTodos]
  );

  return (
    <>
      <aside className="routine-panel-shell">
        <div className="routine-panel">
          <div className="routine-panel-header">
            <h2>Routines</h2>

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
            {!isLoading &&
              recurrenceOrder.map((recurrence) => (
                <TodoSection
                  key={recurrence}
                  recurrence={recurrence}
                  todos={groupedTodos[recurrence]}
                  onToggle={updateTodoStage}
                  onEdit={setSelectedTodo}
                />
              ))}
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
      />
    </>
  );
}
