'use client';

import { useCallback } from 'react';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/react';
import { useAppDispatch, useAppSelector } from '../../../lib/store/hooks';
import {
  addSubtask as addSubtaskAction,
  addTask as addTaskThunk,
  applyTaskDragOver as applyTaskDragOverThunk,
  beginTaskDrag as beginTaskDragAction,
  commitSubtaskDragEnd as commitSubtaskDragEndThunk,
  createList as createListAction,
  deleteList as deleteListAction,
  deleteSubtask as deleteSubtaskAction,
  deleteTask as deleteTaskAction,
  endTaskDrag as endTaskDragThunk,
  renameList as renameListAction,
  setDraggingId as setDraggingIdAction,
  setDroppingId as setDroppingIdAction,
  setEditingRow as setEditingRowAction,
  updateSubtask as updateSubtaskAction,
  updateSubtaskStage as updateSubtaskStageAction,
  updateTask as updateTaskAction,
  updateTaskStage as updateTaskStageAction,
  updateTaskStages as updateTaskStagesAction,
  type EditingRow,
} from '../../../lib/store/taskListsSlice';
import type { Subtask, Task, TaskRepeat, TaskStageDef } from '../../../lib/types';

type TaskDraft = Omit<Task, 'parentId' | 'order' | 'createdAt' | 'updatedAt' | 'completedAt'>;
type SubtaskDraft = Omit<Subtask, 'parentId' | 'order'>;

// Thin wrapper over the task-lists Redux slice
// (src/lib/store/taskListsSlice.ts) — kept at the same call signature as
// before the Redux migration so every consumer (TaskDragProvider.tsx, the
// Task List widget, its modals, etc.) needs no changes.
export function useTaskLists() {
  const dispatch = useAppDispatch();

  const taskLists = useAppSelector((state) => state.taskLists.taskLists);
  const tasks = useAppSelector((state) => state.taskLists.tasks);
  const subtasks = useAppSelector((state) => state.taskLists.subtasks);
  const isLoading = useAppSelector((state) => state.taskLists.isLoading);
  const editingRow = useAppSelector((state) => state.taskLists.editingRow);
  const draggingId = useAppSelector((state) => state.taskLists.draggingId);
  const droppingId = useAppSelector((state) => state.taskLists.droppingId);

  const setEditingRow = useCallback((row: EditingRow | null) => dispatch(setEditingRowAction(row)), [dispatch]);
  const setDraggingId = useCallback((id: string | null) => dispatch(setDraggingIdAction(id)), [dispatch]);
  const setDroppingId = useCallback((id: string | null) => dispatch(setDroppingIdAction(id)), [dispatch]);

  // createList's id is generated in the action's `prepare` callback, so the
  // dispatched action carries it back out synchronously — the list switcher
  // relies on getting the new list's id immediately.
  const createList = useCallback((name: string): string => dispatch(createListAction(name)).payload.id, [dispatch]);

  const renameList = useCallback((listId: string, name: string) => dispatch(renameListAction({ listId, name })), [dispatch]);
  const deleteList = useCallback((listId: string) => dispatch(deleteListAction({ listId })), [dispatch]);

  const addTask = useCallback(
    (listId: string, taskDraft: TaskDraft, subtaskDrafts: SubtaskDraft[] = []) =>
      dispatch(addTaskThunk(listId, taskDraft, subtaskDrafts)),
    [dispatch]
  );

  const updateTask = useCallback((updatedTask: Task) => dispatch(updateTaskAction(updatedTask)), [dispatch]);

  const updateTaskStages = useCallback(
    (taskId: string, stages: TaskStageDef[]) => dispatch(updateTaskStagesAction({ taskId, stages })),
    [dispatch]
  );

  const updateTaskStage = useCallback((taskId: string) => dispatch(updateTaskStageAction({ taskId })), [dispatch]);
  const updateSubtaskStage = useCallback(
    (subtaskId: string) => dispatch(updateSubtaskStageAction({ subtaskId })),
    [dispatch]
  );
  const deleteTask = useCallback((taskId: string) => dispatch(deleteTaskAction({ taskId })), [dispatch]);

  const addSubtask = useCallback(
    (taskId: string, input: { title: string; description?: string; due: string; repeat?: TaskRepeat }) =>
      dispatch(addSubtaskAction({ taskId, input })),
    [dispatch]
  );

  const updateSubtask = useCallback(
    (subtaskId: string, patch: Partial<Pick<Subtask, 'title' | 'description' | 'due' | 'repeat'>>) =>
      dispatch(updateSubtaskAction({ subtaskId, patch })),
    [dispatch]
  );

  const deleteSubtask = useCallback((subtaskId: string) => dispatch(deleteSubtaskAction({ subtaskId })), [dispatch]);

  const beginTaskDrag = useCallback(() => dispatch(beginTaskDragAction()), [dispatch]);
  const applyTaskDragOver = useCallback((event: DragOverEvent) => dispatch(applyTaskDragOverThunk(event)), [dispatch]);
  const endTaskDrag = useCallback((event: DragEndEvent) => dispatch(endTaskDragThunk(event)), [dispatch]);
  const commitSubtaskDragEnd = useCallback(
    (event: DragEndEvent) => dispatch(commitSubtaskDragEndThunk(event)),
    [dispatch]
  );

  return {
    taskLists,
    tasks,
    subtasks,
    isLoading,
    editingRow,
    setEditingRow,
    draggingId,
    setDraggingId,
    droppingId,
    setDroppingId,
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
    beginTaskDrag,
    applyTaskDragOver,
    endTaskDrag,
    commitSubtaskDragEnd,
  };
}
