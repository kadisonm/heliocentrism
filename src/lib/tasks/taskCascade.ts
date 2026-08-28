import type { Subtask, Task, TaskStageDef } from '../types';

export function getNextStageIndex(current: number, stagesLength: number): number {
  return (current + 1) % stagesLength;
}

export function deriveStageFromSubtasks(subtasks: Subtask[], fallback: number): number {
  if (subtasks.length === 0) return fallback;
  return Math.min(...subtasks.map((s) => s.stage));
}

// Replaces every scattered `stage === 2` / `stage !== 2` check — "done" is
// whatever the last stage in this task's own list is.
export function isTaskDone(task: { stage: number; stages: TaskStageDef[] }): boolean {
  return task.stage === task.stages.length - 1;
}

type CascadeResult = { task: Task; subtasks: Subtask[] };

// Clicking the parent: advance its own stage by one (wrapping), then bring
// any subtask that's BEHIND the new stage up to meet it. `subtasks` must
// already be filtered to this task's own children (parentId === task.id).
export function cycleTaskStage(task: Task, subtasks: Subtask[]): CascadeResult {
  const nextStage = getNextStageIndex(task.stage, task.stages.length);
  if (subtasks.length === 0) return { task: { ...task, stage: nextStage }, subtasks };
  return {
    task: { ...task, stage: nextStage },
    subtasks: subtasks.map((subtask) => (subtask.stage < nextStage ? { ...subtask, stage: nextStage } : subtask)),
  };
}

// Clicking a subtask: advance just that one (wrapping), then re-derive the
// parent as the minimum stage across all subtasks ("lowest incomplete
// subtask"). `subtasks` must already be filtered to this task's own children.
export function cycleSubtaskStage(task: Task, subtasks: Subtask[], subtaskId: string): CascadeResult {
  const cycledSubtasks = subtasks.map((subtask) =>
    subtask.id === subtaskId
      ? { ...subtask, stage: getNextStageIndex(subtask.stage, task.stages.length) }
      : subtask
  );
  return { task: { ...task, stage: deriveStageFromSubtasks(cycledSubtasks, task.stage) }, subtasks: cycledSubtasks };
}

export function createDefaultStages(): TaskStageDef[] {
  return [
    { id: crypto.randomUUID(), name: 'Todo', color: 'none' },
    { id: crypto.randomUUID(), name: 'Done', color: 'success', icon: 'Check' },
  ];
}

export function createKanbanStages(): TaskStageDef[] {
  return [
    { id: crypto.randomUUID(), name: 'Todo', color: 'none' },
    { id: crypto.randomUUID(), name: 'Doing', color: 'warning', icon: 'Dot' },
    { id: crypto.randomUUID(), name: 'Done', color: 'success', icon: 'Check' },
  ];
}

export type BuiltInStagePreset = {
  id: string;
  name: string;
  createStages: () => TaskStageDef[];
};

// Pure code constants, never stored/synced — "cannot be deleted" is
// structural (the preset-delete UI simply never offers these), not a flag.
export const BUILT_IN_STAGE_PRESETS: BuiltInStagePreset[] = [
  { id: 'normal', name: 'Normal', createStages: createDefaultStages },
  { id: 'kanban', name: 'Kanban', createStages: createKanbanStages },
];

// Keeps a task's own stage index, and every subtask's, in bounds after
// `stages` shrinks (the editor can remove middle stages). Safe/idempotent to
// call unconditionally on every save. `subtasks` must already be filtered to
// this task's own children.
export function clampTaskStages(task: Task, subtasks: Subtask[]): CascadeResult {
  const maxIndex = task.stages.length - 1;
  return {
    task: { ...task, stage: Math.min(task.stage, maxIndex) },
    subtasks: subtasks.map((subtask) => ({ ...subtask, stage: Math.min(subtask.stage, maxIndex) })),
  };
}

// Compares done-ness before vs. after, not raw stage numbers — a stages
// list shrinking can make the SAME numeric index mean "done" when it
// didn't before, which a raw number comparison would miss.
export function withStageTimestamps<T extends { stage: number; stages: TaskStageDef[]; completedAt: string | null }>(
  wasDone: boolean,
  updated: T,
  now: string
): T {
  const isDone = isTaskDone(updated);
  if (wasDone === isDone) return updated;
  return { ...updated, completedAt: isDone ? now : null };
}

// Mirrors withStageTimestamps for one subtask. Needed so a subtask with its
// own repeat has an accurate completedAt to check against (shouldResetSubtask)
// instead of reading null and being treated as immediately stale.
export function withSubtaskCompletedAt(wasDone: boolean, subtask: Subtask, stages: TaskStageDef[], now: string): Subtask {
  const isDone = isTaskDone({ stage: subtask.stage, stages });
  if (wasDone === isDone) return subtask;
  return { ...subtask, completedAt: isDone ? now : null };
}

// Replaces just the given task's own subtasks within the flat `subtasks`
// array, leaving every other task's subtasks (and any non-matching id
// within `updated`, which shouldn't happen) untouched.
export function replaceSubtasks(subtasks: Subtask[], updated: Subtask[]): Subtask[] {
  const updatedById = new Map(updated.map((s) => [s.id, s]));
  return subtasks.map((subtask) => updatedById.get(subtask.id) ?? subtask);
}

