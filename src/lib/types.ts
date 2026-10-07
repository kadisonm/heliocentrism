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
  parentId: string; // a Task id — always. Nothing can point to a Subtask's own id as a parent, so this is a leaf.
  order: number; // sibling order among other subtasks sharing this parentId — see useTaskLists.ts
  title: string;
  description?: string;
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
  parentId: string; // a TaskList id — always
  order: number; // sibling order among other tasks sharing this parentId — see useTaskLists.ts
  title: string;
  description?: string;
  stage: number; // index into `stages`
  stages: TaskStageDef[]; // always length >= 2; [0] = start, [last] = complete
  due: string;
  repeat?: TaskRepeat; // undefined = task does not repeat
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601, null while not done
};

// A named collection of tasks — the Task List widget can switch between
// several of these, each with its own independent set of tasks. The tasks
// themselves live in their own flat store (see useTaskLists.ts), each
// pointing back here via Task.parentId, rather than nesting inside this type.
export type TaskList = {
  id: string;
  name: string;
};

// Keys into the theme's extended colour palette (--color-<name>).
export type PaletteColor = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink';

// The condition a day's logged value must meet to count as complete.
export type HabitGoal =
  | { type: 'check' } // value 1 = done
  | { type: 'quantity'; target: number; unit: string; step: number } // value >= target = done
  | { type: 'abstain' }; // done by default; any logged slip (value > 0) fails the day

// Where a habit's daily value comes from — extend with e.g. a health-data source later.
export type HabitSource = { kind: 'manual' };

export type HabitDay = {
  value: number; // check: 0/1, quantity: amount, abstain: slip count
  completedAt: string | null; // ISO 8601, when the goal was met that day; null if not met
};

export type Habit = {
  id: string;
  name: string;
  color: PaletteColor;
  goal: HabitGoal; // type is fixed after creation so past log values keep their meaning
  source: HabitSource;
  order: number;
  createdAt: string; // ISO 8601
  // Keyed by local 'YYYY-MM-DD'. Days without activity are omitted to keep the synced doc small.
  log: Record<string, HabitDay>;
};

// The user-editable part of a habit — everything else is managed by the habits slice.
export type HabitDraft = Pick<Habit, 'name' | 'color' | 'goal'>;

export type GoalMilestone = {
  id: string;
  title: string;
  completedAt: string | null; // ISO 8601, null while not done
};

// A dated change to a numeric goal's value — may be negative (e.g. weight lost, money spent).
export type GoalEntry = {
  id: string;
  date: string; // 'YYYY-MM-DD'
  amount: number;
};

// How a goal's progress is measured. Linked types derive progress from habit/task data instead of storing it.
export type GoalMeasure =
  | { type: 'milestones'; milestones: GoalMilestone[] }
  | { type: 'numeric'; start: number; target: number; unit: string; entries: GoalEntry[] } // target < start = decreasing goal
  | { type: 'habit'; habitId: string; metric: 'days' | 'total'; target: number } // days = complete days, total = summed values
  | { type: 'taskList'; listId: string }; // target = every task in the list

export type Goal = {
  id: string;
  name: string;
  color: PaletteColor;
  measure: GoalMeasure; // type is fixed after creation
  startDate: string; // 'YYYY-MM-DD' — progress counts from here
  deadline: string | null; // 'YYYY-MM-DD', inclusive; null = open-ended
  note?: string; // why this goal matters
  order: number;
  createdAt: string; // ISO 8601
};

// The user-editable part of a goal — everything else is managed by the goals slice.
export type GoalDraft = Pick<Goal, 'name' | 'color' | 'measure' | 'startDate' | 'deadline' | 'note'>;

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

// Extend as new backgrounds are added (see src/lib/background.ts).
export type BackgroundVariant = 'none' | 'space';

export type BackgroundSettings = {
  variant: BackgroundVariant;
};

export type DashboardBreakpoint = 'desktop' | 'tablet' | 'mobile';

// `order` is every NAV_ITEMS id (see lib/nav/navItems.ts) in user-chosen
// order; `hidden` ids are suppressed from the bottom nav and its overflow.
export type NavBarSettings = {
  order: string[];
  hidden: string[];
};

export type PhotoWidgetConfig = {
  url: string;
  alt?: string;
  fit?: 'cover' | 'contain';
};

export type ClockWidgetConfig = {
  format: string; // token string, see src/lib/clock/dateTimeFormat.ts; newlines become line breaks
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
  // Clock widget only, set via ClockSettingsModal.
  clock?: ClockWidgetConfig;
  // Task List widget only — whether completed tasks are shown.
  // Not surfaced in any settings modal; toggled via the widget's own
  // show/hide button. Defaults to false (hidden) when unset.
  showCompleted?: boolean;
  // Task List widget only — which list is currently shown. Not surfaced in
  // any settings modal; changed via the widget's own list switcher. Falls
  // back to the first list when unset (or when it points at a deleted one).
  selectedListId?: string;
  // Habit widgets only — which habit is shown, same fallback rules as selectedListId.
  selectedHabitId?: string;
  // Goal widgets only — which goal is shown, same fallback rules as selectedListId.
  selectedGoalId?: string;
  // Notepad widgets only — the note's text, saved per widget instance.
  noteContent?: string;
};

// One independent grid of widgets — a breakpoint can hold several, see
// DashboardBreakpointState.
export type DashboardPage = {
  id: string;
  widgets: DashboardWidget[];
  layout: Layout;
};

// Each breakpoint owns an ordered list of pages, each a self-contained
// widgets+layout unit — not two parallel structures kept in sync by
// matching ids. Switching breakpoints or pages means loading a different
// widgets+layout wholesale, not repositioning a shared set of widgets.
// Always length >= 1 — the dashboard never has zero pages.
export type DashboardBreakpointState = {
  pages: DashboardPage[];
};

export type DashboardState = {
  breakpoints: Record<DashboardBreakpoint, DashboardBreakpointState>;
};
