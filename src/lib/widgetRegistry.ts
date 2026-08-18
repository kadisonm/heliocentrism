import type { ComponentType } from 'react';
import OrbitWidget from '../components/widgets/orbit';
import PhotoWidget from '../components/widgets/photo';
import PhotoSettingsModal from '../components/widgets/photo/PhotoSettingsModal';
import PomodoroTimerWidget from '../components/widgets/pomodoro-timer';
import PomodoroSettingsModal from '../components/widgets/pomodoro-timer/PomodoroSettingsModal';
import SpacerWidget from '../components/widgets/spacer';
import TodoListWidget from '../components/widgets/todo-list';

export type WidgetType =
  | 'todo-list'
  | 'orbit'
  | 'pomodoro-timer'
  | 'photo'
  | 'spacer';

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
  // When true, WidgetShell's own chrome (background/border, not just this
  // widget's content) is only shown while editing — for widgets like Spacer
  // that should be fully invisible once you're done editing, not just empty.
  transparentInViewMode?: boolean;
  // When true, WidgetShell offers an auto-expand toggle (edit mode only)
  // that sizes this widget's height to its content instead of scrolling.
  // Only meaningful for widgets whose content can genuinely overflow —
  // decorative/fixed-size widgets (Orbit, Spacer) leave this unset.
  supportsAutoExpand?: boolean;
};

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'todo-list',
    name: 'Todo List',
    description: 'A flat list of one-off tasks with due dates.',
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 2, h: 3 },
    component: TodoListWidget,
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
    type: 'spacer',
    name: 'Spacer',
    description: 'Empty space for shaping the layout — visible only while editing.',
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 1, h: 1 },
    component: SpacerWidget,
    transparentInViewMode: true,
  },
];

export function findWidgetDefinition(type: string): WidgetDefinition | null {
  return WIDGET_REGISTRY.find((widget) => widget.type === type) ?? null;
}
