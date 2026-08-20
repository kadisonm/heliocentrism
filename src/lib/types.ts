import type { Layout } from 'react-grid-layout';

export type StageColor = 'none' | 'accent' | 'success' | 'warning' | 'error' | 'secondary' | 'muted';

// One user-defined step in a task's lifecycle. `id` is independent of
// position in `Task.stages` — needed as a stable key for the stage-list
// editor's add/remove UI (removing a middle stage shifts every later
// stage's array index), same reasoning Subtask already has its own id for.
export type TaskStageDef = {
  id: string;
  name: string; // '' allowed — renders no visible label
  color: StageColor;
  icon?: string; // key into TASK_STAGE_ICONS (src/lib/taskStageIcons.ts)
};

export type Subtask = {
  id: string;
  title: string;
  stage: number; // index into the PARENT Task's `stages` — no list of its own
  due: string; // '' = unset, same sentinel convention as Task.due
  repeat?: TaskRepeat; // independent of the parent Task's own repeat
  completedAt: string | null; // ISO 8601, null while not done — mirrors Task.completedAt
};

// A named, user-saved `stages` list a task can be seeded from — distinct
// from the built-in presets (Normal/Kanban), which are pure code constants
// and never stored here.
export type StagePreset = {
  id: string;
  name: string;
  stages: TaskStageDef[];
};

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';

export type RepeatEnd =
  | { type: 'never' }
  | { type: 'onDate'; date: string } // 'YYYY-MM-DD', inclusive
  | { type: 'afterOccurrences'; count: number }; // >= 1, total occurrences (not "extra" repeats)

export type TaskRepeat = {
  interval: number; // >= 1, "every N units"
  unit: RepeatUnit;
  time: string; // 'HH:MM' 24h — always independent of Task.due's time-of-day
  // 'YYYY-MM-DD' — internal phase reference the schedule is calculated
  // from, stamped once when repeat is first turned on. Not directly
  // user-editable: exposing it would let editing interval/unit/time/end
  // later silently re-anchor which weekday/day-of-month the task recurs on.
  anchor: string;
  end: RepeatEnd;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  stage: number; // index into `stages`
  stages: TaskStageDef[]; // always length >= 2; [0] = start, [last] = complete
  subtasks: Subtask[];
  due: string;
  repeat?: TaskRepeat; // undefined = task does not repeat
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601, null while not done
};

// A named collection of tasks — the Task List widget can switch between
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
  // Task List widget only — whether completed tasks are shown.
  // Not surfaced in any settings modal; toggled via the widget's own
  // show/hide button. Defaults to false (hidden) when unset.
  showCompleted?: boolean;
  // Task List widget only — which list is currently shown. Not surfaced in
  // any settings modal; changed via the widget's own list switcher. Falls
  // back to the first list when unset (or when it points at a deleted one).
  selectedListId?: string;
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
