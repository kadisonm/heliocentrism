'use client';

import type { DragEndEvent, DragOverEvent } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_SUBTASKS, DEFAULT_TASKS, DEFAULT_TASK_LISTS } from '../../../lib/data';
import { readSubtasks, readTaskLists, readTasks, writeSubtasks, writeTaskLists, writeTasks } from '../../../lib/firebaseSync';
import { nextOrder } from '../../../lib/reorder';
import { createDefaultStages, cycleSubtaskStage, cycleTaskStage, isTaskDone } from '../../../lib/taskCascade';
import { resetDueSubtasks, resetRepeatingTask, shouldResetTask } from '../../../lib/taskRepeat';
import type { Subtask, Task, TaskList, TaskRepeat, TaskStageDef } from '../../../lib/types';
import { subtasksZoneId } from '../../shared/tasks/taskSortableTypes';

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

// Not-done tasks grouped by list id and ordered — the shape
// @dnd-kit/helpers' move() expects. A done task is never draggable and
// never a drop target (see index.tsx rendering it as a plain, non-sortable
// row when shown) — excluding it here, unconditionally, keeps every
// task's sortable `index` prop consistent regardless of which widget(s)
// currently have "show completed" on, since that's a per-widget display
// setting this data layer otherwise has no way to reconcile across them.
function groupedTaskIds(): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const list of taskLists) grouped[list.id] = [];
  for (const task of [...tasks].sort((a, b) => a.order - b.order)) {
    if (isTaskDone(task)) continue;
    (grouped[task.parentId] ??= []).push(task.id);
  }
  return grouped;
}

// Applies a new list->taskIds arrangement back onto the flat `tasks` array
// (order/parentId). Done tasks are left exactly as they were — see
// groupedTaskIds.
function applyTaskGroups(grouped: Record<string, string[]>) {
  const now = new Date().toISOString();
  const included = new Set(Object.values(grouped).flat());
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const next: Task[] = [];

  for (const [listId, ids] of Object.entries(grouped)) {
    ids.forEach((id, order) => {
      const task = byId.get(id);
      if (!task) return;
      next.push(task.parentId === listId && task.order === order ? task : { ...task, parentId: listId, order, updatedAt: now });
    });
  }
  for (const task of tasks) if (!included.has(task.id)) next.push(task);
  tasks = next;
}

let taskDragSnapshot: Task[] | null = null;

function beginTaskDrag() {
  taskDragSnapshot = tasks;
}

// Reparents a task into its hovered list the moment it crosses into one —
// but ONLY then. Same-list reordering needs nothing here at all (dnd-kit's
// OptimisticSortingPlugin animates that live, client-side, no app-state
// change needed) — calling move()+notify() on every dragover regardless
// fans a re-render out to every widget 60+ times a second, which is what
// actually read as jitter. Final position is captured once, at drop.
function applyTaskDragOver(event: DragOverEvent) {
  console.count('dragover-event');
  const source = event.operation.source;
  if (!isSortable(source)) return;
  const currentTask = tasks.find((t) => t.id === source.id);
  if (!currentTask || currentTask.parentId === source.group) return;
  applyTaskGroups(move(groupedTaskIds(), event));
  console.count('applyTaskDragOver-notify');
  notify();
}

function endTaskDrag(event: DragEndEvent) {
  if (event.canceled) {
    if (taskDragSnapshot) tasks = taskDragSnapshot;
    notify();
    taskDragSnapshot = null;
    return;
  }
  applyTaskGroups(move(groupedTaskIds(), event));
  persist();
  taskDragSnapshot = null;
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

// Not-done subtasks grouped by parent task id — mirrors groupedTaskIds/
// applyTaskGroups above, same reasoning (a done subtask is shown as a
// plain, non-sortable row and never reindexed). Subtasks never cross
// tasks (see the per-task sortable `type` in SubtaskSortableRow, which
// makes a different task's subtask area an invalid target at the dnd-kit
// level), so this only ever runs once, at drop — not live on every
// dragover the way groupedTaskIds is.
function groupedSubtaskIds(): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  const stagesByTaskId = new Map(tasks.map((t) => [t.id, t.stages]));
  for (const task of tasks) grouped[subtasksZoneId(task.id)] = [];
  for (const subtask of [...subtasks].sort((a, b) => a.order - b.order)) {
    const stages = stagesByTaskId.get(subtask.parentId);
    if (!stages || isTaskDone({ stage: subtask.stage, stages })) continue;
    (grouped[subtasksZoneId(subtask.parentId)] ??= []).push(subtask.id);
  }
  return grouped;
}

function applySubtaskGroups(grouped: Record<string, string[]>) {
  const included = new Set(Object.values(grouped).flat());
  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const taskIdByZone = new Map(tasks.map((t) => [subtasksZoneId(t.id), t.id]));
  const next: Subtask[] = [];

  for (const [zoneId, ids] of Object.entries(grouped)) {
    const taskId = taskIdByZone.get(zoneId);
    if (!taskId) continue;
    ids.forEach((id, order) => {
      const subtask = byId.get(id);
      if (!subtask) return;
      next.push(subtask.parentId === taskId && subtask.order === order ? subtask : { ...subtask, parentId: taskId, order });
    });
  }
  for (const subtask of subtasks) if (!included.has(subtask.id)) next.push(subtask);
  subtasks = next;
}

function commitSubtaskDragEnd(event: DragEndEvent) {
  if (event.canceled) return;
  applySubtaskGroups(move(groupedSubtaskIds(), event));
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
    beginTaskDrag,
    applyTaskDragOver,
    endTaskDrag,
    commitSubtaskDragEnd,
  };
}
