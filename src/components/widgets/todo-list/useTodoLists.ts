'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_TODO_LISTS } from '../../../lib/data';
import { readTodoLists, writeTodoLists } from '../../../lib/firebaseSync';
import { reorderWithinGroup } from '../../../lib/reorder';
import { cycleSubtaskStage, cycleTaskStage } from '../../../lib/taskCascade';
import type { Todo, TodoList, TodoStage } from '../../../lib/types';

// Module-level singleton, mirroring src/components/widgets/routines/useRoutineTasks.ts
// — every widget instance sharing the same in-memory copy, one Firestore
// writer. Unlike routine tasks, todos have no recurrence/reset-time concept,
// so there's no reset-check timer here.
let todoLists: TodoList[] = [];
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

function getTodoListsSnapshot() {
  return todoLists;
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

function normalizeTodoList(list: TodoList): TodoList {
  return { ...list, todos: (list.todos ?? []).map(normalizeTodo) };
}

function ensureLoaded() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;

  (async () => {
    const synced = await readTodoLists();
    todoLists = (synced ?? DEFAULT_TODO_LISTS).map(normalizeTodoList);
    isLoading = false;
    notify();
  })();
}

function persist() {
  if (todoLists.length > 0) {
    writeTodoLists(todoLists);
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

function updateList(listId: string, updater: (list: TodoList) => TodoList) {
  todoLists = todoLists.map((list) => (list.id === listId ? updater(list) : list));
  notify();
  persist();
}

function updateTodoStage(listId: string, todoId: string) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    todos: list.todos.map((todo) => {
      if (todo.id !== todoId) return todo;
      const cycled = cycleTaskStage(todo);
      return { ...withStageTimestamps(todo.stage, cycled, now), updatedAt: now };
    }),
  }));
}

function updateSubtaskStage(listId: string, todoId: string, subtaskId: string) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    todos: list.todos.map((todo) => {
      if (todo.id !== todoId) return todo;
      const cycled = cycleSubtaskStage(todo, subtaskId);
      return { ...withStageTimestamps(todo.stage, cycled, now), updatedAt: now };
    }),
  }));
}

function updateTodo(listId: string, updatedTodo: Todo) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    todos: list.todos.map((todo) =>
      todo.id === updatedTodo.id
        ? { ...withStageTimestamps(todo.stage, updatedTodo, now), updatedAt: now }
        : todo
    ),
  }));
}

function deleteTodo(listId: string, todoId: string) {
  updateList(listId, (list) => ({
    ...list,
    todos: list.todos.filter((todo) => todo.id !== todoId),
  }));
}

function addTodo(listId: string, input: Todo) {
  const now = new Date().toISOString();
  const todo: Todo = {
    ...input,
    createdAt: now,
    updatedAt: now,
    completedAt: input.stage === 2 ? now : null,
  };
  updateList(listId, (list) => ({ ...list, todos: [...list.todos, todo] }));
}

// `predicate` should match whatever the caller currently has visible (e.g.
// filtered by the show-completed toggle) so reordering only reshuffles
// those todos relative to each other, leaving any hidden todo's position
// in the list's backing array untouched.
function reorderTodos(
  listId: string,
  predicate: (todo: Todo) => boolean,
  activeId: string,
  overId: string
) {
  updateList(listId, (list) => ({
    ...list,
    todos: reorderWithinGroup(list.todos, predicate, activeId, overId, (todo) => todo.id),
  }));
}

function reorderSubtasks(listId: string, todoId: string, activeId: string, overId: string) {
  const now = new Date().toISOString();
  updateList(listId, (list) => ({
    ...list,
    todos: list.todos.map((todo) =>
      todo.id === todoId
        ? {
            ...todo,
            subtasks: reorderWithinGroup(todo.subtasks, () => true, activeId, overId, (s) => s.id),
            updatedAt: now,
          }
        : todo
    ),
  }));
}

function createList(name: string): string {
  const id = crypto.randomUUID();
  todoLists = [...todoLists, { id, name, todos: [] }];
  notify();
  persist();
  return id;
}

export function useTodoLists() {
  useEffect(() => {
    ensureLoaded();
  }, []);

  const currentTodoLists = useSyncExternalStore(
    subscribe,
    getTodoListsSnapshot,
    () => DEFAULT_TODO_LISTS
  );
  const currentIsLoading = useSyncExternalStore(subscribe, getIsLoadingSnapshot, () => true);

  return {
    todoLists: currentTodoLists,
    isLoading: currentIsLoading,
    createList,
    addTodo,
    updateTodoStage,
    updateSubtaskStage,
    updateTodo,
    deleteTodo,
    reorderTodos,
    reorderSubtasks,
  };
}
