'use client';

import { useDroppable } from '@dnd-kit/react';
import { Eye, EyeOff, Layers, Plus, RefreshCw, Calendar, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useWidgetContext } from '../../grid/widgetContext';
import { isTaskDone } from '../../../lib/taskCascade';
import type { Subtask, Task, TaskList } from '../../../lib/types';
import ConfirmDialog from '../../common/ConfirmDialog';
import ContextMenu, { type ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import MenuItem from '../../common/context-menu/MenuItem';
import SortableTask from '../../shared/tasks/SortableTask';
import { TASK_TYPE } from '../../shared/tasks/taskSortableTypes';
import AddTaskListModal from './AddTaskListModal';
import TaskDueModal from './TaskDueModal';
import { editTargetId, type EditTarget } from './editTarget';
import SubtaskModal from './SubtaskModal';
import {
  renderDueBadge,
  renderRepeatBadge,
  renderSubtaskExtra,
  renderSubtaskEditExtra,
  renderTaskEditExtra,
} from './taskBadges';
import TaskListSwitcher from './TaskListSwitcher';
import TaskModal from './TaskModal';
import TaskRepeatModal from './TaskRepeatModal';
import TaskStagesModal from './TaskStagesModal';
import { useTaskLists } from './useTaskLists';

// Drives AddTaskListModal — 'add' seeds the name field, 'edit' pre-fills it
// from an existing list.
type ListModalState = { mode: 'add'; seedName: string } | { mode: 'edit'; list: TaskList };

// Which single task/subtask row currently has its "..." context menu open
// — at most one at a time; both row types stopPropagation() on click so
// only a genuine outside click reaches the document listener that clears
// this. `position` anchors the menu's top-left corner. A subtask's own id
// is enough to look it up directly in the flat subtasks store, so unlike
// EditTarget's task-scoped variant there's no need to also carry a taskId.
type ActiveMenu =
  | { type: 'task'; taskId: string; position: ContextMenuPosition }
  | { type: 'subtask'; subtaskId: string; position: ContextMenuPosition };

// Which single task/subtask row is in "edit mode" — entered by clicking its
// title/description, or any of its badges (see TaskRow.tsx's isEditingRow).
// Drives whether the "Set due date"/"Set repeat" ghost badges and an empty
// description's placeholder are revealed, rather than that being
// hover-driven.
type EditingRow = { type: 'task'; taskId: string } | { type: 'subtask'; taskId: string; subtaskId: string };

export default function TaskListWidget() {
  const {
    taskLists,
    tasks,
    subtasks,
    isLoading,
    createList,
    renameList,
    deleteList,
    addTask,
    updateTask,
    updateTaskStages,
    updateTaskStage,
    updateSubtaskStage,
    deleteTask,
    addSubtask,
    updateSubtask,
    deleteSubtask,
  } = useTaskLists();
  const { widget, onUpdate } = useWidgetContext();
  const selectedListId = widget.selectedListId;
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [repeatTarget, setRepeatTarget] = useState<EditTarget | null>(null);
  const [dueTarget, setDueTarget] = useState<EditTarget | null>(null);
  // Task-only — subtasks share their parent's `stages` array.
  const [stagesTarget, setStagesTarget] = useState<Task | null>(null);
  // Which task the "Add subtask" menu item is adding to — null means closed.
  const [subtaskModalTaskId, setSubtaskModalTaskId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu | null>(null);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [listPendingDelete, setListPendingDelete] = useState<TaskList | null>(null);
  const showCompleted = widget.showCompleted ?? false;
  const [listModalState, setListModalState] = useState<ListModalState | null>(null);

  // A click outside any task/subtask row, the context menu, or an open
  // quick-edit modal (portaled to document.body, so DOM containment is what
  // catches it, not a ref) closes the menu and drops edit mode. Uses
  // event.target.closest() rather than relying on stopPropagation() alone —
  // dnd-kit's PointerSensor has its own document click listener that can
  // still see an "inside" click even when the row's own handler stopped it.
  useEffect(() => {
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.task-item, .subtask, .context-menu, .editor-overlay, .settings-overlay')) return;
      setActiveMenu(null);
      setEditingRow(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Wraps setRepeatTarget/setDueTarget/setStagesTarget so opening any of
  // these quick-edit modals also switches that row into edit mode, not just
  // the field actually clicked.
  const editRepeat = (target: EditTarget) => {
    setRepeatTarget(target);
    setEditingRow(
      target.type === 'task'
        ? { type: 'task', taskId: target.task.id }
        : { type: 'subtask', taskId: target.subtask.parentId, subtaskId: target.subtask.id }
    );
  };
  const editDue = (target: EditTarget) => {
    setDueTarget(target);
    setEditingRow(
      target.type === 'task'
        ? { type: 'task', taskId: target.task.id }
        : { type: 'subtask', taskId: target.subtask.parentId, subtaskId: target.subtask.id }
    );
  };
  const editStages = (task: Task) => {
    setStagesTarget(task);
    setEditingRow({ type: 'task', taskId: task.id });
  };

  const toggleTaskMenu = (taskId: string, position: ContextMenuPosition) => {
    setActiveMenu((current) =>
      current?.type === 'task' && current.taskId === taskId ? null : { type: 'task', taskId, position }
    );
  };

  const toggleSubtaskMenu = (subtaskId: string, position: ContextMenuPosition) => {
    setActiveMenu((current) =>
      current?.type === 'subtask' && current.subtaskId === subtaskId ? null : { type: 'subtask', subtaskId, position }
    );
  };

  const activeList = useMemo(() => {
    const found = taskLists.find((list) => list.id === selectedListId);
    return found ?? taskLists[0] ?? null;
  }, [taskLists, selectedListId]);

  // Registered even with zero tasks (or no list at all) so this widget is
  // still a valid cross-widget drop target — see TaskDragProvider, which
  // owns the single shared DragDropProvider every Task List widget
  // instance's rows and containers register into.
  const { ref: setListDropRef } = useDroppable({
    id: activeList?.id ?? 'no-list',
    type: TASK_TYPE,
    accept: TASK_TYPE,
    disabled: !activeList,
  });

  // "Hide completed" applies at both levels: a done task drops out
  // entirely, and a not-done task keeps its own done subtasks hidden.
  // Tasks/subtasks live in their own flat stores now (see useTaskLists.ts)
  // rather than nested inside the list/task — filter by parentId, and sort
  // by `order` since array position no longer implies it.
  const visibleTasks = useMemo(() => {
    if (!activeList) return [];
    return tasks
      .filter((task) => task.parentId === activeList.id && (showCompleted || !isTaskDone(task)))
      .sort((a, b) => a.order - b.order);
  }, [tasks, activeList, showCompleted]);

  // A done task is excluded from the live sortable arrangement entirely
  // (see useTaskLists.ts's groupedTaskIds), regardless of "show
  // completed" — so its dense sortable `index` comes from the not-done
  // set alone, independent of what's actually rendered right now.
  const taskIndexById = useMemo(() => {
    if (!activeList) return new Map<string, number>();
    const notDone = tasks
      .filter((task) => task.parentId === activeList.id && !isTaskDone(task))
      .sort((a, b) => a.order - b.order);
    return new Map(notDone.map((task, index) => [task.id, index]));
  }, [tasks, activeList]);

  const subtasksByTaskId = useMemo(() => {
    const map = new Map<string, Subtask[]>();
    for (const task of visibleTasks) {
      map.set(
        task.id,
        subtasks
          .filter((subtask) => subtask.parentId === task.id && (showCompleted || !isTaskDone({ stage: subtask.stage, stages: task.stages })))
          .sort((a, b) => a.order - b.order)
      );
    }
    return map;
  }, [subtasks, visibleTasks, showCompleted]);

  // Scoped globally rather than per-task: subtask ids are unique, so a
  // subtask row compares its own id against this directly (see
  // TaskParent.tsx's SubtaskSortableRow) — no need to also gate on which
  // task currently owns the open menu.
  const activeSubtaskId = activeMenu?.type === 'subtask' ? activeMenu.subtaskId : null;
  const editingSubtaskId = editingRow?.type === 'subtask' ? editingRow.subtaskId : null;

  // The one "..." context menu popup — its items depend on whether a task
  // or a subtask is active, looked up fresh from the flat stores by id so
  // it never goes stale.
  function renderActiveMenu() {
    if (!activeMenu) return null;

    if (activeMenu.type === 'task') {
      const activeTask = tasks.find((t) => t.id === activeMenu.taskId);
      if (!activeTask) return null;

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
            icon={Layers}
            label="Change stages"
            onClick={() => {
              editStages(activeTask);
              setActiveMenu(null);
            }}
          />
          <MenuItem
            icon={RefreshCw}
            label="Set repeat"
            onClick={() => {
              editRepeat({ type: 'task', task: activeTask });
              setActiveMenu(null);
            }}
          />
          <MenuItem
            icon={Calendar}
            label="Set due date"
            onClick={() => {
              editDue({ type: 'task', task: activeTask });
              setActiveMenu(null);
            }}
          />
          <MenuItem
            icon={Trash2}
            label="Delete task"
            color="error"
            onClick={() => {
              deleteTask(activeTask.id);
              setActiveMenu(null);
            }}
          />
        </ContextMenu>
      );
    }

    const activeSubtask = subtasks.find((s) => s.id === activeMenu.subtaskId);
    if (!activeSubtask) return null;

    return (
      <ContextMenu position={activeMenu.position}>
        <MenuItem
          icon={RefreshCw}
          label="Set repeat"
          onClick={() => {
            editRepeat({ type: 'subtask', subtask: activeSubtask });
            setActiveMenu(null);
          }}
        />
        <MenuItem
          icon={Calendar}
          label="Set due date"
          onClick={() => {
            editDue({ type: 'subtask', subtask: activeSubtask });
            setActiveMenu(null);
          }}
        />
        <MenuItem
          icon={Trash2}
          label="Delete subtask"
          color="error"
          onClick={() => {
            deleteSubtask(activeSubtask.id);
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
              <div className="widget-list" ref={setListDropRef}>
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
                  <>
                    {visibleTasks.map((task) => (
                      <SortableTask
                        key={task.id}
                        task={task}
                        index={taskIndexById.get(task.id) ?? 0}
                        subtasks={subtasksByTaskId.get(task.id) ?? []}
                        onToggle={(id) => updateTaskStage(id)}
                        onToggleSubtask={(subtaskId) => updateSubtaskStage(subtaskId)}
                        isActive={activeMenu?.type === 'task' && activeMenu.taskId === task.id}
                        onRowClick={(position) => toggleTaskMenu(task.id, position)}
                        activeSubtaskId={activeSubtaskId}
                        onSubtaskRowClick={(subtaskId, position) => toggleSubtaskMenu(subtaskId, position)}
                        onEditStages={editStages}
                        onUpdateTask={updateTask}
                        onUpdateSubtask={updateSubtask}
                        extra={
                          <>
                            {renderRepeatBadge(task, () => editRepeat({ type: 'task', task }))}
                            {renderDueBadge(task, () => editDue({ type: 'task', task }))}
                          </>
                        }
                        renderSubtaskExtra={(subtask) => renderSubtaskExtra(subtask, editRepeat, editDue)}
                        editExtra={renderTaskEditExtra(task, editRepeat, editDue)}
                        renderSubtaskEditExtra={(subtask) => renderSubtaskEditExtra(subtask, editRepeat, editDue)}
                        isEditingRow={editingRow?.type === 'task' && editingRow.taskId === task.id}
                        onEnterEditMode={() => setEditingRow({ type: 'task', taskId: task.id })}
                        editingSubtaskId={editingSubtaskId}
                        onSubtaskEnterEditMode={(subtaskId) =>
                          setEditingRow({ type: 'subtask', taskId: task.id, subtaskId })
                        }
                      />
                    ))}
                  </>
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
        onSubmit={(task, subtaskDrafts) => {
          if (activeList) addTask(activeList.id, task, subtaskDrafts);
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
          if (!repeatTarget) return;
          if (repeatTarget.type === 'task') {
            updateTask({ ...repeatTarget.task, repeat });
          } else {
            updateSubtask(repeatTarget.subtask.id, { repeat });
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
          if (!dueTarget) return;
          if (dueTarget.type === 'task') {
            updateTask({ ...dueTarget.task, due });
          } else {
            updateSubtask(dueTarget.subtask.id, { due });
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
          if (!stagesTarget) return;
          updateTaskStages(stagesTarget.id, stages);
          setStagesTarget(null);
        }}
      />

      <SubtaskModal
        key={subtaskModalTaskId ?? 'idle'}
        isOpen={subtaskModalTaskId !== null}
        onClose={() => setSubtaskModalTaskId(null)}
        onSubmit={(values) => {
          if (subtaskModalTaskId) addSubtask(subtaskModalTaskId, values);
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
