import type { Subtask, TodoStage } from './types';

export function getNextStage(stage: TodoStage): TodoStage {
  return ((stage + 1) % 3) as TodoStage;
}

// A task's own stage, derived from its subtasks: all done -> done; any not
// "to do" -> in progress; otherwise to do. Only meaningful when there's at
// least one subtask — callers should leave a subtask-less task's stage alone.
export function deriveStageFromSubtasks(subtasks: Subtask[]): TodoStage {
  if (subtasks.length === 0) return 0;
  if (subtasks.every((subtask) => subtask.stage === 2)) return 2;
  if (subtasks.some((subtask) => subtask.stage !== 0)) return 1;
  return 0;
}

type Cascadable = {
  stage: TodoStage;
  subtasks: Subtask[];
};

// Cycles a task's stage. Once a task has subtasks, its own stage is always
// derived from them (see deriveStageFromSubtasks) — so "clicking" a task
// with subtasks cascades the new stage onto every one of them instead of
// just setting the task's own field, and the derived stage trivially ends
// up matching.
export function cycleTaskStage<T extends Cascadable>(task: T): T {
  const nextStage = getNextStage(task.stage);

  if (task.subtasks.length === 0) {
    return { ...task, stage: nextStage };
  }

  const subtasks = task.subtasks.map((subtask) => ({ ...subtask, stage: nextStage }));
  return { ...task, subtasks, stage: nextStage };
}

// Cycles one subtask, then re-derives the parent task's stage from all of them.
export function cycleSubtaskStage<T extends Cascadable>(task: T, subtaskId: string): T {
  const subtasks = task.subtasks.map((subtask) =>
    subtask.id === subtaskId ? { ...subtask, stage: getNextStage(subtask.stage) } : subtask
  );
  return { ...task, subtasks, stage: deriveStageFromSubtasks(subtasks) };
}
