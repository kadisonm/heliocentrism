import type { ComponentType } from 'react';
import OrbitWidget from '../components/widgets/orbit';
import RecurringTasks from '../components/widgets/recurring-tasks';

export type WidgetType = 'recurring-tasks' | 'orbit';

export type WidgetDefinition = {
  type: WidgetType;
  name: string;
  description: string;
  defaultSize: { w: number; h: number };
  component: ComponentType;
};

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    type: 'recurring-tasks',
    name: 'Recurring Tasks',
    description: 'Daily, weekly, and monthly to-dos.',
    defaultSize: { w: 4, h: 6 },
    component: RecurringTasks,
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
