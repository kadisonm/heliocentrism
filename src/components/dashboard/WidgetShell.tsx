'use client';

import { GripVertical, Settings, X } from 'lucide-react';
import { memo, useState } from 'react';
import { WIDGET_REGISTRY, findWidgetDefinition } from '../../lib/widgetRegistry';
import type { DashboardWidget } from '../../lib/types';

type WidgetShellProps = {
  widget: DashboardWidget;
  isEditMode: boolean;
  onSetType: (id: string, type: string) => void;
  onRemove: (id: string) => void;
};

// DashboardGrid re-renders on every drag/resize frame (layouts changes
// continuously while dragging) — without memoizing here, every widget's
// full subtree would re-render on every frame even though only the one
// being dragged actually changed. Relies on the parent's `widgets` array
// preserving object identity for unrelated widgets (see useDashboardState's
// setWidgetType/removeWidget, which use .map()/.filter() so untouched
// items keep their reference) and on onSetType/onRemove being stable
// (useCallback in useDashboardState).
function WidgetShell({
  widget,
  isEditMode,
  onSetType,
  onRemove,
}: WidgetShellProps) {
  const definition = findWidgetDefinition(widget.type);
  const WidgetComponent = definition?.component;
  const SettingsComponent = definition?.settingsComponent;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="dashboard-widget">
      {isEditMode && (
        <div className="dashboard-widget-chrome">
          <span className="widget-drag-handle" title="Drag to move" aria-label="Drag to move">
            <GripVertical size={16} />
          </span>

          {SettingsComponent && (
            <button
              type="button"
              className="dashboard-widget-settings"
              onClick={() => setIsSettingsOpen(true)}
              title="Widget settings"
              aria-label="Widget settings"
            >
              <Settings size={14} />
            </button>
          )}

          <select
            className="dashboard-widget-type-select"
            value={widget.type}
            onChange={(event) => onSetType(widget.id, event.target.value)}
            title="Change widget"
            aria-label="Change widget"
          >
            {WIDGET_REGISTRY.map((option) => (
              <option key={option.type} value={option.type}>
                {option.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="dashboard-widget-remove"
            onClick={() => onRemove(widget.id)}
            title="Remove widget"
            aria-label="Remove widget"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className={isEditMode ? 'dashboard-widget-body is-locked' : 'dashboard-widget-body'}>
        {WidgetComponent ? (
          <WidgetComponent />
        ) : (
          <p className="dashboard-widget-unknown">Unknown widget type &quot;{widget.type}&quot;.</p>
        )}
      </div>

      {SettingsComponent && (
        <SettingsComponent isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}

export default memo(WidgetShell);
