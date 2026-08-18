import { createContext, useContext } from 'react';
import type { DashboardWidget } from '../../lib/types';

export type WidgetContextValue = {
  widget: DashboardWidget;
  onUpdate: (patch: Partial<Omit<DashboardWidget, 'id'>>) => void;
};

// Provided by WidgetShell around each widget's rendered component and
// settings modal — lets a widget that needs its own per-instance config
// (e.g. Photo's image URL) reach its own DashboardWidget entry and patch
// it, without every other, simpler widget's zero-prop component needing
// any signature change to accommodate it.
export const WidgetContext = createContext<WidgetContextValue | null>(null);

export function useWidgetContext(): WidgetContextValue {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error('useWidgetContext must be used within a widget rendered by WidgetShell');
  }
  return context;
}
