'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_TODOS } from '../../lib/data';
import { readTodos, writeTodos } from '../../lib/firebaseSync';
import { cycleSubtaskStage, cycleTaskStage } from '../../lib/taskCascade';
import type { Todo, TodoStage } from '../../lib/types';

// Module-level singleton, mirroring src/components/routines/useRoutineTasks.ts
// — every widget instance sharing the same in-memory copy, one Firestore
// writer. Unlike routine tasks, todos have no recurrence/reset-time concept,
// so there's no reset-check timer here.
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

function normalizeTodo(todo: Todo): Todo {
  const now = new Date().toISOString();
  return {
    ...todo,
    subtasks: todo.subtasks ?? [],
    createdAt: todo.createdAt ?? now,
    updatedAt: todo.updatedAt ?? now,
    completedAt: todo.completedAt ?? null,
  };
}

function ensureLoaded() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;

  (async () => {
    const synced = await readTodos();
    todos = (synced ?? DEFAULT_TODOS).map(normalizeTodo);
    isLoading = false;
    notify();
  })();
}

function persist() {
  if (todos.length > 0) {
    writeTodos(todos);
  }
}

function withStageTimestamps<T extends { stage: TodoStage; completedAt: string | null }>(
  previousStage: TodoStage,
  updated: T,
  now: string
): T {
  if (previousStage === updated.stage) return updated;
  return { ...updated, completedAt: updated.stage === 2 ? now : null };
}

function updateTodoStage(id: string) {
  const now = new Date().toISOString();
  todos = todos.map((todo) => {
    if (todo.id !== id) return todo;
    const cycled = cycleTaskStage(todo);
    return { ...withStageTimestamps(todo.stage, cycled, now), updatedAt: now };
  });
  notify();
  persist();
}

function updateSubtaskStage(todoId: string, subtaskId: string) {
  const now = new Date().toISOString();
  todos = todos.map((todo) => {
    if (todo.id !== todoId) return todo;
    const cycled = cycleSubtaskStage(todo, subtaskId);
    return { ...withStageTimestamps(todo.stage, cycled, now), updatedAt: now };
  });
  notify();
  persist();
}

function updateTodo(updatedTodo: Todo) {
  const now = new Date().toISOString();
  todos = todos.map((todo) => {
    if (todo.id !== updatedTodo.id) return todo;
    return { ...withStageTimestamps(todo.stage, updatedTodo, now), updatedAt: now };
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

export function useTodos() {
  useEffect(() => {
    ensureLoaded();
  }, []);

  const currentTodos = useSyncExternalStore(subscribe, getTodosSnapshot, () => DEFAULT_TODOS);
  const currentIsLoading = useSyncExternalStore(subscribe, getIsLoadingSnapshot, () => true);

  return {
    todos: currentTodos,
    isLoading: currentIsLoading,
    updateTodoStage,
    updateSubtaskStage,
    updateTodo,
    addTodo,
  };
}
