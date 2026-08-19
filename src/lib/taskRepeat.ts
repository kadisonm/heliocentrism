import { deriveStageFromSubtasks, isTaskDone } from './taskCascade';
import type { RepeatUnit, Subtask, Task, TaskRepeat, TaskStageDef } from './types';

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function parseAnchor(anchor: string): { year: number; month: number; day: number } | null {
  const [year, month, day] = anchor.split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return { year, month: month - 1, day };
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour: Number.isNaN(hour) ? 0 : hour, minute: Number.isNaN(minute) ? 0 : minute };
}

function formatDatePart(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Steps a (year, month, day) forward by `steps` repeat-interval-sized units,
// always from the SAME starting point passed in — never compounding off a
// previously-clamped result. That's what avoids the classic Jan 31 -> Feb 28
// -> Mar 28 drift bug: March must independently re-clamp from 31, landing on
// the 31st, not compound off February's 28th.
function stepDate(
  year: number,
  month: number,
  day: number,
  unit: RepeatUnit,
  interval: number,
  steps: number
): { year: number; month: number; day: number } {
  if (unit === 'day') {
    const d = new Date(year, month, day + steps * interval);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  if (unit === 'week') {
    const d = new Date(year, month, day + steps * interval * 7);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  if (unit === 'month') {
    const totalMonths = month + steps * interval;
    const y = year + Math.floor(totalMonths / 12);
    const m = ((totalMonths % 12) + 12) % 12;
    return { year: y, month: m, day: Math.min(day, daysInMonth(y, m)) };
  }
  // year
  const y = year + steps * interval;
  return { year: y, month, day: Math.min(day, daysInMonth(y, month)) };
}

// The k-th scheduled occurrence (k = 0 is the anchor's own slot). Always
// built via calendar-component `new Date(year, month, day, hh, mm)` — never
// raw millisecond addition — so DST transitions don't shift the local hour.
function occurrenceDate(repeat: TaskRepeat, k: number): Date {
  const anchor = parseAnchor(repeat.anchor);
  if (!anchor) return new Date(NaN);

  const { hour, minute } = parseTime(repeat.time);
  const { year, month, day } = stepDate(anchor.year, anchor.month, anchor.day, repeat.unit, repeat.interval, k);
  return new Date(year, month, day, hour, minute, 0, 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Largest k such that occurrenceDate(repeat, k) <= targetDate, or -1 if even
// k = 0 is after targetDate. Uses a cheap initial guess (closed-form for
// day/week; whole-month-count division for month/year) then a small bounded
// correction loop — never an unbounded scan from the anchor.
function estimateOccurrenceIndex(repeat: TaskRepeat, targetDate: Date): number {
  const anchor0 = occurrenceDate(repeat, 0);
  if (Number.isNaN(anchor0.getTime()) || Number.isNaN(targetDate.getTime())) return -1;

  let guess: number;
  if (repeat.unit === 'day' || repeat.unit === 'week') {
    const unitDays = repeat.unit === 'day' ? 1 : 7;
    const msPerStep = unitDays * repeat.interval * DAY_MS;
    guess = Math.floor((targetDate.getTime() - anchor0.getTime()) / msPerStep);
  } else {
    const anchor = parseAnchor(repeat.anchor)!;
    const monthsPerStep = repeat.unit === 'month' ? repeat.interval : repeat.interval * 12;
    const targetMonthsFromAnchor =
      (targetDate.getFullYear() - anchor.year) * 12 + (targetDate.getMonth() - anchor.month);
    guess = Math.floor(targetMonthsFromAnchor / monthsPerStep);
  }

  while (occurrenceDate(repeat, guess).getTime() > targetDate.getTime()) guess -= 1;
  while (occurrenceDate(repeat, guess + 1).getTime() <= targetDate.getTime()) guess += 1;
  return guess;
}

// Highest occurrence index the end condition still permits. Infinity for
// 'never'; count - 1 for 'afterOccurrences' (0-indexed, so `count` total
// valid occurrences); estimated against the end date's end-of-day for
// 'onDate' (inclusive of its whole day).
function getMaxValidOccurrenceIndex(repeat: TaskRepeat): number {
  if (repeat.end.type === 'never') return Infinity;
  if (repeat.end.type === 'afterOccurrences') return Math.max(0, repeat.end.count - 1);

  const endDate = new Date(repeat.end.date);
  if (Number.isNaN(endDate.getTime())) return -1;
  endDate.setHours(23, 59, 59, 999);
  return estimateOccurrenceIndex(repeat, endDate);
}

export function getMostRecentOccurrence(repeat: TaskRepeat, now: Date = new Date()): Date | null {
  const k = estimateOccurrenceIndex(repeat, now);
  if (k < 0) return null;
  const maxK = getMaxValidOccurrenceIndex(repeat);
  if (maxK < 0) return null;
  return occurrenceDate(repeat, Math.min(k, maxK));
}

export function getNextOccurrence(repeat: TaskRepeat, now: Date = new Date()): Date | null {
  const k = estimateOccurrenceIndex(repeat, now) + 1;
  const maxK = getMaxValidOccurrenceIndex(repeat);
  if (k > maxK) return null;
  return occurrenceDate(repeat, Math.max(k, 0));
}

// A completed task is stale — and should reset back to not-done — once its
// repeat schedule's most recent boundary has passed since it was completed
// (or if we don't know when it was completed at all, e.g. pre-existing data).
export function shouldResetTask(task: Task, now: Date = new Date()): boolean {
  if (!task.repeat || !isTaskDone(task)) return false;

  const boundary = getMostRecentOccurrence(task.repeat, now);
  if (!boundary) return false;
  if (!task.completedAt) return true;

  return new Date(task.completedAt) < boundary;
}

// Steps `due`'s date forward — always from its own original date, using the
// same clamping rule as occurrenceDate — until it lands on/after today.
// Preserves due's own time-of-day verbatim; only the date moves. A single
// call always fully catches up even after several missed cycles.
export function advanceDueDate(due: string, repeat: TaskRepeat, now: Date = new Date()): string {
  const [datePart, timePart = ''] = due.split('T');
  const parsed = parseAnchor(datePart);
  if (!parsed) return due;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  let steps = 1;
  let next = stepDate(parsed.year, parsed.month, parsed.day, repeat.unit, repeat.interval, steps);
  while (new Date(next.year, next.month, next.day).getTime() < today) {
    steps += 1;
    next = stepDate(parsed.year, parsed.month, parsed.day, repeat.unit, repeat.interval, steps);
  }

  const dateStr = formatDatePart(next.year, next.month, next.day);
  return timePart ? `${dateStr}T${timePart}` : dateStr;
}

// Mirrors shouldResetTask, but for one subtask within a task — checked
// against the PARENT's stages array (a subtask has no stages of its own)
// and the subtask's own completedAt/repeat. Entirely independent of
// whether the parent itself has a repeat or resets on this tick.
export function shouldResetSubtask(
  subtask: Subtask,
  parentStages: TaskStageDef[],
  now: Date = new Date()
): boolean {
  if (!subtask.repeat || !isTaskDone({ stage: subtask.stage, stages: parentStages })) return false;

  const boundary = getMostRecentOccurrence(subtask.repeat, now);
  if (!boundary) return false;
  if (!subtask.completedAt) return true;

  return new Date(subtask.completedAt) < boundary;
}

// Transform applied to one subtask, either because its own repeat is due
// (shouldResetSubtask) or because its parent reset as a whole (which
// forces every subtask back to its start stage unconditionally — see
// resetRepeatingTask below). due only advances via the subtask's OWN
// repeat, same rule as a task's own due.
export function resetSubtaskState(subtask: Subtask, now: Date = new Date()): Subtask {
  return {
    ...subtask,
    stage: 0,
    completedAt: null,
    due: subtask.due && subtask.repeat ? advanceDueDate(subtask.due, subtask.repeat, now) : subtask.due,
  };
}

// Transform applied when shouldResetTask is true: stage/completion clear,
// every subtask resets too (mirroring the old routine-reset behavior, now
// also clearing each subtask's own completedAt and advancing its own due
// if it has its own repeat — see resetSubtaskState), and due (if set)
// catches up to the current cycle. repeat itself (anchor included) is left
// completely untouched — the schedule's phase never moves.
export function resetRepeatingTask(task: Task, now: Date = new Date()): Task {
  return {
    ...task,
    stage: 0,
    completedAt: null,
    subtasks: task.subtasks.map((subtask) => resetSubtaskState(subtask, now)),
    due: task.due && task.repeat ? advanceDueDate(task.due, task.repeat, now) : task.due,
    updatedAt: now.toISOString(),
  };
}

// Independent of resetRepeatingTask above — resets any subtask whose OWN
// repeat schedule is due, regardless of whether the parent itself has a
// repeat or reset this tick, and re-derives the parent's stage from the
// resulting subtask stages if anything changed (same "lowest incomplete
// subtask" rule cycleSubtaskStage already uses for a manual click). Call
// this AFTER any parent-level resetRepeatingTask has already run for this
// task on the same tick — shouldResetSubtask's isTaskDone gate then
// naturally skips any subtask the blanket reset just touched, since it's
// no longer "done" at stage 0.
export function resetDueSubtasks(task: Task, now: Date = new Date()): { task: Task; changed: boolean } {
  let changed = false;
  const subtasks = task.subtasks.map((subtask) => {
    if (!shouldResetSubtask(subtask, task.stages, now)) return subtask;
    changed = true;
    return resetSubtaskState(subtask, now);
  });

  if (!changed) return { task, changed: false };

  return {
    task: { ...task, subtasks, stage: deriveStageFromSubtasks(subtasks, task.stage), updatedAt: now.toISOString() },
    changed: true,
  };
}

export function formatNextOccurrence(repeat: TaskRepeat, now: Date = new Date()): string {
  const next = getNextOccurrence(repeat, now);
  if (!next) return 'Repeat ended';

  return next.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function createDefaultRepeat(now: Date = new Date()): TaskRepeat {
  return {
    interval: 1,
    unit: 'week',
    time: '09:00',
    anchor: formatDatePart(now.getFullYear(), now.getMonth(), now.getDate()),
    end: { type: 'never' },
  };
}
