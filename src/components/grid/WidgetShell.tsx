'use client';

import { GripVertical, Settings, UnfoldVertical, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pxToGridRows } from '../../lib/grid/gridConfig';
import { WIDGET_REGISTRY, findWidgetDefinition } from '../../lib/grid/widgetRegistry';
import type { DashboardWidget } from '../../lib/types';
import { WidgetContext } from './widgetContext';

type WidgetShellProps = {
  widget: DashboardWidget;
  isEditMode: boolean;
  onUpdateWidget: (id: string, patch: Partial<Omit<DashboardWidget, 'id'>>) => void;
  onRemove: (id: string) => void;
  onHeightChange: (id: string, h: number) => void;
};

// Memoized because Grid re-renders every drag/resize frame; without it every
// widget's subtree would re-render even though only the dragged one changed.
// Relies on the parent's widgets array preserving identity for untouched
// items (map/filter in useGridState) and on onUpdateWidget/onRemove being stable.
function WidgetShell({
  widget,
  isEditMode,
  onUpdateWidget,
  onRemove,
  onHeightChange,
}: WidgetShellProps) {
  const definition = findWidgetDefinition(widget.type);
  const WidgetComponent = definition?.component;
  const SettingsComponent = definition?.settingsComponent;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleUpdate = useCallback(
    (patch: Partial<Omit<DashboardWidget, 'id'>>) => onUpdateWidget(widget.id, patch),
    [onUpdateWidget, widget.id]
  );
  // Stable per-widget so context consumers (the widget's own component and
  // settings modal) don't re-render just because WidgetShell did.
  const widgetContextValue = useMemo(
    () => ({ widget, onUpdate: handleUpdate }),
    [widget, handleUpdate]
  );

  const isTransparent = definition?.transparentInViewMode && !isEditMode;
  const isAutoExpand = !!(widget.autoExpand && definition?.supportsAutoExpand);

  // Measures the content root (grid-widget-body's real child; portaled modals
  // don't show up here), not grid-widget-body itself which is pinned to the
  // grid's given height. CSS in grid.scss/shared.scss frees that root from
  // height:100% while auto-expand is on so it reports its natural height.
  useEffect(() => {
    if (!isAutoExpand) return;
    const target = bodyRef.current?.firstElementChild;
    if (!target) return;

    const minH = definition?.minSize.h;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let hasMeasured = false;
    const apply = (height: number) => {
      const rows = pxToGridRows(height);
      onHeightChange(widget.id, minH ? Math.max(minH, rows) : rows);
    };

    // Debounced (not single-rAF): a mid-transition CSS change fires this
    // once per frame, and one-frame coalescing still fights the animation.
    // Also coalesces the auto-expand cascade that tripped React's
    // update-depth guard; 250ms exceeds this file's own CSS transitions.
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height === undefined) return;
      // A cross-page drag (Grid.tsx's beginRelocation) hides this widget's
      // real DOM node with display:none while a ghost stands in for it on
      // the target page, which collapses this ResizeObserver's target to
      // 0x0 — reporting that as the widget's real height would shrink its
      // layout entry to minH, fighting the placeholder (sized off the
      // pre-drag height) and overlapping the page's other widgets, plus
      // racing the relocation's own per-frame layout writes into "Maximum
      // update depth exceeded". offsetParent is null exactly while an
      // ancestor is display:none, so this only skips that case.
      if (height === 0 && target instanceof HTMLElement && target.offsetParent === null) return;

      // The very first measurement isn't racing a mid-transition value or a
      // sibling widget's own update (GridPage's own coalescing already
      // batches simultaneous first-measurements together) — applying it
      // right away means a freshly mounted page's true layout is already
      // settled well before any later slide brings it into view, instead of
      // visibly resizing right after that slide lands.
      if (!hasMeasured) {
        hasMeasured = true;
        apply(height);
        return;
      }

      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        apply(height);
      }, 250);
    });

    observer.observe(target);
    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
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
            onChange={(event) => onUpdateWidget(widget.id, { type: event.target.value })}
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

      <WidgetContext.Provider value={widgetContextValue}>
        <div className={bodyClassName} ref={bodyRef}>
          {WidgetComponent ? (
            <WidgetComponent />
          ) : (
            <p className="grid-widget-unknown">Unknown widget type &quot;{widget.type}&quot;.</p>
          )}
        </div>

        {SettingsComponent && (
          <SettingsComponent isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        )}
      </WidgetContext.Provider>

      {isEditMode && definition?.supportsAutoExpand && (
        <button
          type="button"
          className={
            isAutoExpand
              ? 'grid-widget-auto-expand grid-widget-auto-expand--active'
              : 'grid-widget-auto-expand'
          }
          onClick={() => onUpdateWidget(widget.id, { autoExpand: !widget.autoExpand })}
          title={isAutoExpand ? 'Disable auto-expand' : 'Enable auto-expand'}
          aria-label={isAutoExpand ? 'Disable auto-expand' : 'Enable auto-expand'}
          aria-pressed={isAutoExpand}
        >
          <UnfoldVertical size={13} />
        </button>
      )}
    </div>
  );
}

export default memo(WidgetShell);
