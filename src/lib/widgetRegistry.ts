import type { ComponentType } from 'react';
import DailyRoutineWidget from '../components/widgets/daily-routine';
import MonthlyRoutineWidget from '../components/widgets/monthly-routine';
import OrbitWidget from '../components/widgets/orbit';
import RoutinesWidget from '../components/widgets/routines';
import WeeklyRoutineWidget from '../components/widgets/weekly-routine';

export type WidgetType =
  | 'routines'
  | 'daily-routine'
  | 'weekly-routine'
  | 'monthly-routine'
  | 'orbit';

export type WidgetDefinition = {
  type: WidgetType;
  name: string;
  description: string;
  defaultSize: { w: number; h: number };
  component: ComponentType;
};

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'routines',
    name: 'Routines',
    description: 'Daily, weekly, and monthly to-dos, all in one widget.',
    defaultSize: { w: 4, h: 6 },
    component: RoutinesWidget,
  },
  {
    type: 'daily-routine',
    name: 'Daily Routine',
    description: 'Just your daily to-dos.',
    defaultSize: { w: 3, h: 4 },
    component: DailyRoutineWidget,
  },
  {
    type: 'weekly-routine',
    name: 'Weekly Routine',
    description: 'Just your weekly to-dos.',
    defaultSize: { w: 3, h: 4 },
    component: WeeklyRoutineWidget,
  },
  {
    type: 'monthly-routine',
    name: 'Monthly Routine',
    description: 'Just your monthly to-dos.',
    defaultSize: { w: 3, h: 4 },
    component: MonthlyRoutineWidget,
  },
  {
    type: 'orbit',
    name: 'Orbit',
    description: 'A decorative sun and orbiting planets animation.',
    defaultSize: { w: 5, h: 4 },
    component: OrbitWidget,
  },
];

export function findWidgetDefinition(type: string): WidgetDefinition | null {
  return WIDGET_REGISTRY.find((widget) => widget.type === type) ?? null;
}
