import type { Layout } from 'react-grid-layout';

export type TodoStage = 0 | 1 | 2;
export type RecurrenceValue = 'daily' | 'weekly' | 'monthly';

export type Subtask = {
  id: string;
  title: string;
  stage: TodoStage;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  stage: TodoStage;
  subtasks: Subtask[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601, null while not done
};

// A routine task always belongs to exactly one cadence.
export type RoutineTask = Task & { recurrence: RecurrenceValue };

// A todo has a due date instead of a recurrence.
export type Todo = Task & { due: string };

// A named collection of todos — the Todo List widget can switch between
// several of these, each with its own independent set of tasks.
export type TodoList = {
  id: string;
  name: string;
  todos: Todo[];
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

export type DailyResetTime = { hour: number; minute: number }; // 0-23, 0-59
export type WeeklyResetTime = { dayOfWeek: number; hour: number; minute: number }; // 0=Sun..6=Sat
export type MonthlyResetTime = { dayOfMonth: number; hour: number; minute: number }; // 1-31

export type RoutineResetTimes = {
  daily: DailyResetTime;
  weekly: WeeklyResetTime;
  monthly: MonthlyResetTime;
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
  // Routines/Todo List widgets only — whether completed tasks are shown.
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
