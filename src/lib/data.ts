import type {
  BackgroundSettings,
  DashboardPage,
  DashboardState,
  PomodoroSettings,
  StagePreset,
  Subtask,
  Task,
  TaskList,
  ThemeSettings,
} from './types';

// User task defaults should start empty.
export const DEFAULT_TASK_LISTS: TaskList[] = [];
export const DEFAULT_TASKS: Task[] = [];
export const DEFAULT_SUBTASKS: Subtask[] = [];

// A fixed sentinel id, not crypto.randomUUID() — this constant seeds a
// brand-new user's state, so a stable id is more predictable than a random
// one that only ever gets used once.
function emptyPage(id: string): DashboardPage {
  return { id, widgets: [], layout: [] };
}

export const DEFAULT_DASHBOARD: DashboardState = {
  breakpoints: {
    desktop: { pages: [emptyPage('default')] },
    tablet: { pages: [emptyPage('default')] },
    mobile: { pages: [emptyPage('default')] },
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

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  variant: 'space',
};

// User-saved stage presets start empty — the built-in Normal/Kanban presets
// are pure code constants (src/lib/taskCascade.ts) and never stored here.
export const DEFAULT_CUSTOM_STAGE_PRESETS: StagePreset[] = [];

// General app settings — fields land here as they're built.
export type AppSettings = {
  pomodoro: PomodoroSettings;
  theme: ThemeSettings;
  background: BackgroundSettings;
  customStagePresets: StagePreset[];
};

export const DEFAULT_SETTINGS: AppSettings = {
  pomodoro: DEFAULT_POMODORO_SETTINGS,
  theme: DEFAULT_THEME_SETTINGS,
  background: DEFAULT_BACKGROUND_SETTINGS,
  customStagePresets: DEFAULT_CUSTOM_STAGE_PRESETS,
};

// Shape of the synced Firebase document, nested under a `data` field.
export type AppData = {
  taskLists: TaskList[];
  tasks: Task[];
  subtasks: Subtask[];
  dashboard: DashboardState;
  settings: AppSettings;
};

export const DEFAULT_DATA: AppData = {
  taskLists: DEFAULT_TASK_LISTS,
  tasks: DEFAULT_TASKS,
  subtasks: DEFAULT_SUBTASKS,
  dashboard: DEFAULT_DASHBOARD,
  settings: DEFAULT_SETTINGS,
};
