import { createContext, useContext } from 'react';
import type { DashboardWidget } from '../../lib/types';

export type WidgetContextValue = {
  widget: DashboardWidget;
  onUpdate: (patch: Partial<Omit<DashboardWidget, 'id'>>) => void;
};

// Provided by WidgetShell around each widget's component and settings modal,
// so a widget needing per-instance config (e.g. Photo's URL) can reach and
// patch its own DashboardWidget entry without changing every other widget's
// signature.
export const WidgetContext = createContext<WidgetContextValue | null>(null);

export function useWidgetContext(): WidgetContextValue {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error('useWidgetContext must be used within a widget rendered by WidgetShell');
  }
  return context;
}
