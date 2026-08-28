import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import type { AppSettings } from '../data';
import type { DashboardState } from '../types';
import {
  writeAppSettings,
  writeDashboardState,
  writeSubtasks,
  writeTaskLists,
  writeTasks,
} from '../firebase/firebaseSync';
import { lockGestures, unlockGestures } from '../gestureLock';
import type { AppDispatch, RootState } from './store';
import {
  ALL_BREAKPOINTS,
  addWidget,
  createPage,
  loadGridState,
  moveWidgetToPage,
  removeWidget,
  setLayout,
  setWidgetHeights,
  updateWidget,
} from './gridSlice';
import {
  addSubtask,
  addTaskFromDraft,
  createList,
  deleteList,
  deleteSubtask,
  deleteTask,
  renameList,
  runRepeatResetCheck,
  setDraggingId,
  subtasksReordered,
  tasksReordered,
  updateSubtask,
  updateSubtaskStage,
  updateTask,
  updateTaskStage,
  updateTaskStages,
} from './taskListsSlice';
import { setSettings } from './settingsSlice';

export const persistenceMiddleware = createListenerMiddleware();

// --- Grid: debounce the write itself, not the local state (react-grid-
// layout calls onLayoutChange on every drag/resize frame, not just once at
// the end) — matches useGridState.ts's original debounce/flush behavior. ---
let pendingGridWrite: DashboardState | null = null;
let gridWriteTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleGridWrite(dashboard: DashboardState) {
  pendingGridWrite = dashboard;
  if (gridWriteTimeout) clearTimeout(gridWriteTimeout);
  gridWriteTimeout = setTimeout(() => {
    gridWriteTimeout = null;
    if (pendingGridWrite) {
      writeDashboardState(pendingGridWrite);
      pendingGridWrite = null;
    }
  }, 500);
}

// Flushes any still-pending write immediately when the tab is closing, so
// navigating away right after a drag/resize doesn't silently drop the final
// position under the debounce above — replaces the old per-hook unmount
// flush, which has no equivalent now that the store is an app-lifetime
// singleton rather than scoped to a mounted component.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (gridWriteTimeout) {
      clearTimeout(gridWriteTimeout);
      if (pendingGridWrite) writeDashboardState(pendingGridWrite);
    }
  });
}

persistenceMiddleware.startListening({
  matcher: isAnyOf(addWidget, removeWidget, updateWidget, setLayout, setWidgetHeights, createPage, moveWidgetToPage, loadGridState.fulfilled),
  effect: (_, listenerApi) => {
    const { isLoading, breakpoints } = (listenerApi.getState() as RootState).grid;
    const hasAnyWidgets = ALL_BREAKPOINTS.some((breakpoint) =>
      breakpoints[breakpoint].pages.some((page) => page.widgets.length > 0)
    );
    if (isLoading || !hasAnyWidgets) return;
    scheduleGridWrite({ breakpoints });
  },
});

// --- Task lists: synchronous, undebounced writes on every mutation —
// matches the original module singleton's commit() (notify + persist). ---
function persistTaskLists(state: RootState) {
  const { isLoading, taskLists, tasks, subtasks } = state.taskLists;
  if (isLoading) return;
  writeTaskLists(taskLists);
  writeTasks(tasks);
  writeSubtasks(subtasks);
}

persistenceMiddleware.startListening({
  matcher: isAnyOf(
    createList,
    renameList,
    deleteList,
    addTaskFromDraft,
    updateTask,
    updateTaskStages,
    updateTaskStage,
    updateSubtaskStage,
    deleteTask,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    tasksReordered,
    subtasksReordered
  ),
  effect: (_, listenerApi) => persistTaskLists(listenerApi.getState() as RootState),
});

// The repeat-reset check only actually changes (and persists) anything when
// its thunk found a stale completed/repeating task — matches the original
// runRepeatResetCheck's `if (!changed) return` before its own persist().
persistenceMiddleware.startListening({
  actionCreator: runRepeatResetCheck.fulfilled,
  effect: (action, listenerApi) => {
    if (!action.payload) return;
    persistTaskLists(listenerApi.getState() as RootState);
  },
});

// setDraggingId's null<->non-null transition claims/releases the shared
// gesture lock (see gestureLock.ts) — the one choke point both a task and a
// subtask drag already funnel through, so page-swipe paging backs off for
// the whole duration of either kind of row drag without needing to know the
// difference itself. A side effect, so it lives here rather than in the
// (pure) reducer.
persistenceMiddleware.startListening({
  actionCreator: setDraggingId,
  effect: (action, listenerApi) => {
    const previousId = (listenerApi.getOriginalState() as RootState).taskLists.draggingId;
    const nextId = action.payload;
    if (previousId === null && nextId !== null) lockGestures();
    else if (previousId !== null && nextId === null) unlockGestures();
  },
});

// --- Settings: debounce the write only — free-typed fields dispatch
// setSettings per keystroke, and the in-memory state still updates
// synchronously via the reducer, so typing stays instant while the network
// write waits for settle. ---
let pendingSettingsWrite: AppSettings | null = null;
let settingsWriteTimeout: ReturnType<typeof setTimeout> | null = null;

persistenceMiddleware.startListening({
  actionCreator: setSettings,
  effect: (action) => {
    pendingSettingsWrite = action.payload;
    if (settingsWriteTimeout) clearTimeout(settingsWriteTimeout);
    settingsWriteTimeout = setTimeout(() => {
      settingsWriteTimeout = null;
      if (pendingSettingsWrite) {
        writeAppSettings(pendingSettingsWrite);
        pendingSettingsWrite = null;
      }
    }, 500);
  },
});

let hasStartedRepeatWatcher = false;

// Wired up once (not per hook call) so N mounted Task List widgets still
// only run one timer and one listener between them.
export function ensureRepeatWatcherStarted(dispatch: AppDispatch) {
  if (hasStartedRepeatWatcher) return;
  hasStartedRepeatWatcher = true;

  setInterval(() => dispatch(runRepeatResetCheck()), 60_000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') dispatch(runRepeatResetCheck());
  });
}
