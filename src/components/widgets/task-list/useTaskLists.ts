'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_SUBTASKS, DEFAULT_TASKS, DEFAULT_TASK_LISTS } from '../../../lib/data';
import { readSubtasks, readTaskLists, readTasks, writeSubtasks, writeTaskLists, writeTasks } from '../../../lib/firebaseSync';
import { nextOrder, reorderByOrder } from '../../../lib/reorder';
import { createDefaultStages, cycleSubtaskStage, cycleTaskStage, isTaskDone } from '../../../lib/taskCascade';
import { resetDueSubtasks, resetRepeatingTask, shouldResetTask } from '../../../lib/taskRepeat';
import type { Subtask, Task, TaskList, TaskRepeat, TaskStageDef } from '../../../lib/types';

// Module-level singleton — every widget instance shares the same in-memory
// copy, one Firestore writer. Three parallel flat arrays rather than one
// nested one: a Task points back at its TaskList via parentId, a Subtask
// points back at its Task via parentId — see types.ts.
let taskLists: TaskList[] = [];
let tasks: Task[] = [];
let subtasks: Subtask[] = [];
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

function getTasksSnapshot() {
  return tasks;
}

function getSubtasksSnapshot() {
  return subtasks;
}

function getIsLoadingSnapshot() {
  return isLoading;
}

function normalizeTask(task: Task): Task {
  const now = new Date().toISOString();
  const hasStages = Array.isArray(task.stages) && task.stages.length >= 2;
  const stages = hasStages ? task.stages : createDefaultStages();

  return {
    ...task,
    stage: Math.min(task.stage, stages.length - 1),
    stages,
    order: task.order ?? 0,
    createdAt: task.createdAt || now,
    updatedAt: task.updatedAt || now,
    completedAt: task.completedAt ?? null,
  };
}

function normalizeSubtask(subtask: Subtask): Subtask {
  return {
    ...subtask,
    order: subtask.order ?? 0,
    due: subtask.due ?? '',
    completedAt: subtask.completedAt ?? null,
  };
}

function ensureLoaded() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;

  (async () => {
    const [syncedLists, syncedTasks, syncedSubtasks] = await Promise.all([readTaskLists(), readTasks(), readSubtasks()]);
    taskLists = syncedLists ?? DEFAULT_TASK_LISTS;
    tasks = (syncedTasks ?? DEFAULT_TASKS).map(normalizeTask);
    subtasks = (syncedSubtasks ?? DEFAULT_SUBTASKS).map(normalizeSubtask);
    isLoading = false;
    notify();
    runRepeatResetCheck();
  })();
}

// Guards on having actually finished the initial load (rather than e.g. an
// array-length check) so a stray pre-load mutation can never write the
// pristine empty starting state over real Firestore data, while a
// genuinely-empty account (every list/task deleted) still persists that
// correctly — no special-case bypass needed for that case.
function persist() {
  if (isLoading) return;
  writeTaskLists(taskLists);
  writeTasks(tasks);
  writeSubtasks(subtasks);
}

function commit() {
  notify();
  persist();
}

// Resets any completed repeating task whose schedule has passed since it
// was last completed (or all its subtasks reset along with it — see
// resetRepeatingTask), plus, independently, any subtask whose OWN repeat
// schedule has passed regardless of the parent (see resetDueSubtasks). Not
// tied to exact-time triggering — see ensureRepeatWatcherStarted.
function runRepeatResetCheck() {
  if (tasks.length === 0) return;

  const now = new Date();
  let changed = false;
  const subtaskUpdates = new Map<string, Subtask>();

  const nextTasks = tasks.map((task) => {
    const taskSubtasks = subtasks.filter((s) => s.parentId === task.id);
    let current = task;
    let currentSubtasks = taskSubtasks;

    if (shouldResetTask(current, now)) {
      const result = resetRepeatingTask(current, currentSubtasks, now);
      current = result.task;
      currentSubtasks = result.subtasks;
      changed = true;
    }

    const subtaskResult = resetDueSubtasks(current, currentSubtasks, now);
    if (subtaskResult.changed) {
      current = subtaskResult.task;
      currentSubtasks = subtaskResult.subtasks;
      changed = true;
    }

    for (const subtask of currentSubtasks) subtaskUpdates.set(subtask.id, subtask);
    return current;
  });

  if (!changed) return;
  tasks = nextTasks;
  subtasks = subtasks.map((s) => subtaskUpdates.get(s.id) ?? s);
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

// Compares done-ness before vs. after, not raw stage numbers — a stages
// list edit can shrink the array so the SAME numeric stage index now means
// "done" when it didn't before (e.g. a 3-stage list shrinking to 2 turns
// index 1 from "Doing" into "Done"). Comparing stage numbers alone would
// miss that transition and skip the stamp.
function withStageTimestamps<T extends { stage: number; stages: TaskStageDef[]; completedAt: string | null }>(
  wasDone: boolean,
  updated: T,
  now: string
): T {
  const isDone = isTaskDone(updated);
  if (wasDone === isDone) return updated;
  return { ...updated, completedAt: isDone ? now : null };
}

// Mirrors withStageTimestamps, but for one subtask within a task whose own
// stage just changed — either because the user clicked that subtask
// directly, the parent's own toggle cascaded it forward (cycleTaskStage),
// or a stages-list edit clamped it. Needed so a subtask with its own repeat
// has an accurate completedAt to check itself against (shouldResetSubtask)
// instead of reading null and being treated as immediately stale.
function withSubtaskCompletedAt(wasDone: boolean, subtask: Subtask, stages: TaskStageDef[], now: string): Subtask {
  const isDone = isTaskDone({ stage: subtask.stage, stages });
  if (wasDone === isDone) return subtask;
  return { ...subtask, completedAt: isDone ? now : null };
}

// Replaces just the given task's own subtasks within the flat `subtasks`
// array, leaving every other task's subtasks (and any non-matching id
// within `updated`, which shouldn't happen) untouched.
function replaceSubtasks(updated: Subtask[]) {
  const updatedById = new Map(updated.map((s) => [s.id, s]));
  subtasks = subtasks.map((subtask) => updatedById.get(subtask.id) ?? subtask);
}

function updateTaskStage(taskId: string) {
  const now = new Date().toISOString();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const taskSubtasks = subtasks.filter((s) => s.parentId === taskId);
  const wasDone = isTaskDone(task);
  const subtaskWasDone = new Map(taskSubtasks.map((s) => [s.id, isTaskDone({ stage: s.stage, stages: task.stages })]));

  const cycled = cycleTaskStage(task, taskSubtasks);
  const stampedSubtasks = cycled.subtasks.map((s) =>
    withSubtaskCompletedAt(subtaskWasDone.get(s.id) ?? false, s, cycled.task.stages, now)
  );

  tasks = tasks.map((t) => (t.id === taskId ? { ...withStageTimestamps(wasDone, cycled.task, now), updatedAt: now } : t));
  replaceSubtasks(stampedSubtasks);
  commit();
}

function updateSubtaskStage(subtaskId: string) {
  const now = new Date().toISOString();
  const subtask = subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return;
  const task = tasks.find((t) => t.id === subtask.parentId);
  if (!task) return;
  const taskSubtasks = subtasks.filter((s) => s.parentId === task.id);
  const wasDone = isTaskDone(task);
  const previousSubtaskDone = isTaskDone({ stage: subtask.stage, stages: task.stages });

  const cycled = cycleSubtaskStage(task, taskSubtasks, subtaskId);
  const stampedSubtasks = cycled.subtasks.map((s) =>
    s.id === subtaskId ? withSubtaskCompletedAt(previousSubtaskDone, s, cycled.task.stages, now) : s
  );

  tasks = tasks.map((t) => (t.id === task.id ? { ...withStageTimestamps(wasDone, cycled.task, now), updatedAt: now } : t));
  replaceSubtasks(stampedSubtasks);
  commit();
}

// Wholesale-replaces a task (used by inline-edit title/description saves
// and the due/repeat quick-edit modals) — none of those touch `stage`, so
// no cascade/timestamp bookkeeping is needed here. Stage-list edits go
// through updateTaskStages below instead, since those DO need to reach the
// task's subtasks too.
function updateTask(updatedTask: Task) {
  const now = new Date().toISOString();
  tasks = tasks.map((task) => (task.id === updatedTask.id ? { ...updatedTask, updatedAt: now } : task));
  commit();
}

// A task's stages list shrinking can turn a subtask's (and the task's own)
// existing stage index into "done" when it wasn't before — clamps both,
// same as clampTaskStages, and stamps completedAt for anything whose
// done-ness flipped as a result.
function updateTaskStages(taskId: string, stages: TaskStageDef[]) {
  const now = new Date().toISOString();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const taskSubtasks = subtasks.filter((s) => s.parentId === taskId);
  const wasDone = isTaskDone(task);
  const subtaskWasDone = new Map(taskSubtasks.map((s) => [s.id, isTaskDone({ stage: s.stage, stages: task.stages })]));

  const maxIndex = stages.length - 1;
  const clampedTask = { ...task, stages, stage: Math.min(task.stage, maxIndex) };
  const clampedSubtasks = taskSubtasks.map((s) => ({ ...s, stage: Math.min(s.stage, maxIndex) }));
  const stampedSubtasks = clampedSubtasks.map((s) =>
    withSubtaskCompletedAt(subtaskWasDone.get(s.id) ?? false, s, stages, now)
  );

  tasks = tasks.map((t) => (t.id === taskId ? { ...withStageTimestamps(wasDone, clampedTask, now), updatedAt: now } : t));
  replaceSubtasks(stampedSubtasks);
  commit();
}

function deleteTask(taskId: string) {
  tasks = tasks.filter((task) => task.id !== taskId);
  subtasks = subtasks.filter((subtask) => subtask.parentId !== taskId);
  commit();
}

type TaskDraft = Omit<Task, 'parentId' | 'order' | 'createdAt' | 'updatedAt' | 'completedAt'>;
type SubtaskDraft = Omit<Subtask, 'parentId' | 'order'>;

// `subtaskDrafts` lets TaskModal's "add task" form submit subtasks added in
// the same draft in one go — each draft's id is already client-generated
// (see TaskModal.tsx), so they can be created alongside their new parent
// without a separate round trip, and this fires just one persist() instead
// of N+1 separate writes.
function addTask(listId: string, taskDraft: TaskDraft, subtaskDrafts: SubtaskDraft[] = []) {
  const now = new Date().toISOString();
  const siblingTasks = tasks.filter((t) => t.parentId === listId);
  const task: Task = {
    ...taskDraft,
    parentId: listId,
    order: nextOrder(siblingTasks),
    createdAt: now,
    updatedAt: now,
    completedAt: isTaskDone(taskDraft) ? now : null,
  };
  const newSubtasks: Subtask[] = subtaskDrafts.map((draft, index) => ({ ...draft, parentId: task.id, order: index }));

  tasks = [...tasks, task];
  subtasks = [...subtasks, ...newSubtasks];
  commit();
}

function reorderTasks(listId: string, activeId: string, overId: string) {
  const siblings = tasks.filter((task) => task.parentId === listId);
  const reordered = reorderByOrder(siblings, activeId, overId);
  const reorderedById = new Map(reordered.map((task) => [task.id, task]));
  tasks = tasks.map((task) => reorderedById.get(task.id) ?? task);
  commit();
}

// Cross-list/cross-widget reparent — flips parentId and appends at the end
// of the new list's own tasks. Dragging to a specific position within the
// new list is a reorderTasks call right after (see TaskDragProvider).
function moveTask(taskId: string, newListId: string) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task || task.parentId === newListId) return;
  const now = new Date().toISOString();
  const newSiblings = tasks.filter((t) => t.parentId === newListId);
  tasks = tasks.map((t) =>
    t.id === taskId ? { ...t, parentId: newListId, order: nextOrder(newSiblings), updatedAt: now } : t
  );
  commit();
}

// Does not re-derive the parent's stage from its subtasks (via
// deriveStageFromSubtasks) — matches the already-existing behavior of the
// old modal-based add path. A parent shown "done" with zero subtasks that
// then gets a fresh incomplete subtask added won't visually un-done itself
// until some other stage-changing operation touches it — a pre-existing
// latent gap, not something introduced or fixed here.
function addSubtask(taskId: string, input: { title: string; description?: string; due: string; repeat?: TaskRepeat }) {
  const now = new Date().toISOString();
  const siblings = subtasks.filter((s) => s.parentId === taskId);
  const subtask: Subtask = {
    id: crypto.randomUUID(),
    parentId: taskId,
    order: nextOrder(siblings),
    title: input.title,
    description: input.description,
    stage: 0,
    due: input.due,
    repeat: input.repeat,
    completedAt: null,
  };
  subtasks = [...subtasks, subtask];
  tasks = tasks.map((t) => (t.id === taskId ? { ...t, updatedAt: now } : t));
  commit();
}

// Title/description/due/repeat only — never stage/completedAt, those are
// only ever touched by the stage-toggle cascade functions above. Same
// no-stage-re-derivation scope as addSubtask.
function updateSubtask(subtaskId: string, patch: Partial<Pick<Subtask, 'title' | 'description' | 'due' | 'repeat'>>) {
  const now = new Date().toISOString();
  const subtask = subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return;
  subtasks = subtasks.map((s) => (s.id === subtaskId ? { ...s, ...patch } : s));
  tasks = tasks.map((t) => (t.id === subtask.parentId ? { ...t, updatedAt: now } : t));
  commit();
}

// Same no-stage-re-derivation scope as addSubtask.
function deleteSubtask(subtaskId: string) {
  const now = new Date().toISOString();
  const subtask = subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return;
  subtasks = subtasks.filter((s) => s.id !== subtaskId);
  tasks = tasks.map((t) => (t.id === subtask.parentId ? { ...t, updatedAt: now } : t));
  commit();
}

function reorderSubtasks(taskId: string, activeId: string, overId: string) {
  const siblings = subtasks.filter((s) => s.parentId === taskId);
  const reordered = reorderByOrder(siblings, activeId, overId);
  const reorderedById = new Map(reordered.map((s) => [s.id, s]));
  subtasks = subtasks.map((s) => reorderedById.get(s.id) ?? s);
  commit();
}

function createList(name: string): string {
  const id = crypto.randomUUID();
  taskLists = [...taskLists, { id, name }];
  commit();
  return id;
}

function renameList(listId: string, name: string) {
  taskLists = taskLists.map((list) => (list.id === listId ? { ...list, name } : list));
  commit();
}

// Cascades: every task that belonged to this list is deleted too, and every
// subtask that belonged to any of those tasks along with them.
function deleteList(listId: string) {
  const removedTaskIds = new Set(tasks.filter((task) => task.parentId === listId).map((task) => task.id));
  taskLists = taskLists.filter((list) => list.id !== listId);
  tasks = tasks.filter((task) => task.parentId !== listId);
  subtasks = subtasks.filter((subtask) => !removedTaskIds.has(subtask.parentId));
  commit();
}

export function useTaskLists() {
  useEffect(() => {
    ensureLoaded();
    ensureRepeatWatcherStarted();
  }, []);

  const currentTaskLists = useSyncExternalStore(subscribe, getTaskListsSnapshot, () => DEFAULT_TASK_LISTS);
  const currentTasks = useSyncExternalStore(subscribe, getTasksSnapshot, () => DEFAULT_TASKS);
  const currentSubtasks = useSyncExternalStore(subscribe, getSubtasksSnapshot, () => DEFAULT_SUBTASKS);
  const currentIsLoading = useSyncExternalStore(subscribe, getIsLoadingSnapshot, () => true);

  return {
    taskLists: currentTaskLists,
    tasks: currentTasks,
    subtasks: currentSubtasks,
    isLoading: currentIsLoading,
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
    reorderTasks,
    reorderSubtasks,
    moveTask,
  };
}
