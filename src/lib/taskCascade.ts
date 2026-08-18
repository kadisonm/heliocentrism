import type { Subtask, TaskStageDef } from './types';

export function getNextStageIndex(current: number, stagesLength: number): number {
  return (current + 1) % stagesLength;
}

export function deriveStageFromSubtasks(subtasks: Subtask[], fallback: number): number {
  if (subtasks.length === 0) return fallback;
  return Math.min(...subtasks.map((s) => s.stage));
}

type Cascadable = { stage: number; stages: TaskStageDef[]; subtasks: Subtask[] };

// Clicking the parent: advance its own stage by one (wrapping), then bring
// any subtask that's BEHIND the new stage up to meet it — subtasks already
// at or past it are left untouched.
export function cycleTaskStage<T extends Cascadable>(task: T): T {
  const nextStage = getNextStageIndex(task.stage, task.stages.length);
  if (task.subtasks.length === 0) return { ...task, stage: nextStage };
  const subtasks = task.subtasks.map((subtask) =>
    subtask.stage < nextStage ? { ...subtask, stage: nextStage } : subtask
  );
  return { ...task, subtasks, stage: nextStage };
}

// Clicking a subtask: advance just that one (wrapping), then re-derive the
// parent as the minimum stage across all subtasks ("lowest incomplete
// subtask").
export function cycleSubtaskStage<T extends Cascadable>(task: T, subtaskId: string): T {
  const subtasks = task.subtasks.map((subtask) =>
    subtask.id === subtaskId
      ? { ...subtask, stage: getNextStageIndex(subtask.stage, task.stages.length) }
      : subtask
  );
  return { ...task, subtasks, stage: deriveStageFromSubtasks(subtasks, task.stage) };
}

// Replaces every scattered `stage === 2` / `stage !== 2` check — "done" is
// whatever the last stage in this task's own list is.
export function isTaskDone(task: { stage: number; stages: TaskStageDef[] }): boolean {
  return task.stage === task.stages.length - 1;
}

export function createDefaultStages(): TaskStageDef[] {
  return [
    { id: crypto.randomUUID(), name: '', color: 'none' },
    { id: crypto.randomUUID(), name: 'done', color: 'success' },
  ];
}

// Keeps a task's own stage index, and every subtask's, in bounds after
// `stages` shrinks (the editor can remove middle stages). Safe/idempotent
// to call unconditionally on every save.
export function clampTaskStages<T extends Cascadable>(task: T): T {
  const maxIndex = task.stages.length - 1;
  return {
    ...task,
    stage: Math.min(task.stage, maxIndex),
    subtasks: task.subtasks.map((subtask) => ({ ...subtask, stage: Math.min(subtask.stage, maxIndex) })),
  };
}
