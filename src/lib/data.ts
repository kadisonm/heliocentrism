import type { DashboardState, RoutineResetTimes, RoutineTask, Todo } from './types';

// User task defaults should start empty.
export const DEFAULT_ROUTINE_TASKS: RoutineTask[] = [];
export const DEFAULT_TODOS: Todo[] = [];

export const DEFAULT_DASHBOARD: DashboardState = {
  widgets: [],
  layouts: { desktop: [], tablet: [], mobile: [] },
};

export const DEFAULT_ROUTINE_RESET_TIMES: RoutineResetTimes = {
  daily: { hour: 0, minute: 0 },
  weekly: { dayOfWeek: 1, hour: 0, minute: 0 }, // Monday
  monthly: { dayOfMonth: 1, hour: 0, minute: 0 },
};

// General app settings (theme, etc.) — fields land here as they're built.
export type AppSettings = {
  routineResetTimes: RoutineResetTimes;
};

export const DEFAULT_SETTINGS: AppSettings = {
  routineResetTimes: DEFAULT_ROUTINE_RESET_TIMES,
};

// Shape of the synced Firebase document, nested under a `data` field.
export type AppData = {
  routineTasks: RoutineTask[];
  todos: Todo[];
  dashboard: DashboardState;
  settings: AppSettings;
};

export const DEFAULT_DATA: AppData = {
  routineTasks: DEFAULT_ROUTINE_TASKS,
  todos: DEFAULT_TODOS,
  dashboard: DEFAULT_DASHBOARD,
  settings: DEFAULT_SETTINGS,
};
