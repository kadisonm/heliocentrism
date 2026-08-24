'use client';

import { useSyncExternalStore } from 'react';
import type { Subtask, Task } from '../../../lib/types';

// Tag carried by a task/subtask row's own useSortable registration (see
// useSortableDragBindings) — lets a drag handler tell what's being dragged
// (and, for a subtask, which task it currently belongs to) without a
// separate lookup.
export type TaskDragData =
  | { type: 'task'; taskId: string; listId: string }
  | { type: 'subtask'; subtaskId: string; parentTaskId: string };

// Tag carried by a container's own useDroppable registration — a list's
// (possibly empty) task area, or a task's (possibly empty) subtask area.
export type DropContainerData = { type: 'list'; listId: string } | { type: 'subtasks'; taskId: string };

export function listContainerId(listId: string): string {
  return `list:${listId}`;
}

export function subtasksContainerId(taskId: string): string {
  return `subtasks:${taskId}`;
}

// Ephemeral, never-persisted drag state, shared across every mounted Task
// List widget instance via one module singleton (same useSyncExternalStore
// idiom as useTaskLists.ts) — sibling widget instances can't share local
// React state directly, so this is what lets one widget know a drag
// started in a DIFFERENT widget is currently hovering over it.
export type TaskDragState = {
  activeId: string | null;
  activeType: 'task' | 'subtask' | null;
  activeRecord: Task | Subtask | null;
  previewContainerId: string | null;
  isValidDrop: boolean;
};

const idleState: TaskDragState = {
  activeId: null,
  activeType: null,
  activeRecord: null,
  previewContainerId: null,
  isValidDrop: true,
};

let state: TaskDragState = idleState;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return idleState;
}

export function startTaskDrag(id: string, type: 'task' | 'subtask', record: Task | Subtask) {
  state = { ...idleState, activeId: id, activeType: type, activeRecord: record };
  notify();
}

export function setDragPreview(containerId: string | null, isValidDrop: boolean) {
  if (state.previewContainerId === containerId && state.isValidDrop === isValidDrop) return;
  state = { ...state, previewContainerId: containerId, isValidDrop };
  notify();
}

export function endTaskDrag() {
  state = idleState;
  notify();
}

export function useTaskDrag(): TaskDragState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
