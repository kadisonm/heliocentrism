import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { DEFAULT_SUBTASKS, DEFAULT_TASKS, DEFAULT_TASK_LISTS } from '../data';
import { readSubtasks, readTaskLists, readTasks } from '../firebase/firebaseSync';
import { nextOrder } from '../tasks/reorder';
import {
  cycleSubtaskStage,
  cycleTaskStage,
  isTaskDone,
  replaceSubtasks,
  withStageTimestamps,
  withSubtaskCompletedAt,
} from '../tasks/taskCascade';
import { applySubtaskGroups, applyTaskGroups, groupedSubtaskIds, groupedTaskIds } from '../tasks/taskDragReorder';
import { normalizeSubtask, normalizeTask } from '../tasks/taskNormalize';
import { resetDueSubtasks, resetRepeatingTask, shouldResetTask } from '../tasks/taskRepeat';
import type { Subtask, Task, TaskList, TaskRepeat, TaskStageDef } from '../types';
import type { AppDispatch, RootState } from './store';

export type EditingRow = { type: 'task'; taskId: string } | { type: 'subtask'; taskId: string; subtaskId: string };

export type TaskListsState = {
  taskLists: TaskList[];
  tasks: Task[];
  subtasks: Subtask[];
  isLoading: boolean;
  editingRow: EditingRow | null;
  draggingId: string | null;
  droppingId: string | null;
  // Snapshot of `tasks` taken at drag start, restored if the drag is
  // canceled — replaces the old module-closure `taskDragSnapshot` var with
  // plain (serializable) slice state.
  dragSnapshot: Task[] | null;
};

const initialState: TaskListsState = {
  taskLists: DEFAULT_TASK_LISTS,
  tasks: DEFAULT_TASKS,
  subtasks: DEFAULT_SUBTASKS,
  isLoading: true,
  editingRow: null,
  draggingId: null,
  droppingId: null,
  dragSnapshot: null,
};

let hasStartedLoad = false;

export const loadTaskLists = createAsyncThunk('taskLists/load', async () => {
  const [syncedLists, syncedTasks, syncedSubtasks] = await Promise.all([readTaskLists(), readTasks(), readSubtasks()]);
  return {
    taskLists: syncedLists ?? DEFAULT_TASK_LISTS,
    tasks: (syncedTasks ?? DEFAULT_TASKS).map(normalizeTask),
    subtasks: (syncedSubtasks ?? DEFAULT_SUBTASKS).map(normalizeSubtask),
  };
});

export function ensureTaskListsLoaded(dispatch: AppDispatch) {
  if (hasStartedLoad) return;
  hasStartedLoad = true;
  dispatch(loadTaskLists()).then(() => dispatch(runRepeatResetCheck()));
}

// Resets any completed repeating task whose schedule has passed (see
// resetRepeatingTask), plus any subtask whose OWN repeat schedule has
// passed regardless of the parent (see resetDueSubtasks).
export const runRepeatResetCheck = createAsyncThunk<
  { tasks: Task[]; subtasks: Subtask[] } | null,
  void,
  { state: RootState }
>('taskLists/runRepeatResetCheck', (_, { getState }) => {
  const { tasks, subtasks } = getState().taskLists;
  if (tasks.length === 0) return null;

  const now = new Date();
  let changed = false;
  const subtaskUpdates = new Map<string, Subtask>();

  const nextTasks = tasks.map((task) => {
    const taskSubtasks = subtasks.filter((s) => s.parentId === task.id);
    let current = task;
    let currentSubtasks = taskSubtasks;

    if (shouldResetTask(current, now)) {
      const result = resetRepeatingTask(current, currentSubtasks, now);
      current = result.task;
      currentSubtasks = result.subtasks;
      changed = true;
    }

    const subtaskResult = resetDueSubtasks(current, currentSubtasks, now);
    if (subtaskResult.changed) {
      current = subtaskResult.task;
      currentSubtasks = subtaskResult.subtasks;
      changed = true;
    }

    for (const subtask of currentSubtasks) subtaskUpdates.set(subtask.id, subtask);
    return current;
  });

  if (!changed) return null;
  return { tasks: nextTasks, subtasks: subtasks.map((s) => subtaskUpdates.get(s.id) ?? s) };
});

const taskListsSlice = createSlice({
  name: 'taskLists',
  initialState,
  reducers: {
    setEditingRow: (state, action: PayloadAction<EditingRow | null>) => {
      state.editingRow = action.payload;
    },

    // Gesture-lock claim/release (see persistenceMiddleware.ts) is a side
    // effect keyed off this same action, not done here — reducers stay pure.
    setDraggingId: (state, action: PayloadAction<string | null>) => {
      state.draggingId = action.payload;
    },

    setDroppingId: (state, action: PayloadAction<string | null>) => {
      state.droppingId = action.payload;
    },

    updateTaskStage: (state, action: PayloadAction<{ taskId: string }>) => {
      const now = new Date().toISOString();
      const task = state.tasks.find((t) => t.id === action.payload.taskId);
      if (!task) return;
      const taskSubtasks = state.subtasks.filter((s) => s.parentId === task.id);
      const wasDone = isTaskDone(task);
      const subtaskWasDone = new Map(taskSubtasks.map((s) => [s.id, isTaskDone({ stage: s.stage, stages: task.stages })]));

      const cycled = cycleTaskStage(task, taskSubtasks);
      const stampedSubtasks = cycled.subtasks.map((s) =>
        withSubtaskCompletedAt(subtaskWasDone.get(s.id) ?? false, s, cycled.task.stages, now)
      );

      state.tasks = state.tasks.map((t) =>
        t.id === task.id ? { ...withStageTimestamps(wasDone, cycled.task, now), updatedAt: now } : t
      );
      state.subtasks = replaceSubtasks(state.subtasks, stampedSubtasks);
    },

    updateSubtaskStage: (state, action: PayloadAction<{ subtaskId: string }>) => {
      const now = new Date().toISOString();
      const subtask = state.subtasks.find((s) => s.id === action.payload.subtaskId);
      if (!subtask) return;
      const task = state.tasks.find((t) => t.id === subtask.parentId);
      if (!task) return;
      const taskSubtasks = state.subtasks.filter((s) => s.parentId === task.id);
      const wasDone = isTaskDone(task);
      const previousSubtaskDone = isTaskDone({ stage: subtask.stage, stages: task.stages });

      const cycled = cycleSubtaskStage(task, taskSubtasks, subtask.id);
      const stampedSubtasks = cycled.subtasks.map((s) =>
        s.id === subtask.id ? withSubtaskCompletedAt(previousSubtaskDone, s, cycled.task.stages, now) : s
      );

      state.tasks = state.tasks.map((t) =>
        t.id === task.id ? { ...withStageTimestamps(wasDone, cycled.task, now), updatedAt: now } : t
      );
      state.subtasks = replaceSubtasks(state.subtasks, stampedSubtasks);
    },

    // Wholesale-replaces a task (inline-edit and due/repeat quick-edit saves) —
    // none of those touch `stage`, so no cascade/timestamp bookkeeping needed
    // here. Stage-list edits go through updateTaskStages instead.
    updateTask: (state, action: PayloadAction<Task>) => {
      const now = new Date().toISOString();
      const updatedTask = action.payload;
      state.tasks = state.tasks.map((task) => (task.id === updatedTask.id ? { ...updatedTask, updatedAt: now } : task));
    },

    // A task's stages list shrinking can turn a subtask's (and the task's own)
    // existing stage index into "done" when it wasn't before — clamps both
    // and stamps completedAt for anything whose done-ness flipped as a result.
    updateTaskStages: (state, action: PayloadAction<{ taskId: string; stages: TaskStageDef[] }>) => {
      const { taskId, stages } = action.payload;
      const now = new Date().toISOString();
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;
      const taskSubtasks = state.subtasks.filter((s) => s.parentId === taskId);
      const wasDone = isTaskDone(task);
      const subtaskWasDone = new Map(taskSubtasks.map((s) => [s.id, isTaskDone({ stage: s.stage, stages: task.stages })]));

      const maxIndex = stages.length - 1;
      const clampedTask = { ...task, stages, stage: Math.min(task.stage, maxIndex) };
      const clampedSubtasks = taskSubtasks.map((s) => ({ ...s, stage: Math.min(s.stage, maxIndex) }));
      const stampedSubtasks = clampedSubtasks.map((s) =>
        withSubtaskCompletedAt(subtaskWasDone.get(s.id) ?? false, s, stages, now)
      );

      state.tasks = state.tasks.map((t) =>
        t.id === taskId ? { ...withStageTimestamps(wasDone, clampedTask, now), updatedAt: now } : t
      );
      state.subtasks = replaceSubtasks(state.subtasks, stampedSubtasks);
    },

    deleteTask: (state, action: PayloadAction<{ taskId: string }>) => {
      const { taskId } = action.payload;
      state.tasks = state.tasks.filter((task) => task.id !== taskId);
      state.subtasks = state.subtasks.filter((subtask) => subtask.parentId !== taskId);
    },

    // `newSubtasks` lets TaskModal's "add task" form submit subtasks created
    // in the same draft in one go (each draft's id already client-generated),
    // landing in one action instead of N+1 separate dispatches. The task/
    // subtasks are fully built before this is dispatched — see the `addTask`
    // thunk below, which is what callers actually use.
    addTaskFromDraft: (state, action: PayloadAction<{ task: Task; newSubtasks: Subtask[] }>) => {
      state.tasks.push(action.payload.task);
      state.subtasks.push(...action.payload.newSubtasks);
    },

    addSubtask: (
      state,
      action: PayloadAction<{ taskId: string; input: { title: string; description?: string; due: string; repeat?: TaskRepeat } }>
    ) => {
      const { taskId, input } = action.payload;
      const now = new Date().toISOString();
      const siblings = state.subtasks.filter((s) => s.parentId === taskId);
      const subtask: Subtask = {
        id: crypto.randomUUID(),
        parentId: taskId,
        order: nextOrder(siblings),
        title: input.title,
        description: input.description,
        stage: 0,
        due: input.due,
        repeat: input.repeat,
        completedAt: null,
      };
      state.subtasks.push(subtask);
      state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, updatedAt: now } : t));
    },

    // Title/description/due/repeat only — never stage/completedAt, those are
    // only ever touched by the stage-toggle cascade reducers above. Same
    // no-stage-re-derivation scope as addSubtask.
    updateSubtask: (
      state,
      action: PayloadAction<{ subtaskId: string; patch: Partial<Pick<Subtask, 'title' | 'description' | 'due' | 'repeat'>> }>
    ) => {
      const { subtaskId, patch } = action.payload;
      const now = new Date().toISOString();
      const subtask = state.subtasks.find((s) => s.id === subtaskId);
      if (!subtask) return;
      state.subtasks = state.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...patch } : s));
      state.tasks = state.tasks.map((t) => (t.id === subtask.parentId ? { ...t, updatedAt: now } : t));
    },

    // Same no-stage-re-derivation scope as addSubtask.
    deleteSubtask: (state, action: PayloadAction<{ subtaskId: string }>) => {
      const { subtaskId } = action.payload;
      const now = new Date().toISOString();
      const subtask = state.subtasks.find((s) => s.id === subtaskId);
      if (!subtask) return;
      state.subtasks = state.subtasks.filter((s) => s.id !== subtaskId);
      state.tasks = state.tasks.map((t) => (t.id === subtask.parentId ? { ...t, updatedAt: now } : t));
    },

    createList: {
      reducer: (state, action: PayloadAction<{ id: string; name: string }>) => {
        state.taskLists.push({ id: action.payload.id, name: action.payload.name });
      },
      prepare: (name: string) => ({ payload: { id: crypto.randomUUID(), name } }),
    },

    renameList: (state, action: PayloadAction<{ listId: string; name: string }>) => {
      const { listId, name } = action.payload;
      state.taskLists = state.taskLists.map((list) => (list.id === listId ? { ...list, name } : list));
    },

    // Cascades: every task that belonged to this list is deleted too, and every
    // subtask that belonged to any of those tasks along with them.
    deleteList: (state, action: PayloadAction<{ listId: string }>) => {
      const { listId } = action.payload;
      const removedTaskIds = new Set(state.tasks.filter((task) => task.parentId === listId).map((task) => task.id));
      state.taskLists = state.taskLists.filter((list) => list.id !== listId);
      state.tasks = state.tasks.filter((task) => task.parentId !== listId);
      state.subtasks = state.subtasks.filter((subtask) => !removedTaskIds.has(subtask.parentId));
    },

    beginTaskDrag: (state) => {
      state.dragSnapshot = state.tasks;
    },

    // Fired at drop (via the endTaskDrag thunk) — persistenceMiddleware
    // writes to Firestore on this action.
    tasksReordered: (state, action: PayloadAction<{ grouped: Record<string, string[]> }>) => {
      state.tasks = applyTaskGroups(state.tasks, action.payload.grouped, new Date().toISOString());
    },

    // Reparents a task into its hovered list the moment it crosses into one
    // *during* a drag (via the applyTaskDragOver thunk) — same-list
    // reordering is animated live by dnd-kit's OptimisticSortingPlugin with
    // no app-state change needed, and this only fires on a cross-list
    // crossing, not every dragover, to avoid visible jitter. Deliberately a
    // separate action from tasksReordered so persistenceMiddleware can skip
    // writing to Firestore on every frame of an in-progress drag — only the
    // final drop (tasksReordered) persists.
    taskReparentedOnDragOver: (state, action: PayloadAction<{ grouped: Record<string, string[]> }>) => {
      state.tasks = applyTaskGroups(state.tasks, action.payload.grouped, new Date().toISOString());
    },

    dragCanceled: (state) => {
      if (state.dragSnapshot) state.tasks = state.dragSnapshot;
      state.dragSnapshot = null;
    },

    dragEnded: (state) => {
      state.dragSnapshot = null;
    },

    subtasksReordered: (state, action: PayloadAction<{ grouped: Record<string, string[]> }>) => {
      state.subtasks = applySubtaskGroups(state.tasks, state.subtasks, action.payload.grouped);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadTaskLists.fulfilled, (state, action) => {
        state.taskLists = action.payload.taskLists;
        state.tasks = action.payload.tasks;
        state.subtasks = action.payload.subtasks;
        state.isLoading = false;
      })
      .addCase(runRepeatResetCheck.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.tasks = action.payload.tasks;
        state.subtasks = action.payload.subtasks;
      });
  },
});

export const {
  setEditingRow,
  setDraggingId,
  setDroppingId,
  updateTaskStage,
  updateSubtaskStage,
  updateTask,
  updateTaskStages,
  deleteTask,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  createList,
  renameList,
  deleteList,
  beginTaskDrag,
  tasksReordered,
  taskReparentedOnDragOver,
  dragCanceled,
  dragEnded,
  subtasksReordered,
  addTaskFromDraft,
} = taskListsSlice.actions;

// Builds the new Task (and any drafted Subtasks) from the current state's
// sibling order before dispatching, same computation useTaskLists.ts's
// addTask did inline — kept as a thunk rather than in the reducer's
// `prepare` (which has no access to state) so `order`/timestamps are derived
// from what's actually in the store at call time.
export const addTask =
  (
    listId: string,
    taskDraft: Omit<Task, 'parentId' | 'order' | 'createdAt' | 'updatedAt' | 'completedAt'>,
    subtaskDrafts: Omit<Subtask, 'parentId' | 'order'>[] = []
  ) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const now = new Date().toISOString();
    const { tasks } = getState().taskLists;
    const siblingTasks = tasks.filter((t) => t.parentId === listId);
    const task: Task = {
      ...taskDraft,
      parentId: listId,
      order: nextOrder(siblingTasks),
      createdAt: now,
      updatedAt: now,
      completedAt: isTaskDone(taskDraft) ? now : null,
    };
    const newSubtasks: Subtask[] = subtaskDrafts.map((draft, index) => ({ ...draft, parentId: task.id, order: index }));
    dispatch(addTaskFromDraft({ task, newSubtasks }));
  };

// event-driven thunks — kept out of the slice's own reducers so raw dnd-kit
// event objects (not serializable) never enter the store; each reads state
// via getState(), does the pure grouping/move computation, and dispatches a
// plain serializable action.
export const applyTaskDragOver = (event: DragOverEvent) => (dispatch: AppDispatch, getState: () => RootState) => {
  const source = event.operation.source;
  if (!isSortable(source)) return;
  const state = getState().taskLists;
  const currentTask = state.tasks.find((t) => t.id === source.id);
  if (!currentTask || currentTask.parentId === source.group) return;
  dispatch(taskReparentedOnDragOver({ grouped: move(groupedTaskIds(state.taskLists, state.tasks), event) }));
};

export const endTaskDrag = (event: DragEndEvent) => (dispatch: AppDispatch, getState: () => RootState) => {
  if (event.canceled) {
    dispatch(dragCanceled());
    return;
  }
  const state = getState().taskLists;
  dispatch(tasksReordered({ grouped: move(groupedTaskIds(state.taskLists, state.tasks), event) }));
  dispatch(dragEnded());
};

export const commitSubtaskDragEnd = (event: DragEndEvent) => (dispatch: AppDispatch, getState: () => RootState) => {
  if (event.canceled) return;
  const state = getState().taskLists;
  dispatch(subtasksReordered({ grouped: move(groupedSubtaskIds(state.tasks, state.subtasks), event) }));
};

export default taskListsSlice.reducer;
