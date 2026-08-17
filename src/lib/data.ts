import type {
  DashboardState,
  PomodoroSettings,
  RoutineResetTimes,
  RoutineTask,
  ThemeSettings,
  TodoList,
} from './types';

// User task defaults should start empty.
export const DEFAULT_ROUTINE_TASKS: RoutineTask[] = [];
export const DEFAULT_TODO_LISTS: TodoList[] = [];

export const DEFAULT_DASHBOARD: DashboardState = {
  breakpoints: {
    desktop: { widgets: [], layout: [] },
    tablet: { widgets: [], layout: [] },
    mobile: { widgets: [], layout: [] },
  },
};

export const DEFAULT_ROUTINE_RESET_TIMES: RoutineResetTimes = {
  daily: { hour: 0, minute: 0 },
  weekly: { dayOfWeek: 1, hour: 0, minute: 0 }, // Monday
  monthly: { dayOfMonth: 1, hour: 0, minute: 0 },
};

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  studyMinutes: 25,
  breakMinutes: 5,
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  palette: 'default',
  mode: 'system',
};

// General app settings — fields land here as they're built.
export type AppSettings = {
  routineResetTimes: RoutineResetTimes;
  pomodoro: PomodoroSettings;
  theme: ThemeSettings;
};

export const DEFAULT_SETTINGS: AppSettings = {
  routineResetTimes: DEFAULT_ROUTINE_RESET_TIMES,
  pomodoro: DEFAULT_POMODORO_SETTINGS,
  theme: DEFAULT_THEME_SETTINGS,
};

// Shape of the synced Firebase document, nested under a `data` field.
export type AppData = {
  routineTasks: RoutineTask[];
  todoLists: TodoList[];
  dashboard: DashboardState;
  settings: AppSettings;
};

export const DEFAULT_DATA: AppData = {
  routineTasks: DEFAULT_ROUTINE_TASKS,
  todoLists: DEFAULT_TODO_LISTS,
  dashboard: DEFAULT_DASHBOARD,
  settings: DEFAULT_SETTINGS,
};
