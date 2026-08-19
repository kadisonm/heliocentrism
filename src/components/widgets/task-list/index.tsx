'use client';

import { Clock, Eye, EyeOff, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWidgetContext } from '../../grid/widgetContext';
import { isTaskDone } from '../../../lib/taskCascade';
import { formatNextOccurrence } from '../../../lib/taskRepeat';
import type { Subtask, Task } from '../../../lib/types';
import SortableTaskList from '../../shared/tasks/SortableTaskList';
import TaskItem, { TaskItemView } from '../../shared/tasks/TaskItem';
import AddTaskListModal from './AddTaskListModal';
import { formatDue, getDueUrgency } from './dueDate';
import TaskModal from './TaskModal';
import TaskRepeatModal from './TaskRepeatModal';
import { useTaskLists } from './useTaskLists';

const NEW_LIST_OPTION = '__new__';

type TaskModalState = { mode: 'add' } | { mode: 'edit'; task: Task };

function renderDueBadge(task: Task) {
  if (!task.due) return undefined;
  return (
    <span className={`task-item__due task-item__due--${getDueUrgency(task.due)}`}>
      {formatDue(task.due)}
    </span>
  );
}

function renderRepeatBadge(task: Task, onClick: () => void) {
  if (!task.repeat) return undefined;
  return (
    <button
      type="button"
      className="task-item__repeat"
      onClick={onClick}
      title="Edit repeat"
      aria-label={`Edit repeat schedule for ${task.title}`}
    >
      <Clock size={13} />
      {formatNextOccurrence(task.repeat)}
    </button>
  );
}

function renderSubtaskDueBadge(subtask: Subtask) {
  if (!subtask.due) return undefined;
  return (
    <span className={`task-item__due task-item__due--${getDueUrgency(subtask.due)}`}>
      {formatDue(subtask.due)}
    </span>
  );
}

// Read-only counterpart to renderRepeatBadge — subtasks have no edit
// affordance on the live board yet (that arrives with the Task Toolbar
// phase), so this is a plain span, not a clickable button.
function renderSubtaskRepeatBadge(subtask: Subtask) {
  if (!subtask.repeat) return undefined;
  return (
    <span className="task-item__repeat task-item__repeat--static">
      <Clock size={13} />
      {formatNextOccurrence(subtask.repeat)}
    </span>
  );
}

function renderSubtaskExtra(subtask: Subtask) {
  return (
    <>
      {renderSubtaskDueBadge(subtask)}
      {renderSubtaskRepeatBadge(subtask)}
    </>
  );
}

export default function TaskListWidget() {
  const {
    taskLists,
    isLoading,
    createList,
    addTask,
    updateTaskStage,
    updateSubtaskStage,
    updateTask,
    deleteTask,
    reorderTasks,
    reorderSubtasks,
  } = useTaskLists();
  const { widget, onUpdate } = useWidgetContext();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<TaskModalState | null>(null);
  const [repeatModalTask, setRepeatModalTask] = useState<Task | null>(null);
  const showCompleted = widget.showCompleted ?? false;
  const [isAddListOpen, setIsAddListOpen] = useState(false);

  const activeList = useMemo(() => {
    const found = taskLists.find((list) => list.id === selectedListId);
    return found ?? taskLists[0] ?? null;
  }, [taskLists, selectedListId]);

  const visibleTasks = useMemo(
    () => (activeList ? activeList.tasks.filter((task) => showCompleted || !isTaskDone(task)) : []),
    [activeList, showCompleted]
  );

  return (
    <>
      <aside className="widget-content-shell">
        <div className="widget-content">
          <div className="widget-content-header">
            {taskLists.length > 0 ? (
              <select
                className="task-list-select"
                value={activeList?.id ?? ''}
                onChange={(event) => {
                  if (event.target.value === NEW_LIST_OPTION) {
                    setIsAddListOpen(true);
                    return;
                  }
                  setSelectedListId(event.target.value);
                }}
                aria-label="Select task list"
              >
                {taskLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
                <option value={NEW_LIST_OPTION}>+ New list</option>
              </select>
            ) : (
              <h2>Task List</h2>
            )}

            <div className="widget-content-actions">
              {activeList && (
                <>
                  <button
                    type="button"
                    className="widget-show-toggle"
                    onClick={() => onUpdate({ showCompleted: !showCompleted })}
                    title={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
                    aria-label={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
                  >
                    {showCompleted ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>

                  <button
                    type="button"
                    className="widget-add-button"
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

          <div className="widget-sections">
            {!isLoading && (
              <div className="widget-list">
                {!activeList ? (
                  <div className="task-list-empty">
                    <p className="widget-empty">No lists yet</p>
                    <button
                      type="button"
                      className="widget-add-button"
                      onClick={() => setIsAddListOpen(true)}
                      title="Create list"
                      aria-label="Create list"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : visibleTasks.length > 0 ? (
                  <SortableTaskList
                    ids={visibleTasks.map((task) => task.id)}
                    onReorder={(activeId, overId) =>
                      reorderTasks(
                        activeList.id,
                        (task) => showCompleted || !isTaskDone(task),
                        activeId,
                        overId
                      )
                    }
                    renderOverlay={(activeId) => {
                      const task = visibleTasks.find((t) => t.id === activeId);
                      return task ? (
                        <TaskItemView
                          task={task}
                          onToggle={(id) => updateTaskStage(activeList.id, id)}
                          onEdit={(task) => setModalState({ mode: 'edit', task })}
                          onDelete={(id) => deleteTask(activeList.id, id)}
                          onToggleSubtask={(taskId, subtaskId) =>
                            updateSubtaskStage(activeList.id, taskId, subtaskId)
                          }
                          onReorderSubtasks={(taskId, activeId, overId) =>
                            reorderSubtasks(activeList.id, taskId, activeId, overId)
                          }
                          extra={
                            <>
                              {renderDueBadge(task)}
                              {renderRepeatBadge(task, () => setRepeatModalTask(task))}
                            </>
                          }
                          renderSubtaskExtra={renderSubtaskExtra}
                          overlay
                        />
                      ) : null;
                    }}
                  >
                    {visibleTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={(id) => updateTaskStage(activeList.id, id)}
                        onToggleSubtask={(taskId, subtaskId) =>
                          updateSubtaskStage(activeList.id, taskId, subtaskId)
                        }
                        onEdit={(task) => setModalState({ mode: 'edit', task })}
                        onDelete={(id) => deleteTask(activeList.id, id)}
                        onReorderSubtasks={(taskId, activeId, overId) =>
                          reorderSubtasks(activeList.id, taskId, activeId, overId)
                        }
                        extra={
                          <>
                            {renderDueBadge(task)}
                            {renderRepeatBadge(task, () => setRepeatModalTask(task))}
                          </>
                        }
                        renderSubtaskExtra={renderSubtaskExtra}
                      />
                    ))}
                  </SortableTaskList>
                ) : (
                  <p className="widget-empty">No tasks</p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <TaskModal
        key={`task-${modalState ? (modalState.mode === 'edit' ? modalState.task.id : 'add') : 'idle'}`}
        isOpen={modalState !== null}
        task={modalState?.mode === 'edit' ? modalState.task : null}
        onClose={() => setModalState(null)}
        onSubmit={(task) => {
          if (activeList) {
            if (modalState?.mode === 'edit') {
              updateTask(activeList.id, task);
            } else {
              addTask(activeList.id, task);
            }
          }
          setModalState(null);
        }}
      />

      <AddTaskListModal
        isOpen={isAddListOpen}
        onClose={() => setIsAddListOpen(false)}
        onCreate={(name) => setSelectedListId(createList(name))}
      />

      <TaskRepeatModal
        key={`repeat-${repeatModalTask?.id ?? 'idle'}`}
        isOpen={repeatModalTask !== null}
        task={repeatModalTask}
        onClose={() => setRepeatModalTask(null)}
        onSubmit={(task) => {
          if (activeList) updateTask(activeList.id, task);
          setRepeatModalTask(null);
        }}
      />
    </>
  );
}
