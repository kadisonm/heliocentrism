'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pxToGridRows } from '../../lib/grid/gridConfig';
import { findWidgetDefinition } from '../../lib/grid/widgetRegistry';
import type { DashboardWidget } from '../../lib/types';
import type { Point } from '../../lib/grid/pointerEvents';
import type { ContextMenuPosition } from '../common/context-menu/ContextMenu';
import { WidgetContext } from './widgetContext';
import { useCloseMenuOnOutsideClick } from './useCloseMenuOnOutsideClick';
import { useLongPress, WIDGET_GESTURE_SKIP_SELECTOR } from './useLongPress';
import WidgetContextMenu from './WidgetContextMenu';
import ResizeHandle, { type ResizeCorner } from './ResizeHandle';

const MOVE_RESIZE_HANDLES: ResizeCorner[] = ['se', 'sw'];
// A widget with auto-expand on manages its own height (see the
// ResizeObserver effect below) — offering only east/west handles keeps
// width resizing available without letting a manual resize fight that
// measurement.
const AUTO_EXPAND_RESIZE_HANDLES: ResizeCorner[] = ['e', 'w'];

type WidgetShellProps = {
  widget: DashboardWidget;
  onUpdateWidget: (id: string, patch: Partial<Omit<DashboardWidget, 'id'>>) => void;
  onRemove: (id: string) => void;
  onHeightChange: (id: string, h: number) => void;
  // Long-press (or a resize handle's own immediate press) hands off into
  // these — see Grid.tsx's beginDrag/beginResize, the manual pointer-
  // tracking engine that actually drives the gesture from here on.
  onDragStart?: (widgetId: string, point: Point, element: HTMLElement) => void;
  onResizeStart?: (widgetId: string, corner: ResizeCorner, point: Point) => void;
};

// Memoized because Grid re-renders every drag/resize frame; without it every
// widget's subtree would re-render even though only the dragged one changed.
// Relies on the parent's widgets array preserving identity for untouched
// items (map/filter in useGridState) and on onUpdateWidget/onRemove being
// stable. Deliberately has no isDragActive prop at all — see GridPage.tsx's
// own comment on why threading that through here would defeat the whole
// point of this memoization mid-gesture.
function WidgetShell({
  widget,
  onUpdateWidget,
  onRemove,
  onHeightChange,
  onDragStart,
  onResizeStart,
}: WidgetShellProps) {
  const definition = findWidgetDefinition(widget.type);
  const WidgetComponent = definition?.component;
  const SettingsComponent = definition?.settingsComponent;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Long-press (or right-click) reveals the Settings/Resize/Delete menu;
  // choosing "Resize" swaps it for the corner/edge resize handles instead —
  // only one of the two is ever showing at once, hence one state instead of
  // a pair that could disagree. null when neither is showing.
  const [overlay, setOverlay] = useState<{ mode: 'menu'; position: ContextMenuPosition } | { mode: 'resize' } | null>(
    null
  );
  const closeOverlay = useCallback(() => setOverlay(null), []);
  useCloseMenuOnOutsideClick(!!overlay, closeOverlay);
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
      // A drag (Grid.tsx's beginDrag) hides this widget's
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

  const bodyClassName = ['grid-widget-body', isAutoExpand && 'grid-widget-body--auto-expand']
    .filter(Boolean)
    .join(' ');

  // Fires on a hold anywhere on the widget's own body (no dedicated drag
  // handle needed anymore) — opens the menu, and if the SAME contact then
  // keeps moving, hands off into a move drag instead of a second long-press.
  const longPress = useLongPress({
    onLongPress: (point) => setOverlay({ mode: 'menu', position: point }),
    onDragStart: (point, _event, element) => {
      setOverlay(null);
      onDragStart?.(widget.id, point, element);
    },
  });

  // A resize handle only ever exists once "Resize" has been chosen from the
  // menu, so its own press is inherently a fresh, unambiguous gesture — no
  // long-press needed, straight into a resize.
  const handleResizeStart = useCallback(
    (point: Point, _event: Event, corner: ResizeCorner) => {
      setOverlay(null);
      onResizeStart?.(widget.id, corner, point);
    },
    [onResizeStart, widget.id]
  );

  const resizeCorners = isAutoExpand ? AUTO_EXPAND_RESIZE_HANDLES : MOVE_RESIZE_HANDLES;

  return (
    <div
      className={overlay ? 'grid-widget grid-widget--menu-open' : 'grid-widget'}
      onMouseDown={longPress.onMouseDown}
      onTouchStart={longPress.onTouchStart}
      onContextMenu={(event) => {
        // Desktop right-click is an unambiguous "show me the menu" signal —
        // skips the hold delay entirely. Matches useLongPress's own
        // exclusion so it doesn't steal a right-click meant for genuinely
        // interactive content (e.g. an input's native context menu).
        if ((event.target as HTMLElement).closest(WIDGET_GESTURE_SKIP_SELECTOR)) return;
        event.preventDefault();
        setOverlay({ mode: 'menu', position: { x: event.clientX, y: event.clientY } });
      }}
    >
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

      {overlay?.mode === 'menu' && (
        <WidgetContextMenu
          position={overlay.position}
          widget={widget}
          definition={definition}
          onClose={closeOverlay}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleAutoExpand={() => onUpdateWidget(widget.id, { autoExpand: !widget.autoExpand })}
          onResize={() => setOverlay({ mode: 'resize' })}
          onDelete={() => onRemove(widget.id)}
        />
      )}

      {overlay?.mode === 'resize' &&
        resizeCorners.map((corner) => <ResizeHandle key={corner} corner={corner} onResizeStart={handleResizeStart} />)}
    </div>
  );
}

export default memo(WidgetShell);
