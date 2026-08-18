'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_TASK_LISTS } from '../../../lib/data';
import { readTaskLists, writeTaskLists } from '../../../lib/firebaseSync';
import { reorderWithinGroup } from '../../../lib/reorder';
import { cycleSubtaskStage, cycleTaskStage, isTaskDone } from '../../../lib/taskCascade';
import { resetRepeatingTask, shouldResetTask } from '../../../lib/taskRepeat';
import type { Task, TaskList, TaskStageDef } from '../../../lib/types';

// Module-level singleton — every widget instance sharing the same in-memory
// copy, one Firestore writer.
let taskLists: TaskList[] = [];
let isLoading = true;
let hasStartedLoad = false;
let hasStartedRepeatWatcher = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getTaskListsSnapshot() {
  return taskLists;
}

function getIsLoadingSnapshot() {
  return isLoading;
}

function normalizeTask(task: Task): Task {
  const now = new Date().toISOString();
  return {
    ...task,
    subtasks: task.subtasks ?? [],
    createdAt: task.createdAt ?? now,
    updatedAt: task.updatedAt ?? now,
    completedAt: task.completedAt ?? null,
  };
}

function normalizeTaskList(list: TaskList): TaskList {
  return { ...list, tasks: (list.tasks ?? []).map(normalizeTask) };
}

function ensureLoaded() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;

  (async () => {
    const synced = await readTaskLists();
    taskLists = (synced ?? DEFAULT_TASK_LISTS).map(normalizeTaskList);
    isLoading = false;
    notify();
    runRepeatResetCheck();
  })();
}

function persist() {
  if (taskLists.length > 0) {
    writeTaskLists(taskLists);
  }
}

// Resets any completed repeating task whose schedule has passed since it
// was last completed (or all subtasks reset along with it — see
// resetRepeatingTask). Not tied to exact-time triggering — see
// ensureRepeatWatcherStarted.
function runRepeatResetCheck() {
  if (taskLists.length === 0) return;

  const now = new Date();
  let changed = false;

  const next = taskLists.map((list) => {
    let listChanged = false;
    const tasks = list.tasks.map((task) => {
      if (!shouldResetTask(task, now)) return task;
      listChanged = true;
      changed = true;
      return resetRepeatingTask(task, now);
    });
    return listChanged ? { ...list, tasks } : list;
  });

  if (!changed) return;
  taskLists = next;
  notify();
  persist();
}

// Wired up once at module scope (not per hook call) so N mounted widgets
// still only run one timer and one listener between them.
function ensureRepeatWatcherStarted() {
  if (hasStartedRepeatWatcher) return;
  hasStartedRepeatWatcher = true;

  setInterval(runRepeatResetCheck, 60_000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runRepeatResetCheck();
  });
}

function withStageTimestamps<T extends { stage: number; stages: TaskStageDef[]; completedAt: string | null }>(
  previousStage: number,
  updated: T,
  now: string
): T {
  if (previousStage === updated.stage) return updated;
  return { ...updated, completedAt: isTaskDone(updated) ? now : null };
}

function updateList(listId: string, updater: (list: TaskList) => TaskList) {
  taskLists = taskLists.map((list) => (list.id === listId ? updater(list) : list));
  notify();
  persist();
}

function updateTaskStage(listId: string, taskId: string) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    tasks: list.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const cycled = cycleTaskStage(task);
      return { ...withStageTimestamps(task.stage, cycled, now), updatedAt: now };
    }),
  }));
}

function updateSubtaskStage(listId: string, taskId: string, subtaskId: string) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    tasks: list.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const cycled = cycleSubtaskStage(task, subtaskId);
      return { ...withStageTimestamps(task.stage, cycled, now), updatedAt: now };
    }),
  }));
}

function updateTask(listId: string, updatedTask: Task) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    tasks: list.tasks.map((task) =>
      task.id === updatedTask.id
        ? { ...withStageTimestamps(task.stage, updatedTask, now), updatedAt: now }
        : task
    ),
  }));
}

function deleteTask(listId: string, taskId: string) {
  updateList(listId, (list) => ({
    ...list,
    tasks: list.tasks.filter((task) => task.id !== taskId),
  }));
}

function addTask(listId: string, input: Task) {
  const now = new Date().toISOString();
  const task: Task = {
    ...input,
    createdAt: now,
    updatedAt: now,
    completedAt: isTaskDone(input) ? now : null,
  };
  updateList(listId, (list) => ({ ...list, tasks: [...list.tasks, task] }));
}

// `predicate` should match whatever the caller currently has visible (e.g.
// filtered by the show-completed toggle) so reordering only reshuffles
// those tasks relative to each other, leaving any hidden task's position
// in the list's backing array untouched.
function reorderTasks(
  listId: string,
  predicate: (task: Task) => boolean,
  activeId: string,
  overId: string
) {
  updateList(listId, (list) => ({
    ...list,
    tasks: reorderWithinGroup(list.tasks, predicate, activeId, overId, (task) => task.id),
  }));
}

function reorderSubtasks(listId: string, taskId: string, activeId: string, overId: string) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    tasks: list.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            subtasks: reorderWithinGroup(task.subtasks, () => true, activeId, overId, (s) => s.id),
            updatedAt: now,
          }
        : task
    ),
  }));
}

function createList(name: string): string {
  const id = crypto.randomUUID();
  taskLists = [...taskLists, { id, name, tasks: [] }];
  notify();
  persist();
  return id;
}

export function useTaskLists() {
  useEffect(() => {
    ensureLoaded();
    ensureRepeatWatcherStarted();
  }, []);

  const currentTaskLists = useSyncExternalStore(
    subscribe,
    getTaskListsSnapshot,
    () => DEFAULT_TASK_LISTS
  );
  const currentIsLoading = useSyncExternalStore(subscribe, getIsLoadingSnapshot, () => true);

  return {
    taskLists: currentTaskLists,
    isLoading: currentIsLoading,
    createList,
    addTask,
    updateTaskStage,
    updateSubtaskStage,
    updateTask,
    deleteTask,
    reorderTasks,
    reorderSubtasks,
  };
}
