import type { DashboardState, Todo } from './types';

// User task defaults should start empty.
export const DEFAULT_TASKS: Todo[] = [];

export const DEFAULT_DASHBOARD: DashboardState = {
  widgets: [],
  layouts: { desktop: [], tablet: [], mobile: [] },
};

// Shape of the synced Firebase document, nested under a `data` field.
export type AppData = {
  tasks: Todo[];
  dashboard: DashboardState;
};

export const DEFAULT_DATA: AppData = {
  tasks: DEFAULT_TASKS,
  dashboard: DEFAULT_DASHBOARD,
};

// General app settings (theme, etc.) — fields land here as they're built.
export type AppSettings = Record<string, never>;

export const DEFAULT_SETTINGS: AppSettings = {};
