import { createDefaultStages } from './taskCascade';
import type { Subtask, Task } from '../types';

export function normalizeTask(task: Task): Task {
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

export function normalizeSubtask(subtask: Subtask): Subtask {
  return {
    ...subtask,
    order: subtask.order ?? 0,
    due: subtask.due ?? '',
    completedAt: subtask.completedAt ?? null,
  };
}
