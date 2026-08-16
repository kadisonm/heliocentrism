'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_ROUTINE_TASKS } from '../../lib/data';
import { readRoutineTasks, writeRoutineTasks } from '../../lib/firebaseSync';
import { shouldResetRoutineTask } from '../../lib/routineReset';
import { cycleSubtaskStage, cycleTaskStage } from '../../lib/taskCascade';
import type { RoutineTask, TodoStage } from '../../lib/types';
import { getSettingsSnapshot } from '../tasks/useSettings';

// Module-level singleton, not React state — every widget instance that
// calls useRoutineTasks() below shares this same in-memory copy, so
// completing a task in one mounted widget is instantly reflected in every
// other one, and there's exactly one writer to Firestore regardless of how
// many widgets are on the dashboard at once.
let tasks: RoutineTask[] = [];
let isLoading = true;
let hasStartedLoad = false;
let hasStartedResetWatcher = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getTasksSnapshot() {
  return tasks;
}

function getIsLoadingSnapshot() {
  return isLoading;
}

// Pre-existing data predates subtasks/createdAt/updatedAt/completedAt —
// fill in sensible defaults rather than crash or silently drop those tasks.
function normalizeTask(task: RoutineTask): RoutineTask {
  const now = new Date().toISOString();
  return {
    ...task,
    subtasks: task.subtasks ?? [],
    createdAt: task.createdAt ?? now,
    updatedAt: task.updatedAt ?? now,
    completedAt: task.completedAt ?? null,
  };
}

function ensureLoaded() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;

  (async () => {
    const synced = await readRoutineTasks();
    tasks = (synced ?? DEFAULT_ROUTINE_TASKS).map(normalizeTask);
    isLoading = false;
    notify();
    runResetCheck();
  })();
}

function persist() {
  if (tasks.length > 0) {
    writeRoutineTasks(tasks);
  }
}

// completedAt only changes when the stage actually crosses the Done
// boundary (either direction) — not on every edit.
function withStageTimestamps<T extends { stage: TodoStage; completedAt: string | null }>(
  previousStage: TodoStage,
  updated: T,
  now: string
): T {
  if (previousStage === updated.stage) return updated;
  return { ...updated, completedAt: updated.stage === 2 ? now : null };
}

function updateTaskStage(id: string) {
  const now = new Date().toISOString();
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    const cycled = cycleTaskStage(task);
    return { ...withStageTimestamps(task.stage, cycled, now), updatedAt: now };
  });
  notify();
  persist();
}

function updateSubtaskStage(taskId: string, subtaskId: string) {
  const now = new Date().toISOString();
  tasks = tasks.map((task) => {
    if (task.id !== taskId) return task;
    const cycled = cycleSubtaskStage(task, subtaskId);
    return { ...withStageTimestamps(task.stage, cycled, now), updatedAt: now };
  });
  notify();
  persist();
}

function updateTask(updatedTask: RoutineTask) {
  const now = new Date().toISOString();
  tasks = tasks.map((task) => {
    if (task.id !== updatedTask.id) return task;
    return { ...withStageTimestamps(task.stage, updatedTask, now), updatedAt: now };
  });
  notify();
  persist();
}

function addTask(input: RoutineTask) {
  const now = new Date().toISOString();
  const task: RoutineTask = {
    ...input,
    createdAt: now,
    updatedAt: now,
    completedAt: input.stage === 2 ? now : null,
  };
  tasks = [...tasks, task];
  notify();
  persist();
}

// Resets completed routine tasks back to "To do" (and their subtasks along
// with them) once their configured reset time (src/lib/routineReset.ts) has
// passed. Not tied to exact-time triggering — see ensureResetWatcherStarted.
function runResetCheck() {
  if (tasks.length === 0) return;

  const now = new Date();
  const resetTimes = getSettingsSnapshot().routineResetTimes;
  let changed = false;

  const next = tasks.map((task) => {
    if (!shouldResetRoutineTask(task, resetTimes, now)) return task;
    changed = true;
    return {
      ...task,
      stage: 0 as TodoStage,
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, stage: 0 as TodoStage })),
      completedAt: null,
      updatedAt: now.toISOString(),
    };
  });

  if (!changed) return;
  tasks = next;
  notify();
  persist();
}

// Wired up once at module scope (not per hook call) so N mounted widgets
// still only run one timer and one listener between them.
function ensureResetWatcherStarted() {
  if (hasStartedResetWatcher) return;
  hasStartedResetWatcher = true;

  setInterval(runResetCheck, 60_000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runResetCheck();
  });
}

export function useRoutineTasks() {
  useEffect(() => {
    ensureLoaded();
    ensureResetWatcherStarted();
  }, []);

  const currentTasks = useSyncExternalStore(subscribe, getTasksSnapshot, () => DEFAULT_ROUTINE_TASKS);
  const currentIsLoading = useSyncExternalStore(subscribe, getIsLoadingSnapshot, () => true);

  return {
    tasks: currentTasks,
    isLoading: currentIsLoading,
    updateTaskStage,
    updateSubtaskStage,
    updateTask,
    addTask,
  };
}
