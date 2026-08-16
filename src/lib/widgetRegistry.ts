import type { ComponentType } from 'react';
import RecurringTasks from '../components/widgets/recurring-tasks';

export type WidgetType = 'recurring-tasks';

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
];

export function findWidgetDefinition(type: string): WidgetDefinition | null {
  return WIDGET_REGISTRY.find((widget) => widget.type === type) ?? null;
}
