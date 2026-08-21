'use client';

import { Calendar, Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useWidgetContext } from '../../grid/widgetContext';
import { clampTaskStages, isTaskDone } from '../../../lib/taskCascade';
import { formatNextOccurrence, formatNextOccurrenceFull } from '../../../lib/taskRepeat';
import type { Subtask, Task, TaskList } from '../../../lib/types';
import Badge from '../../common/Badge';
import ConfirmDialog from '../../common/ConfirmDialog';
import ContextMenu, { type ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import MenuItem from '../../common/context-menu/MenuItem';
import SortableTaskList from '../../shared/tasks/SortableTaskList';
import TaskItem, { TaskItemView } from '../../shared/tasks/TaskItem';
import AddTaskListModal from './AddTaskListModal';
import TaskDueModal from './TaskDueModal';
import { dueBadgeColor, formatDue, formatDueFull, getDueUrgency } from './dueDate';
import SubtaskModal from './SubtaskModal';
import TaskListSwitcher from './TaskListSwitcher';
import TaskModal from './TaskModal';
import TaskRepeatModal from './TaskRepeatModal';
import TaskStagesModal from './TaskStagesModal';
import { useTaskLists } from './useTaskLists';

// Which task or subtask a repeat/due quick-edit modal is currently open
// for — shared by both TaskRepeatModal and TaskDueModal, which work on a
// plain value rather than a Task, so this is what routes their onSubmit to
// updateTask vs updateSubtask.
type EditTarget = { type: 'task'; task: Task } | { type: 'subtask'; taskId: string; subtask: Subtask };

function editTargetId(target: EditTarget): string {
  return target.type === 'task' ? target.task.id : target.subtask.id;
}
// Drives AddTaskListModal — 'add' seeds the name field (e.g. from the
// switcher's search box), 'edit' pre-fills it from an existing list.
type ListModalState = { mode: 'add'; seedName: string } | { mode: 'edit'; list: TaskList };
// Which single task/subtask row currently has its "..." context menu
// open — click-driven (the row's hover-revealed menu button), not hover
// itself. At most one at a time; both the task and subtask rows
// stopPropagation() on click so only a genuine outside click reaches the
// document-level listener that clears this. `position` is where the menu
// anchors (its top-left corner at the click).
type ActiveMenu =
  | { type: 'task'; taskId: string; position: ContextMenuPosition }
  | { type: 'subtask'; taskId: string; subtaskId: string; position: ContextMenuPosition };

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

function renderSubtaskDueBadge(subtask: Subtask, onClick: () => void) {
  if (!subtask.due) return undefined;
  return (
    <Badge
      icon={Calendar}
      title={formatDue(subtask.due)}
      ariaLabel={`Due ${formatDueFull(subtask.due)}`}
      color={dueBadgeColor(getDueUrgency(subtask.due))}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderSubtaskRepeatBadge(subtask: Subtask, onClick: () => void) {
  if (!subtask.repeat) return undefined;
  return (
    <Badge
      icon={RefreshCw}
      title={formatNextOccurrence(subtask.repeat)}
      ariaLabel={`Repeats ${formatNextOccurrenceFull(subtask.repeat)}`}
      color="muted"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderSubtaskExtra(
  subtask: Subtask,
  taskId: string,
  onEditRepeat: (target: EditTarget) => void,
  onEditDue: (target: EditTarget) => void
) {
  return (
    <>
      {renderSubtaskRepeatBadge(subtask, () => onEditRepeat({ type: 'subtask', taskId, subtask }))}
      {renderSubtaskDueBadge(subtask, () => onEditDue({ type: 'subtask', taskId, subtask }))}
    </>
  );
}

// "Set due date"/"Set repeat" placeholders — only ever passed as
// `hoverExtra`/`renderSubtaskHoverExtra`, which TaskItem only mounts while
// the row is hovered, so these never render for a task/subtask that
// already has the field set.
function renderSetDueBadge(onClick: () => void) {
  return (
    <Badge
      icon={Calendar}
      title="Set due date"
      ariaLabel="Set due date"
      className="badge--ghost"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderSetRepeatBadge(onClick: () => void) {
  return (
    <Badge
      icon={RefreshCw}
      title="Set repeat"
      ariaLabel="Set repeat"
      className="badge--ghost"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderTaskHoverExtra(
  task: Task,
  onEditRepeat: (target: EditTarget) => void,
  onEditDue: (target: EditTarget) => void
) {
  return (
    <>
      {!task.repeat && renderSetRepeatBadge(() => onEditRepeat({ type: 'task', task }))}
      {!task.due && renderSetDueBadge(() => onEditDue({ type: 'task', task }))}
    </>
  );
}

function renderSubtaskHoverExtra(
  subtask: Subtask,
  taskId: string,
  onEditRepeat: (target: EditTarget) => void,
  onEditDue: (target: EditTarget) => void
) {
  return (
    <>
      {!subtask.repeat && renderSetRepeatBadge(() => onEditRepeat({ type: 'subtask', taskId, subtask }))}
      {!subtask.due && renderSetDueBadge(() => onEditDue({ type: 'subtask', taskId, subtask }))}
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
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [repeatTarget, setRepeatTarget] = useState<EditTarget | null>(null);
  const [dueTarget, setDueTarget] = useState<EditTarget | null>(null);
  // Task-only (see TaskItem.tsx's onEditStages) — subtasks share their
  // parent's `stages` array, so there's no subtask variant of this target.
  const [stagesTarget, setStagesTarget] = useState<Task | null>(null);
  // Which task the "Add subtask" menu item is currently adding to — null
  // means the modal is closed. Add-only (see SubtaskModal.tsx); editing
  // an existing subtask's title/description happens inline now, and
  // due/repeat each have their own badge.
  const [subtaskModalTaskId, setSubtaskModalTaskId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu | null>(null);
  const [listPendingDelete, setListPendingDelete] = useState<TaskList | null>(null);
  const showCompleted = widget.showCompleted ?? false;
  const [listModalState, setListModalState] = useState<ListModalState | null>(null);

  // A click anywhere NOT inside a task/subtask row or the context menu
  // itself is an "outside" click — close whatever menu is open. Uses DOM
  // containment (event.target.closest(...)) rather than relying on each
  // row's onClick calling stopPropagation() to prevent this listener from
  // ever seeing an "inside" click — dnd-kit's own PointerSensor registers
  // its own document-level click listener for its internal press/tap
  // handling, and empirically that interaction meant stopPropagation()
  // alone did not reliably keep a same-click "inside" event from also
  // reaching this one. Containment-checking here sidesteps that entirely,
  // regardless of the exact propagation-order cause.
  useEffect(() => {
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.task-item, .subtask, .context-menu')) return;
      setActiveMenu(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const toggleTaskMenu = (taskId: string, position: ContextMenuPosition) => {
    setActiveMenu((current) =>
      current?.type === 'task' && current.taskId === taskId ? null : { type: 'task', taskId, position }
    );
  };

  const toggleSubtaskMenu = (taskId: string, subtaskId: string, position: ContextMenuPosition) => {
    setActiveMenu((current) =>
      current?.type === 'subtask' && current.taskId === taskId && current.subtaskId === subtaskId
        ? null
        : { type: 'subtask', taskId, subtaskId, position }
    );
  };

  const activeList = useMemo(() => {
    const found = taskLists.find((list) => list.id === selectedListId);
    return found ?? taskLists[0] ?? null;
  }, [taskLists, selectedListId]);

  // "Hide completed" applies at both levels: a done task drops out
  // entirely, and a not-done task keeps its own done subtasks hidden too
  // — each task object here is otherwise passed straight through to
  // TaskItem, so filtering `subtasks` here is what actually keeps them
  // out of the rendered list (and the drag-reorder id set, which is
  // derived from these same `subtasks` arrays inside TaskItem).
  const visibleTasks = useMemo(() => {
    if (!activeList) return [];
    const tasks = activeList.tasks.filter((task) => showCompleted || !isTaskDone(task));
    if (showCompleted) return tasks;
    return tasks.map((task) => ({
      ...task,
      subtasks: task.subtasks.filter((subtask) => !isTaskDone({ stage: subtask.stage, stages: task.stages })),
    }));
  }, [activeList, showCompleted]);

  // The one "..." context menu popup — its items depend on whether a task
  // or a subtask is active, looked up fresh from activeList by id (rather
  // than storing the object itself) so it never goes stale. Opened by the
  // hover-revealed menu button on each row (see task-item__menu-button in
  // TaskItem.tsx) — Edit isn't offered here since title/description edit
  // inline now, and stage/due/repeat each already have their own badge.
  function renderActiveMenu() {
    if (!activeMenu || !activeList) return null;
    const activeTask = activeList.tasks.find((t) => t.id === activeMenu.taskId);
    if (!activeTask) return null;

    if (activeMenu.type === 'task') {
      return (
        <ContextMenu position={activeMenu.position}>
          <MenuItem
            icon={Plus}
            label="Add subtask"
            onClick={() => {
              setSubtaskModalTaskId(activeTask.id);
              setActiveMenu(null);
            }}
          />
          <MenuItem
            icon={Trash2}
            label="Delete task"
            color="error"
            onClick={() => {
              deleteTask(activeList.id, activeTask.id);
              setActiveMenu(null);
            }}
          />
        </ContextMenu>
      );
    }

    const activeSubtask = activeTask.subtasks.find((s) => s.id === activeMenu.subtaskId);
    if (!activeSubtask) return null;

    return (
      <ContextMenu position={activeMenu.position}>
        <MenuItem
          icon={Trash2}
          label="Delete subtask"
          color="error"
          onClick={() => {
            deleteSubtask(activeList.id, activeTask.id, activeSubtask.id);
            setActiveMenu(null);
          }}
        />
      </ContextMenu>
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
                    onClick={() => setIsTaskModalOpen(true)}
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
                          onEditStages={setStagesTarget}
                          extra={
                            <>
                              {renderRepeatBadge(task, () => setRepeatTarget({ type: 'task', task }))}
                              {renderDueBadge(task, () => setDueTarget({ type: 'task', task }))}
                            </>
                          }
                          renderSubtaskExtra={(subtask) =>
                            renderSubtaskExtra(subtask, task.id, setRepeatTarget, setDueTarget)
                          }
                          hoverExtra={renderTaskHoverExtra(task, setRepeatTarget, setDueTarget)}
                          renderSubtaskHoverExtra={(subtask) =>
                            renderSubtaskHoverExtra(subtask, task.id, setRepeatTarget, setDueTarget)
                          }
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
                        isActive={activeMenu?.type === 'task' && activeMenu.taskId === task.id}
                        onRowClick={(position) => toggleTaskMenu(task.id, position)}
                        activeSubtaskId={
                          activeMenu?.type === 'subtask' && activeMenu.taskId === task.id
                            ? activeMenu.subtaskId
                            : null
                        }
                        onSubtaskRowClick={(subtaskId, position) =>
                          toggleSubtaskMenu(task.id, subtaskId, position)
                        }
                        onEditStages={setStagesTarget}
                        onUpdateTask={(updatedTask) => updateTask(activeList.id, updatedTask)}
                        onUpdateSubtask={(taskId, subtaskId, patch) =>
                          updateSubtask(activeList.id, taskId, subtaskId, patch)
                        }
                        extra={
                          <>
                            {renderRepeatBadge(task, () => setRepeatTarget({ type: 'task', task }))}
                            {renderDueBadge(task, () => setDueTarget({ type: 'task', task }))}
                          </>
                        }
                        renderSubtaskExtra={(subtask) =>
                          renderSubtaskExtra(subtask, task.id, setRepeatTarget, setDueTarget)
                        }
                        hoverExtra={renderTaskHoverExtra(task, setRepeatTarget, setDueTarget)}
                        renderSubtaskHoverExtra={(subtask) =>
                          renderSubtaskHoverExtra(subtask, task.id, setRepeatTarget, setDueTarget)
                        }
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
        key={isTaskModalOpen ? 'open' : 'closed'}
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={(task) => {
          if (activeList) addTask(activeList.id, task);
          setIsTaskModalOpen(false);
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
        key={`repeat-${repeatTarget ? editTargetId(repeatTarget) : 'idle'}`}
        isOpen={repeatTarget !== null}
        repeat={repeatTarget ? (repeatTarget.type === 'task' ? repeatTarget.task.repeat : repeatTarget.subtask.repeat) : undefined}
        onClose={() => setRepeatTarget(null)}
        onSubmit={(repeat) => {
          if (!activeList || !repeatTarget) return;
          if (repeatTarget.type === 'task') {
            updateTask(activeList.id, { ...repeatTarget.task, repeat });
          } else {
            updateSubtask(activeList.id, repeatTarget.taskId, repeatTarget.subtask.id, { repeat });
          }
          setRepeatTarget(null);
        }}
      />

      <TaskDueModal
        key={`due-${dueTarget ? editTargetId(dueTarget) : 'idle'}`}
        isOpen={dueTarget !== null}
        due={dueTarget ? (dueTarget.type === 'task' ? dueTarget.task.due : dueTarget.subtask.due) : ''}
        onClose={() => setDueTarget(null)}
        onSubmit={(due) => {
          if (!activeList || !dueTarget) return;
          if (dueTarget.type === 'task') {
            updateTask(activeList.id, { ...dueTarget.task, due });
          } else {
            updateSubtask(activeList.id, dueTarget.taskId, dueTarget.subtask.id, { due });
          }
          setDueTarget(null);
        }}
      />

      <TaskStagesModal
        key={`stages-${stagesTarget?.id ?? 'idle'}`}
        isOpen={stagesTarget !== null}
        stages={stagesTarget?.stages ?? []}
        onClose={() => setStagesTarget(null)}
        onSubmit={(stages) => {
          if (!activeList || !stagesTarget) return;
          // clampTaskStages re-derives the task's own stage AND every
          // subtask's stage against the new (possibly shorter) list —
          // stages are shared with subtasks (see TaskItem.tsx), so a
          // shrink here can otherwise leave a stage index pointing past
          // the end of the array.
          updateTask(activeList.id, clampTaskStages({ ...stagesTarget, stages }));
          setStagesTarget(null);
        }}
      />

      <SubtaskModal
        key={subtaskModalTaskId ?? 'idle'}
        isOpen={subtaskModalTaskId !== null}
        onClose={() => setSubtaskModalTaskId(null)}
        onSubmit={(values) => {
          if (activeList && subtaskModalTaskId) addSubtask(activeList.id, subtaskModalTaskId, values);
          setSubtaskModalTaskId(null);
        }}
      />

      {renderActiveMenu()}

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
