'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_TASKS } from '../../lib/data';
import { readTasksFromSyncFolder, writeTasksToSyncFolder } from '../../lib/firebaseSync';
import type { Todo, TodoStage } from '../../lib/types';

// Module-level singleton, not React state — every widget instance that
// calls useTodos() below shares this same in-memory copy, so completing a
// task in one mounted widget is instantly reflected in every other one, and
// there's exactly one writer to Firestore regardless of how many widgets
// are on the dashboard at once.
let todos: Todo[] = [];
let isLoading = true;
let hasStartedLoad = false;
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

function ensureLoaded() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;

  (async () => {
    const syncedTasks = await readTasksFromSyncFolder();
    todos = syncedTasks ?? DEFAULT_TASKS;
    isLoading = false;
    notify();
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
  todos = todos.map((todo) =>
    todo.id === id ? { ...todo, stage: getNextStage(todo.stage) } : todo
  );
  notify();
  persist();
}

function updateTodo(updatedTodo: Todo) {
  todos = todos.map((todo) => (todo.id === updatedTodo.id ? updatedTodo : todo));
  notify();
  persist();
}

function addTodo(todo: Todo) {
  todos = [...todos, todo];
  notify();
  persist();
}

export function useTodos() {
  useEffect(() => {
    ensureLoaded();
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
