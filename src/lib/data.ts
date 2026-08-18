import type {
  DashboardState,
  PomodoroSettings,
  TaskList,
  TaskTitleOverflow,
  ThemeSettings,
} from './types';

// User task defaults should start empty.
export const DEFAULT_TASK_LISTS: TaskList[] = [];

export const DEFAULT_DASHBOARD: DashboardState = {
  breakpoints: {
    desktop: { widgets: [], layout: [] },
    tablet: { widgets: [], layout: [] },
    mobile: { widgets: [], layout: [] },
  },
};

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  studyMinutes: 25,
  breakMinutes: 5,
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  palette: 'default',
  mode: 'system',
};

export const DEFAULT_TASK_TITLE_OVERFLOW: TaskTitleOverflow = 'wrap';

// General app settings — fields land here as they're built.
export type AppSettings = {
  pomodoro: PomodoroSettings;
  theme: ThemeSettings;
  taskTitleOverflow: TaskTitleOverflow;
};

export const DEFAULT_SETTINGS: AppSettings = {
  pomodoro: DEFAULT_POMODORO_SETTINGS,
  theme: DEFAULT_THEME_SETTINGS,
  taskTitleOverflow: DEFAULT_TASK_TITLE_OVERFLOW,
};

// Shape of the synced Firebase document, nested under a `data` field.
export type AppData = {
  taskLists: TaskList[];
  dashboard: DashboardState;
  settings: AppSettings;
};

export const DEFAULT_DATA: AppData = {
  taskLists: DEFAULT_TASK_LISTS,
  dashboard: DEFAULT_DASHBOARD,
  settings: DEFAULT_SETTINGS,
};
