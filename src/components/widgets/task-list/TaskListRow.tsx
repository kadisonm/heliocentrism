'use client';

import { memo, useCallback, useMemo } from 'react';
import type { Subtask, Task } from '../../../lib/types';
import type { ContextMenuPosition } from '../../common/context-menu/ContextMenu';
import SortableTask from '../../shared/tasks/SortableTask';
import type { EditTarget } from './editTarget';
import { renderDueBadge, renderRepeatBadge, renderSubtaskEditExtra, renderSubtaskExtra, renderTaskEditExtra } from './taskBadges';

type TaskListRowProps = {
  task: Task;
  subtasks: Subtask[];
  index: number;
  isActive: boolean;
  isEditingRow: boolean;
  activeSubtaskId: string | null;
  editingSubtaskId: string | null;
  draggingId: string | null;
  droppingId: string | null;
  onToggleTask: (taskId: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
  onUpdateTask: (task: Task) => void;
  onUpdateSubtask: (subtaskId: string, patch: Partial<Pick<Subtask, 'title' | 'description'>>) => void;
  onToggleTaskMenu: (taskId: string, position: ContextMenuPosition) => void;
  onToggleSubtaskMenu: (subtaskId: string, position: ContextMenuPosition) => void;
  onEnterTaskEditMode: (taskId: string) => void;
  onEnterSubtaskEditMode: (taskId: string, subtaskId: string) => void;
  onEditStages: (task: Task) => void;
  onEditRepeat: (target: EditTarget) => void;
  onEditDue: (target: EditTarget) => void;
};

// A real component (not an inline .map() body) so each row can bind its own
// task.id-scoped handlers and badge JSX via useCallback/useMemo — combined
// with SortableTask's own memo, this is what stops an unrelated row
// elsewhere on the dashboard from re-rendering (and rebinding its drag
// listener) whenever a different list's task is mutated, e.g. while
// dragging a task across into another Task List widget.
function TaskListRow({
  task,
  subtasks,
  index,
  isActive,
  isEditingRow,
  activeSubtaskId,
  editingSubtaskId,
  draggingId,
  droppingId,
  onToggleTask,
  onToggleSubtask,
  onUpdateTask,
  onUpdateSubtask,
  onToggleTaskMenu,
  onToggleSubtaskMenu,
  onEnterTaskEditMode,
  onEnterSubtaskEditMode,
  onEditStages,
  onEditRepeat,
  onEditDue,
}: TaskListRowProps) {
  const handleRowClick = useCallback(
    (position: ContextMenuPosition) => onToggleTaskMenu(task.id, position),
    [task.id, onToggleTaskMenu]
  );
  const handleEnterEditMode = useCallback(() => onEnterTaskEditMode(task.id), [task.id, onEnterTaskEditMode]);
  const handleSubtaskEnterEditMode = useCallback(
    (subtaskId: string) => onEnterSubtaskEditMode(task.id, subtaskId),
    [task.id, onEnterSubtaskEditMode]
  );
  const handleEditRepeat = useCallback(() => onEditRepeat({ type: 'task', task }), [task, onEditRepeat]);
  const handleEditDue = useCallback(() => onEditDue({ type: 'task', task }), [task, onEditDue]);

  const extra = useMemo(
    () => (
      <>
        {renderRepeatBadge(task, handleEditRepeat)}
        {renderDueBadge(task, handleEditDue)}
      </>
    ),
    [task, handleEditRepeat, handleEditDue]
  );
  const editExtra = useMemo(() => renderTaskEditExtra(task, onEditRepeat, onEditDue), [task, onEditRepeat, onEditDue]);
  const renderSubExtra = useCallback(
    (subtask: Subtask) => renderSubtaskExtra(subtask, onEditRepeat, onEditDue),
    [onEditRepeat, onEditDue]
  );
  const renderSubEditExtra = useCallback(
    (subtask: Subtask) => renderSubtaskEditExtra(subtask, onEditRepeat, onEditDue),
    [onEditRepeat, onEditDue]
  );

  return (
    <SortableTask
      task={task}
      index={index}
      subtasks={subtasks}
      onToggle={onToggleTask}
      onToggleSubtask={onToggleSubtask}
      isActive={isActive}
      onRowClick={handleRowClick}
      activeSubtaskId={activeSubtaskId}
      onSubtaskRowClick={onToggleSubtaskMenu}
      onEditStages={onEditStages}
      onUpdateTask={onUpdateTask}
      onUpdateSubtask={onUpdateSubtask}
      extra={extra}
      renderSubtaskExtra={renderSubExtra}
      editExtra={editExtra}
      renderSubtaskEditExtra={renderSubEditExtra}
      isEditingRow={isEditingRow}
      onEnterEditMode={handleEnterEditMode}
      editingSubtaskId={editingSubtaskId}
      onSubtaskEnterEditMode={handleSubtaskEnterEditMode}
      draggingId={draggingId}
      droppingId={droppingId}
    />
  );
}

export default memo(TaskListRow);
