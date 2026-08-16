'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Todo } from '../../../lib/types';
import SortableTaskList from '../../tasks/SortableTaskList';
import TaskItem, { TaskItemView } from '../../tasks/TaskItem';
import AddTodoListModal from './AddTodoListModal';
import { formatDue, getDueUrgency } from './dueDate';
import TodoModal from './TodoModal';
import { useTodoLists } from './useTodoLists';

const NEW_LIST_OPTION = '__new__';

type TodoModalState = { mode: 'add' } | { mode: 'edit'; todo: Todo };

function renderDueBadge(todo: Todo) {
  if (!todo.due) return undefined;
  return (
    <span className={`todo-item__due todo-item__due--${getDueUrgency(todo.due)}`}>
      {formatDue(todo.due)}
    </span>
  );
}

export default function TodoListWidget() {
  const {
    todoLists,
    isLoading,
    createList,
    addTodo,
    updateTodoStage,
    updateSubtaskStage,
    updateTodo,
    reorderTodos,
    reorderSubtasks,
  } = useTodoLists();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<TodoModalState | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isAddListOpen, setIsAddListOpen] = useState(false);

  const activeList = useMemo(() => {
    const found = todoLists.find((list) => list.id === selectedListId);
    return found ?? todoLists[0] ?? null;
  }, [todoLists, selectedListId]);

  const visibleTodos = useMemo(
    () => (activeList ? activeList.todos.filter((todo) => showCompleted || todo.stage !== 2) : []),
    [activeList, showCompleted]
  );

  return (
    <>
      <aside className="routine-panel-shell">
        <div className="routine-panel">
          <div className="routine-panel-header">
            {todoLists.length > 0 ? (
              <select
                className="todo-list-select"
                value={activeList?.id ?? ''}
                onChange={(event) => {
                  if (event.target.value === NEW_LIST_OPTION) {
                    setIsAddListOpen(true);
                    return;
                  }
                  setSelectedListId(event.target.value);
                }}
                aria-label="Select todo list"
              >
                {todoLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
                <option value={NEW_LIST_OPTION}>+ New list</option>
              </select>
            ) : (
              <h2>Todo List</h2>
            )}

            <div className="routine-panel-actions">
              {activeList && (
                <>
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
                    onClick={() => setModalState({ mode: 'add' })}
                    title="Add task"
                    aria-label="Add task"
                  >
                    <Plus size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="routine-sections">
            {!isLoading && (
              <div className="routine-list">
                {!activeList ? (
                  <div className="todo-list-empty">
                    <p className="routine-empty">No lists yet</p>
                    <button
                      type="button"
                      className="routine-add-button"
                      onClick={() => setIsAddListOpen(true)}
                      title="Create list"
                      aria-label="Create list"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : visibleTodos.length > 0 ? (
                  <SortableTaskList
                    ids={visibleTodos.map((todo) => todo.id)}
                    onReorder={(activeId, overId) =>
                      reorderTodos(
                        activeList.id,
                        (todo) => showCompleted || todo.stage !== 2,
                        activeId,
                        overId
                      )
                    }
                    renderOverlay={(activeId) => {
                      const todo = visibleTodos.find((t) => t.id === activeId);
                      return todo ? (
                        <TaskItemView
                          task={todo}
                          onToggle={(id) => updateTodoStage(activeList.id, id)}
                          onEdit={(todo) => setModalState({ mode: 'edit', todo })}
                          onToggleSubtask={(taskId, subtaskId) =>
                            updateSubtaskStage(activeList.id, taskId, subtaskId)
                          }
                          onReorderSubtasks={(taskId, activeId, overId) =>
                            reorderSubtasks(activeList.id, taskId, activeId, overId)
                          }
                          extra={renderDueBadge(todo)}
                          overlay
                        />
                      ) : null;
                    }}
                  >
                    {visibleTodos.map((todo) => (
                      <TaskItem
                        key={todo.id}
                        task={todo}
                        onToggle={(id) => updateTodoStage(activeList.id, id)}
                        onToggleSubtask={(taskId, subtaskId) =>
                          updateSubtaskStage(activeList.id, taskId, subtaskId)
                        }
                        onEdit={(todo) => setModalState({ mode: 'edit', todo })}
                        onReorderSubtasks={(taskId, activeId, overId) =>
                          reorderSubtasks(activeList.id, taskId, activeId, overId)
                        }
                        extra={renderDueBadge(todo)}
                      />
                    ))}
                  </SortableTaskList>
                ) : (
                  <p className="routine-empty">No tasks</p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <TodoModal
        key={modalState ? (modalState.mode === 'edit' ? modalState.todo.id : 'add') : 'idle'}
        isOpen={modalState !== null}
        todo={modalState?.mode === 'edit' ? modalState.todo : null}
        onClose={() => setModalState(null)}
        onSubmit={(todo) => {
          if (activeList) {
            if (modalState?.mode === 'edit') {
              updateTodo(activeList.id, todo);
            } else {
              addTodo(activeList.id, todo);
            }
          }
          setModalState(null);
        }}
      />

      <AddTodoListModal
        isOpen={isAddListOpen}
        onClose={() => setIsAddListOpen(false)}
        onCreate={(name) => setSelectedListId(createList(name))}
      />
    </>
  );
}
