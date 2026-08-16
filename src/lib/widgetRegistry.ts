import type { ComponentType } from 'react';
import DailyRoutineWidget from '../components/widgets/daily-routine';
import MonthlyRoutineWidget from '../components/widgets/monthly-routine';
import OrbitWidget from '../components/widgets/orbit';
import PomodoroTimerWidget from '../components/widgets/pomodoro-timer';
import PomodoroSettingsModal from '../components/widgets/pomodoro-timer/PomodoroSettingsModal';
import RoutinesWidget from '../components/widgets/routines';
import RoutineSettingsModal from '../components/widgets/routines/RoutineSettingsModal';
import TodoListWidget from '../components/widgets/todo-list';
import WeeklyRoutineWidget from '../components/widgets/weekly-routine';

export type WidgetType =
  | 'routines'
  | 'daily-routine'
  | 'weekly-routine'
  | 'monthly-routine'
  | 'todo-list'
  | 'orbit'
  | 'pomodoro-timer';

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
  // Rendered by WidgetShell's gear icon (edit mode only) when present.
  settingsComponent?: WidgetSettingsComponent;
};

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'routines',
    name: 'Routines',
    description: 'Daily, weekly, and monthly to-dos, all in one widget.',
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 2, h: 3 },
    component: RoutinesWidget,
    settingsComponent: RoutineSettingsModal,
  },
  {
    type: 'daily-routine',
    name: 'Daily Routine',
    description: 'Just your daily to-dos.',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    component: DailyRoutineWidget,
    settingsComponent: RoutineSettingsModal,
  },
  {
    type: 'weekly-routine',
    name: 'Weekly Routine',
    description: 'Just your weekly to-dos.',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    component: WeeklyRoutineWidget,
    settingsComponent: RoutineSettingsModal,
  },
  {
    type: 'monthly-routine',
    name: 'Monthly Routine',
    description: 'Just your monthly to-dos.',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    component: MonthlyRoutineWidget,
    settingsComponent: RoutineSettingsModal,
  },
  {
    type: 'todo-list',
    name: 'Todo List',
    description: 'A flat list of one-off tasks with due dates.',
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 2, h: 3 },
    component: TodoListWidget,
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
  },
];

export function findWidgetDefinition(type: string): WidgetDefinition | null {
  return WIDGET_REGISTRY.find((widget) => widget.type === type) ?? null;
}
