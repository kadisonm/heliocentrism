'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TASKS } from '../../lib/data';
import {
  writeTasksToSyncFolder,
  readTasksFromSyncFolder,
} from '../../lib/fileSystemSync';
import type { Todo, TodoStage, RecurrenceValue } from '../../lib/types';
import TodoEditorPanel from './TodoEditorPanel';
import Task from '../Tasks';

const statusLabels = ['To do', 'In progress', 'Done'] as const;
const recurrenceOrder: RecurrenceValue[] = ['daily', 'weekly', 'monthly'];

function getNextStage(stage: TodoStage): TodoStage {
  return ((stage + 1) % 3) as TodoStage;
}

export default function RecurringTasks() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);

  // Load tasks on component mount
  useEffect(() => {
    const loadTasks = async () => {
      // Try to load from sync folder first
      const syncFolderTasks = await readTasksFromSyncFolder();
      if (syncFolderTasks) {
        setTodos(syncFolderTasks);
      } else {
        // Use default tasks
        setTodos(DEFAULT_TASKS);
      }
      setIsLoading(false);
    };

    loadTasks();
  }, []);

  // Save tasks to sync folder
  useEffect(() => {
    if (!isLoading && todos.length > 0) {
      writeTasksToSyncFolder(todos);
    }
  }, [todos, isLoading]);

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
        { daily: [], weekly: [], monthly: [] } as Record<RecurrenceValue, Todo[]>
      ),
    [visibleTodos]
  );

  return (
    <>
      <aside className="recurring-panel-shell">
        <div className="recurring-panel">
          <div className="recurring-panel-header">
            <h2>To do</h2>

            <div className="recurring-panel-actions">
              <button
                type="button"
                className="recurring-show-toggle"
                onClick={() => setShowCompleted((current) => !current)}
              >
                {showCompleted ? 'Hide complete' : 'Show complete'}
              </button>

              <button type="button" className="recurring-add-button">
                + Add
              </button>
            </div>
          </div>

          <div className="recurring-sections">
            {recurrenceOrder.map((recurrence) => (
              <div key={recurrence} className="recurring-section">
                <div className="recurring-section__header">
                  <h3>{recurrence}</h3>
                </div>

                <div className="recurring-list">
                  {groupedTodos[recurrence].length > 0 ? (
                    groupedTodos[recurrence].map((todo) => (
                      <Task
                        key={todo.id}
                        todo={todo}
                        onToggle={updateTodoStage}
                        onEdit={setSelectedTodo}
                        statusLabel={statusLabels[todo.stage]}
                      />
                    ))
                  ) : (
                    <p className="recurring-empty">No {recurrence} tasks</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <TodoEditorPanel
        key={selectedTodo?.id ?? 'no-selection'}
        todo={selectedTodo}
        onClose={() => setSelectedTodo(null)}
        onSave={updateTodo}
      />
    </>
  );
}
