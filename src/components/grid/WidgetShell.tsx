'use client';

import { GripVertical, Settings, UnfoldVertical, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { pxToGridRows } from '../../lib/gridConfig';
import { WIDGET_REGISTRY, findWidgetDefinition } from '../../lib/widgetRegistry';
import type { DashboardWidget } from '../../lib/types';

type WidgetShellProps = {
  widget: DashboardWidget;
  isEditMode: boolean;
  onSetType: (id: string, type: string) => void;
  onRemove: (id: string) => void;
  onSetAutoExpand: (id: string, autoExpand: boolean) => void;
  onHeightChange: (id: string, h: number) => void;
};

// Grid re-renders on every drag/resize frame (layout changes continuously
// while dragging) — without memoizing here, every widget's full subtree
// would re-render on every frame even though only the one being dragged
// actually changed. Relies on the parent's `widgets` array preserving
// object identity for unrelated widgets (see useGridState's
// setWidgetType/removeWidget, which use .map()/.filter() so untouched
// items keep their reference) and on onSetType/onRemove being stable
// (useCallback in useGridState).
function WidgetShell({
  widget,
  isEditMode,
  onSetType,
  onRemove,
  onSetAutoExpand,
  onHeightChange,
}: WidgetShellProps) {
  const definition = findWidgetDefinition(widget.type);
  const WidgetComponent = definition?.component;
  const SettingsComponent = definition?.settingsComponent;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const isTransparent = definition?.transparentInViewMode && !isEditMode;
  const isAutoExpand = !!(widget.autoExpand && definition?.supportsAutoExpand);

  // Measures the widget's own content root (grid-widget-body's single real
  // child — modals rendered alongside it portal to document.body, so they
  // never show up here) rather than grid-widget-body itself, which is
  // pinned to whatever height the grid gives it. The CSS pairing in
  // grid.scss frees that content root (and widgets/shared.scss's
  // .widget-content) from their normal height:100% while auto-expand is on,
  // so its rendered size reflects the content's true natural height instead
  // of just echoing its fixed container back.
  useEffect(() => {
    if (!isAutoExpand) return;
    const target = bodyRef.current?.firstElementChild;
    if (!target) return;

    const minH = definition?.minSize.h;
    let rafId: number | null = null;

    // Coalesced through rAF rather than calling onHeightChange straight
    // from the observer callback — toggling auto-expand on a widget with
    // others below it can cascade several resize notifications (this
    // widget growing, then whatever the compaction it triggers pushes
    // around) before things settle, and reacting to every one of them
    // synchronously is what was tripping React's update-depth guard.
    // Only the latest notification in a given frame actually gets applied.
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height === undefined) return;

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const rows = pxToGridRows(height);
        onHeightChange(widget.id, minH ? Math.max(minH, rows) : rows);
      });
    });

    observer.observe(target);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [isAutoExpand, widget.id, onHeightChange, definition]);

  const bodyClassName = [
    'grid-widget-body',
    isEditMode && 'is-locked',
    isAutoExpand && 'grid-widget-body--auto-expand',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={isTransparent ? 'grid-widget grid-widget--transparent' : 'grid-widget'}>
      {isEditMode && (
        <div className="grid-widget-chrome">
          <span className="widget-drag-handle" title="Drag to move" aria-label="Drag to move">
            <GripVertical size={16} />
          </span>

          {SettingsComponent && (
            <button
              type="button"
              className="grid-widget-settings"
              onClick={() => setIsSettingsOpen(true)}
              title="Widget settings"
              aria-label="Widget settings"
            >
              <Settings size={14} />
            </button>
          )}

          <select
            className="grid-widget-type-select"
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
            className="grid-widget-remove"
            onClick={() => onRemove(widget.id)}
            title="Remove widget"
            aria-label="Remove widget"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className={bodyClassName} ref={bodyRef}>
        {WidgetComponent ? (
          <WidgetComponent />
        ) : (
          <p className="grid-widget-unknown">Unknown widget type &quot;{widget.type}&quot;.</p>
        )}
      </div>

      {isEditMode && definition?.supportsAutoExpand && (
        <button
          type="button"
          className={
            isAutoExpand
              ? 'grid-widget-auto-expand grid-widget-auto-expand--active'
              : 'grid-widget-auto-expand'
          }
          onClick={() => onSetAutoExpand(widget.id, !widget.autoExpand)}
          title={isAutoExpand ? 'Disable auto-expand' : 'Enable auto-expand'}
          aria-label={isAutoExpand ? 'Disable auto-expand' : 'Enable auto-expand'}
          aria-pressed={isAutoExpand}
        >
          <UnfoldVertical size={13} />
        </button>
      )}

      {SettingsComponent && (
        <SettingsComponent isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}

export default memo(WidgetShell);
