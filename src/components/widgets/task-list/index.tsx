'use client';

import { Calendar, Eye, EyeOff, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useWidgetContext } from '../../grid/widgetContext';
import { isTaskDone } from '../../../lib/taskCascade';
import { formatNextOccurrence, formatNextOccurrenceFull } from '../../../lib/taskRepeat';
import type { Subtask, Task, TaskList } from '../../../lib/types';
import Badge from '../../common/Badge';
import ConfirmDialog from '../../common/ConfirmDialog';
import FloatingToolbar, { type FloatingToolbarPosition } from '../../shared/tasks/FloatingToolbar';
import SortableTaskList from '../../shared/tasks/SortableTaskList';
import TaskItem, { TaskItemView } from '../../shared/tasks/TaskItem';
import AddTaskListModal from './AddTaskListModal';
import TaskDueModal from './TaskDueModal';
import { dueBadgeColor, formatDue, formatDueFull, getDueUrgency } from './dueDate';
import SubtaskModal from './SubtaskModal';
import TaskListSwitcher from './TaskListSwitcher';
import TaskModal from './TaskModal';
import TaskRepeatModal from './TaskRepeatModal';
import { useTaskLists } from './useTaskLists';

type TaskModalState = { mode: 'add' } | { mode: 'edit'; task: Task };
type SubtaskModalState = { taskId: string; subtask: Subtask | null }; // null = adding
// Drives AddTaskListModal — 'add' seeds the name field (e.g. from the
// switcher's search box), 'edit' pre-fills it from an existing list.
type ListModalState = { mode: 'add'; seedName: string } | { mode: 'edit'; list: TaskList };
// Which single task/subtask row currently has its floating toolbar open —
// click-driven, not hover. At most one at a time; both the task and
// subtask rows stopPropagation() on click so only a genuine outside click
// reaches the document-level listener that clears this. `position` is
// where the toolbar popup anchors (its bottom-left corner at the click).
type ActiveToolbar =
  | { type: 'task'; taskId: string; position: FloatingToolbarPosition }
  | { type: 'subtask'; taskId: string; subtaskId: string; position: FloatingToolbarPosition };

function renderDueBadge(task: Task, onClick: () => void) {
  if (!task.due) return undefined;
  return (
    <Badge
      icon={Calendar}
      title={formatDue(task.due)}
      ariaLabel={`Due ${formatDueFull(task.due)}`}
      color={dueBadgeColor(getDueUrgency(task.due))}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderRepeatBadge(task: Task, onClick: () => void) {
  if (!task.repeat) return undefined;
  return (
    <Badge
      icon={RefreshCw}
      title={formatNextOccurrence(task.repeat)}
      ariaLabel={`Repeats ${formatNextOccurrenceFull(task.repeat)}`}
      color="muted"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderSubtaskDueBadge(subtask: Subtask) {
  if (!subtask.due) return undefined;
  return (
    <Badge
      icon={Calendar}
      title={formatDue(subtask.due)}
      ariaLabel={`Due ${formatDueFull(subtask.due)}`}
      color={dueBadgeColor(getDueUrgency(subtask.due))}
    />
  );
}

// Read-only counterpart to renderRepeatBadge — no onClick, so Badge renders
// a plain span rather than a button. Editing a subtask's repeat happens
// through its own toolbar's Edit button (opens SubtaskModal), not by
// clicking this badge.
function renderSubtaskRepeatBadge(subtask: Subtask) {
  if (!subtask.repeat) return undefined;
  return (
    <Badge
      icon={RefreshCw}
      title={formatNextOccurrence(subtask.repeat)}
      ariaLabel={`Repeats ${formatNextOccurrenceFull(subtask.repeat)}`}
      color="muted"
    />
  );
}

function renderSubtaskExtra(subtask: Subtask) {
  return (
    <>
      {renderSubtaskRepeatBadge(subtask)}
      {renderSubtaskDueBadge(subtask)}
    </>
  );
}

export default function TaskListWidget() {
  const {
    taskLists,
    isLoading,
    createList,
    renameList,
    deleteList,
    addTask,
    updateTaskStage,
    updateSubtaskStage,
    updateTask,
    deleteTask,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    reorderTasks,
    reorderSubtasks,
  } = useTaskLists();
  const { widget, onUpdate } = useWidgetContext();
  const selectedListId = widget.selectedListId;
  const [modalState, setModalState] = useState<TaskModalState | null>(null);
  const [repeatModalTask, setRepeatModalTask] = useState<Task | null>(null);
  const [dueModalTask, setDueModalTask] = useState<Task | null>(null);
  const [subtaskModalState, setSubtaskModalState] = useState<SubtaskModalState | null>(null);
  const [activeToolbar, setActiveToolbar] = useState<ActiveToolbar | null>(null);
  const [listPendingDelete, setListPendingDelete] = useState<TaskList | null>(null);
  const showCompleted = widget.showCompleted ?? false;
  const [listModalState, setListModalState] = useState<ListModalState | null>(null);

  // A click anywhere NOT inside a task/subtask row or the floating toolbar
  // itself is an "outside" click — close whatever toolbar is open. Uses
  // DOM containment (event.target.closest(...)) rather than relying on
  // each row's onClick calling stopPropagation() to prevent this listener
  // from ever seeing an "inside" click — dnd-kit's own PointerSensor
  // registers its own document-level click listener for its internal
  // press/tap handling, and empirically that interaction meant
  // stopPropagation() alone did not reliably keep a same-click "inside"
  // event from also reaching this one. Containment-checking here sidesteps
  // that entirely, regardless of the exact propagation-order cause.
  useEffect(() => {
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.task-item, .subtask, .floating-toolbar')) return;
      setActiveToolbar(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const toggleTaskToolbar = (taskId: string, position: FloatingToolbarPosition) => {
    setActiveToolbar((current) =>
      current?.type === 'task' && current.taskId === taskId ? null : { type: 'task', taskId, position }
    );
  };

  const toggleSubtaskToolbar = (taskId: string, subtaskId: string, position: FloatingToolbarPosition) => {
    setActiveToolbar((current) =>
      current?.type === 'subtask' && current.taskId === taskId && current.subtaskId === subtaskId
        ? null
        : { type: 'subtask', taskId, subtaskId, position }
    );
  };

  const activeList = useMemo(() => {
    const found = taskLists.find((list) => list.id === selectedListId);
    return found ?? taskLists[0] ?? null;
  }, [taskLists, selectedListId]);

  const visibleTasks = useMemo(
    () => (activeList ? activeList.tasks.filter((task) => showCompleted || !isTaskDone(task)) : []),
    [activeList, showCompleted]
  );

  // The one floating toolbar popup — its buttons depend on whether a task
  // or a subtask is active, looked up fresh from activeList by id (rather
  // than storing the object itself) so it never goes stale.
  function renderActiveToolbar() {
    if (!activeToolbar || !activeList) return null;
    const activeTask = activeList.tasks.find((t) => t.id === activeToolbar.taskId);
    if (!activeTask) return null;

    if (activeToolbar.type === 'task') {
      return (
        <FloatingToolbar position={activeToolbar.position}>
          <button
            type="button"
            className="task-item__toolbar-button"
            onClick={() => {
              setSubtaskModalState({ taskId: activeTask.id, subtask: null });
              setActiveToolbar(null);
            }}
            title="Add subtask"
            aria-label={`Add subtask to ${activeTask.title}`}
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            className="task-item__toolbar-button"
            onClick={() => {
              setModalState({ mode: 'edit', task: activeTask });
              setActiveToolbar(null);
            }}
            title="Edit"
            aria-label={`Edit ${activeTask.title}`}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="task-item__toolbar-button task-item__toolbar-button--danger"
            onClick={() => {
              deleteTask(activeList.id, activeTask.id);
              setActiveToolbar(null);
            }}
            title="Delete"
            aria-label={`Delete ${activeTask.title}`}
          >
            <Trash2 size={13} />
          </button>
        </FloatingToolbar>
      );
    }

    const activeSubtask = activeTask.subtasks.find((s) => s.id === activeToolbar.subtaskId);
    if (!activeSubtask) return null;

    return (
      <FloatingToolbar position={activeToolbar.position}>
        <button
          type="button"
          className="task-item__toolbar-button"
          onClick={() => {
            setSubtaskModalState({ taskId: activeTask.id, subtask: activeSubtask });
            setActiveToolbar(null);
          }}
          title="Edit"
          aria-label={`Edit ${activeSubtask.title}`}
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          className="task-item__toolbar-button task-item__toolbar-button--danger"
          onClick={() => {
            deleteSubtask(activeList.id, activeTask.id, activeSubtask.id);
            setActiveToolbar(null);
          }}
          title="Delete"
          aria-label={`Delete ${activeSubtask.title}`}
        >
          <Trash2 size={12} />
        </button>
      </FloatingToolbar>
    );
  }

  return (
    <>
      <aside className="widget-content-shell">
        <div className="widget-content">
          <div className="widget-content-header">
            {taskLists.length > 0 ? (
              <TaskListSwitcher
                lists={taskLists}
                activeList={activeList}
                onSelect={(id) => onUpdate({ selectedListId: id })}
                onRequestDelete={setListPendingDelete}
                onRequestCreate={(name) => setListModalState({ mode: 'add', seedName: name })}
                onRequestEdit={(list) => setListModalState({ mode: 'edit', list })}
              />
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
                      onClick={() => setListModalState({ mode: 'add', seedName: '' })}
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
                          onToggleSubtask={(taskId, subtaskId) =>
                            updateSubtaskStage(activeList.id, taskId, subtaskId)
                          }
                          onReorderSubtasks={(taskId, activeId, overId) =>
                            reorderSubtasks(activeList.id, taskId, activeId, overId)
                          }
                          extra={
                            <>
                              {renderRepeatBadge(task, () => setRepeatModalTask(task))}
                              {renderDueBadge(task, () => setDueModalTask(task))}
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
                        onReorderSubtasks={(taskId, activeId, overId) =>
                          reorderSubtasks(activeList.id, taskId, activeId, overId)
                        }
                        isActive={activeToolbar?.type === 'task' && activeToolbar.taskId === task.id}
                        onRowClick={(position) => toggleTaskToolbar(task.id, position)}
                        activeSubtaskId={
                          activeToolbar?.type === 'subtask' && activeToolbar.taskId === task.id
                            ? activeToolbar.subtaskId
                            : null
                        }
                        onSubtaskRowClick={(subtaskId, position) =>
                          toggleSubtaskToolbar(task.id, subtaskId, position)
                        }
                        extra={
                          <>
                            {renderRepeatBadge(task, () => setRepeatModalTask(task))}
                            {renderDueBadge(task, () => setDueModalTask(task))}
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
        key={`list-${listModalState ? (listModalState.mode === 'edit' ? listModalState.list.id : `add-${listModalState.seedName}`) : 'idle'}`}
        isOpen={listModalState !== null}
        list={listModalState?.mode === 'edit' ? listModalState.list : null}
        initialName={listModalState?.mode === 'add' ? listModalState.seedName : ''}
        onClose={() => setListModalState(null)}
        onSubmit={(name) => {
          if (listModalState?.mode === 'edit') {
            renameList(listModalState.list.id, name);
          } else {
            onUpdate({ selectedListId: createList(name) });
          }
          setListModalState(null);
        }}
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

      <TaskDueModal
        key={`due-${dueModalTask?.id ?? 'idle'}`}
        isOpen={dueModalTask !== null}
        task={dueModalTask}
        onClose={() => setDueModalTask(null)}
        onSubmit={(task) => {
          if (activeList) updateTask(activeList.id, task);
          setDueModalTask(null);
        }}
      />

      <SubtaskModal
        key={`subtask-${subtaskModalState ? (subtaskModalState.subtask?.id ?? 'add') : 'idle'}`}
        isOpen={subtaskModalState !== null}
        subtask={subtaskModalState?.subtask ?? null}
        onClose={() => setSubtaskModalState(null)}
        onSubmit={(values) => {
          if (activeList && subtaskModalState) {
            if (subtaskModalState.subtask) {
              updateSubtask(activeList.id, subtaskModalState.taskId, subtaskModalState.subtask.id, values);
            } else {
              addSubtask(activeList.id, subtaskModalState.taskId, values);
            }
          }
          setSubtaskModalState(null);
        }}
      />

      {renderActiveToolbar()}

      <ConfirmDialog
        isOpen={listPendingDelete !== null}
        title="Delete list?"
        message={`Delete "${listPendingDelete?.name}" and all its tasks? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (listPendingDelete) deleteList(listPendingDelete.id);
          setListPendingDelete(null);
        }}
        onCancel={() => setListPendingDelete(null)}
      />
    </>
  );
}
