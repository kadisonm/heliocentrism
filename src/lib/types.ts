import type { Layout } from 'react-grid-layout';

export type TaskStage = 0 | 1 | 2;

export type Subtask = {
  id: string;
  title: string;
  stage: TaskStage;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  stage: TaskStage;
  subtasks: Subtask[];
  due: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601, null while not done
};

// A named collection of tasks — the Todo List widget can switch between
// several of these, each with its own independent set of tasks.
export type TaskList = {
  id: string;
  name: string;
  tasks: Task[];
};

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
};

export type SyncStatus = {
  isConfigured: boolean;
  isAuthenticated: boolean;
  userEmail: string | null;
};

export type PomodoroSettings = {
  studyMinutes: number;
  breakMinutes: number;
};

export type ThemeMode = 'system' | 'light' | 'dark';

// Extend as new palettes are added to $themes in src/styles/theme.scss.
export type ThemePalette = 'default' | 'catppuccin';

export type ThemeSettings = {
  palette: ThemePalette;
  mode: ThemeMode;
};

// Whether a task's title truncates with an ellipsis or wraps onto multiple
// lines — a global display preference, not tied to any one widget.
export type TaskTitleOverflow = 'truncate' | 'wrap';

export type DashboardBreakpoint = 'desktop' | 'tablet' | 'mobile';

export type PhotoWidgetConfig = {
  url: string;
  alt?: string;
  fit?: 'cover' | 'contain';
};

export type DashboardWidget = {
  id: string;
  type: string;
  // When true, this widget's height is driven by its content's natural
  // size instead of being manually resizable — see WidgetShell's
  // ResizeObserver-based measurement.
  autoExpand?: boolean;
  // Photo widget only, set via PhotoSettingsModal.
  photo?: PhotoWidgetConfig;
  // Todo List widget only — whether completed tasks are shown.
  // Not surfaced in any settings modal; toggled via the widget's own
  // show/hide button. Defaults to false (hidden) when unset.
  showCompleted?: boolean;
};

// Each breakpoint owns its widgets and their layout together, as one unit
// — not two parallel structures kept in sync by matching ids. Switching
// breakpoints means loading a different tier's widgets+layout wholesale,
// not repositioning a shared set of widgets.
export type DashboardBreakpointState = {
  widgets: DashboardWidget[];
  layout: Layout;
};

export type DashboardState = {
  breakpoints: Record<DashboardBreakpoint, DashboardBreakpointState>;
};
