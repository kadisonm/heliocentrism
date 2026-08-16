'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_TASKS } from '../../lib/data';
import { readTasksFromSyncFolder, writeTasksToSyncFolder } from '../../lib/firebaseSync';
import { shouldResetTodo } from '../../lib/routineReset';
import type { Todo, TodoStage } from '../../lib/types';
import { getSettingsSnapshot } from './useSettings';

// Module-level singleton, not React state — every widget instance that
// calls useTodos() below shares this same in-memory copy, so completing a
// task in one mounted widget is instantly reflected in every other one, and
// there's exactly one writer to Firestore regardless of how many widgets
// are on the dashboard at once.
let todos: Todo[] = [];
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

function getTodosSnapshot() {
  return todos;
}

function getIsLoadingSnapshot() {
  return isLoading;
}

// Pre-existing data predates createdAt/updatedAt/completedAt — fill in
// sensible defaults rather than crash or silently drop those tasks.
function normalizeTodo(todo: Todo): Todo {
  const now = new Date().toISOString();
  return {
    ...todo,
    createdAt: todo.createdAt ?? now,
    updatedAt: todo.updatedAt ?? now,
    completedAt: todo.completedAt ?? null,
  };
}

function ensureLoaded() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;

  (async () => {
    const syncedTasks = await readTasksFromSyncFolder();
    todos = (syncedTasks ?? DEFAULT_TASKS).map(normalizeTodo);
    isLoading = false;
    notify();
    runResetCheck();
  })();
}

function persist() {
  if (todos.length > 0) {
    writeTasksToSyncFolder(todos);
  }
}

function getNextStage(stage: TodoStage): TodoStage {
  return ((stage + 1) % 3) as TodoStage;
}

function updateTodoStage(id: string) {
  const now = new Date().toISOString();
  todos = todos.map((todo) => {
    if (todo.id !== id) return todo;
    const nextStage = getNextStage(todo.stage);
    return {
      ...todo,
      stage: nextStage,
      updatedAt: now,
      completedAt: nextStage === 2 ? now : null,
    };
  });
  notify();
  persist();
}

function updateTodo(updatedTodo: Todo) {
  const now = new Date().toISOString();
  todos = todos.map((todo) => {
    if (todo.id !== updatedTodo.id) return todo;

    const wasCompleted = todo.stage === 2;
    const isCompleted = updatedTodo.stage === 2;
    let completedAt = updatedTodo.completedAt;
    if (!wasCompleted && isCompleted) completedAt = now;
    else if (wasCompleted && !isCompleted) completedAt = null;

    return { ...updatedTodo, updatedAt: now, completedAt };
  });
  notify();
  persist();
}

function addTodo(input: Omit<Todo, 'createdAt' | 'updatedAt' | 'completedAt'>) {
  const now = new Date().toISOString();
  const todo: Todo = {
    ...input,
    createdAt: now,
    updatedAt: now,
    completedAt: input.stage === 2 ? now : null,
  };
  todos = [...todos, todo];
  notify();
  persist();
}

// Resets completed daily/weekly/monthly tasks back to "To do" once their
// configured reset time (src/lib/routineReset.ts) has passed. Not tied to
// exact-time triggering — see runResetWatcher below for when this runs.
function runResetCheck() {
  if (todos.length === 0) return;

  const now = new Date();
  const resetTimes = getSettingsSnapshot().routineResetTimes;
  let changed = false;

  const next = todos.map((todo) => {
    if (!shouldResetTodo(todo, resetTimes, now)) return todo;
    changed = true;
    return { ...todo, stage: 0 as TodoStage, completedAt: null, updatedAt: now.toISOString() };
  });

  if (!changed) return;
  todos = next;
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

export function useTodos() {
  useEffect(() => {
    ensureLoaded();
    ensureResetWatcherStarted();
  }, []);

  const currentTodos = useSyncExternalStore(subscribe, getTodosSnapshot, () => DEFAULT_TASKS);
  const currentIsLoading = useSyncExternalStore(subscribe, getIsLoadingSnapshot, () => true);

  return {
    todos: currentTodos,
    isLoading: currentIsLoading,
    updateTodoStage,
    updateTodo,
    addTodo,
  };
}
