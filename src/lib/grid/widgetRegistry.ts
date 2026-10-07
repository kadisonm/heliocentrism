import type { ComponentType } from 'react';
import ClockWidget from '../../components/widgets/clock';
import ClockSettingsModal from '../../components/widgets/clock/ClockSettingsModal';
import HabitCheckWidget from '../../components/widgets/habit-check';
import HabitHeatmapWidget from '../../components/widgets/habit-heatmap';
import HabitRingWidget from '../../components/widgets/habit-ring';
import OrbitWidget from '../../components/widgets/orbit';
import PhotoWidget from '../../components/widgets/photo';
import PhotoSettingsModal from '../../components/widgets/photo/PhotoSettingsModal';
import PomodoroTimerWidget from '../../components/widgets/pomodoro-timer';
import PomodoroSettingsModal from '../../components/widgets/pomodoro-timer/PomodoroSettingsModal';
import TaskListWidget from '../../components/widgets/task-list';

export type WidgetType =
  | 'task-list'
  | 'orbit'
  | 'pomodoro-timer'
  | 'photo'
  | 'clock'
  | 'habit-check'
  | 'habit-ring'
  | 'habit-heatmap';

export type WidgetSettingsComponent = ComponentType<{ isOpen: boolean; onClose: () => void }>;

export type WidgetDefinition = {
  type: WidgetType;
  name: string;
  description: string;
  defaultSize: { w: number; h: number };
  // Smallest size the widget can be resized to, in grid units — small
  // enough to squash a widget's header/controls into an unusable mess
  // below this.
  minSize: { w: number; h: number };
  component: ComponentType;
  // Rendered by WidgetShell's context menu (see WidgetContextMenu) when present.
  settingsComponent?: WidgetSettingsComponent;
  // When true, WidgetShell offers an auto-expand toggle in its context menu
  // that sizes this widget's height to its content instead of scrolling.
  // Only meaningful for widgets whose content can genuinely overflow —
  // decorative/fixed-size widgets (Orbit) leave this unset.
  supportsAutoExpand?: boolean;
};

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'task-list',
    name: 'Task List',
    description: 'One or more named lists of tasks with due dates.',
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 2, h: 3 },
    component: TaskListWidget,
    supportsAutoExpand: true,
  },
  {
    type: 'orbit',
    name: 'Orbit',
    description: 'A decorative sun and orbiting planets animation.',
    defaultSize: { w: 5, h: 4 },
    minSize: { w: 2, h: 2 },
    component: OrbitWidget,
  },
  {
    type: 'pomodoro-timer',
    name: 'Pomodoro Timer',
    description: 'A study/break countdown timer with optional auto-start.',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    component: PomodoroTimerWidget,
    settingsComponent: PomodoroSettingsModal,
    supportsAutoExpand: true,
  },
  {
    type: 'photo',
    name: 'Photo',
    description: 'A photo or GIF from a URL.',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 1, h: 1 },
    component: PhotoWidget,
    settingsComponent: PhotoSettingsModal,
  },
  {
    type: 'clock',
    name: 'Clock',
    description: 'The current time and date, in a format you choose.',
    defaultSize: { w: 2, h: 1 },
    minSize: { w: 1, h: 1 },
    component: ClockWidget,
    settingsComponent: ClockSettingsModal,
    supportsAutoExpand: true,
  },
  {
    type: 'habit-check',
    name: 'Habit Check',
    description: "Log today's progress on a habit.",
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 3 },
    component: HabitCheckWidget,
    supportsAutoExpand: true,
  },
  {
    type: 'habit-ring',
    name: 'Habit Ring',
    description: "A completion wheel for today's progress on a habit.",
    defaultSize: { w: 3, h: 6 },
    minSize: { w: 2, h: 5 },
    component: HabitRingWidget,
  },
  {
    type: 'habit-heatmap',
    name: 'Habit Heatmap',
    description: "A year-long grid of a habit's daily history.",
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 2, h: 5 },
    component: HabitHeatmapWidget,
  },
];

export function findWidgetDefinition(type: string): WidgetDefinition | null {
  return WIDGET_REGISTRY.find((widget) => widget.type === type) ?? null;
}
