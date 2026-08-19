'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_TASK_LISTS } from '../../../lib/data';
import { readTaskLists, writeTaskLists } from '../../../lib/firebaseSync';
import { reorderWithinGroup } from '../../../lib/reorder';
import { createDefaultStages, cycleSubtaskStage, cycleTaskStage, isTaskDone } from '../../../lib/taskCascade';
import { resetDueSubtasks, resetRepeatingTask, shouldResetTask } from '../../../lib/taskRepeat';
import type { Subtask, Task, TaskList, TaskStageDef } from '../../../lib/types';

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

// Pre-Phase-4 data has no `stages` field at all and used the old fixed
// 0|1|2 system. Only an actual old "done" (2) maps to the new done slot —
// to-do (0) and in-progress (1) both map to the new start slot, never
// silently promoted to done by a generic index clamp (which would map old
// stage 1 onto the new default's max index, which is that array's *done*
// slot).
function remapLegacyStage(oldStage: number, newStagesLength: number): number {
  if (oldStage >= 2) return newStagesLength - 1;
  return 0;
}

function normalizeTask(task: Task): Task {
  const now = new Date().toISOString();
  const hasStages = Array.isArray(task.stages) && task.stages.length >= 2;
  const stages = hasStages ? task.stages : createDefaultStages();
  const remapStage = (stage: number) =>
    hasStages ? Math.min(stage, stages.length - 1) : remapLegacyStage(stage, stages.length);

  return {
    ...task,
    stage: remapStage(task.stage),
    stages,
    subtasks: (task.subtasks ?? []).map((subtask) => ({
      ...subtask,
      stage: remapStage(subtask.stage),
      due: subtask.due ?? '',
      completedAt: subtask.completedAt ?? null,
    })),
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
// resetRepeatingTask), plus, independently, any subtask whose OWN repeat
// schedule has passed regardless of the parent (see resetDueSubtasks).
// Not tied to exact-time triggering — see ensureRepeatWatcherStarted.
function runRepeatResetCheck() {
  if (taskLists.length === 0) return;

  const now = new Date();
  let changed = false;

  const next = taskLists.map((list) => {
    let listChanged = false;
    const tasks = list.tasks.map((task) => {
      let current = task;

      if (shouldResetTask(current, now)) {
        current = resetRepeatingTask(current, now);
        listChanged = true;
      }

      const subtaskResult = resetDueSubtasks(current, now);
      if (subtaskResult.changed) {
        current = subtaskResult.task;
        listChanged = true;
      }

      return current;
    });
    if (listChanged) changed = true;
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

// Mirrors withStageTimestamps, but for one subtask within a task whose own
// stage just changed — either because the user clicked that subtask
// directly, the parent's own toggle cascaded it forward (cycleTaskStage),
// or a TaskModal save clamped its stage. Needed so a subtask with its own
// repeat has an accurate completedAt to check itself against
// (shouldResetSubtask) instead of reading null and being treated as
// immediately stale.
function withSubtaskCompletedAt(
  previousStage: number,
  subtask: Subtask,
  stages: TaskStageDef[],
  now: string
): Subtask {
  if (previousStage === subtask.stage) return subtask;
  return { ...subtask, completedAt: isTaskDone({ stage: subtask.stage, stages }) ? now : null };
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
      // cycleTaskStage can cascade lagging subtasks forward to meet the
      // parent's new stage — stamp completedAt for any subtask whose stage
      // actually changed, not just the one the user clicked.
      const cascaded = {
        ...cycled,
        subtasks: cycled.subtasks.map((subtask) => {
          const previous = task.subtasks.find((s) => s.id === subtask.id);
          return previous ? withSubtaskCompletedAt(previous.stage, subtask, cycled.stages, now) : subtask;
        }),
      };
      return { ...withStageTimestamps(task.stage, cascaded, now), updatedAt: now };
    }),
  }));
}

function updateSubtaskStage(listId: string, taskId: string, subtaskId: string) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    tasks: list.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const previousSubtask = task.subtasks.find((s) => s.id === subtaskId);
      const cycled = cycleSubtaskStage(task, subtaskId);
      const withTimestamp = {
        ...cycled,
        subtasks: cycled.subtasks.map((subtask) =>
          subtask.id === subtaskId && previousSubtask
            ? withSubtaskCompletedAt(previousSubtask.stage, subtask, cycled.stages, now)
            : subtask
        ),
      };
      return { ...withStageTimestamps(task.stage, withTimestamp, now), updatedAt: now };
    }),
  }));
}

function updateTask(listId: string, updatedTask: Task) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    tasks: list.tasks.map((task) => {
      if (task.id !== updatedTask.id) return task;
      // A TaskModal save can clamp a subtask's stage (e.g. shrinking the
      // stages list) without that going through updateSubtaskStage/
      // updateTaskStage above — stamp completedAt here too so it's never
      // missed. A brand-new subtask added in the same save has no
      // `previous` match and passes through untouched (already correct:
      // { stage: 0, completedAt: null } from addSubtask).
      const withSubtaskTimestamps = {
        ...updatedTask,
        subtasks: updatedTask.subtasks.map((subtask) => {
          const previous = task.subtasks.find((s) => s.id === subtask.id);
          return previous
            ? withSubtaskCompletedAt(previous.stage, subtask, updatedTask.stages, now)
            : subtask;
        }),
      };
      return { ...withStageTimestamps(task.stage, withSubtaskTimestamps, now), updatedAt: now };
    }),
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
