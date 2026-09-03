'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { getEventPoint, type Point } from '../../lib/grid/pointerEvents';
import { lockGestures, unlockGestures } from '../../lib/gestureLock';

// How long a press must hold before it counts as a long-press — mirrors
// Grid.tsx's own PAGE_HOP_HOLD_MS dwell-timer pattern and TaskDragProvider's
// dnd-kit activation delay, both 500ms.
const LONG_PRESS_MS = 500;
// Movement past this, before the timer fires, cancels it outright (a scroll
// or flick, not a hold) — matches dnd-kit's own activation-constraint
// tolerance for consistency across the app's various long-press gestures.
const MOVE_TOLERANCE_PX = 5;

type UseLongPressOptions = {
  onLongPress: (point: Point, event: Event) => void;
  // Omitted for a long-press with no follow-up drag (e.g. empty-canvas
  // long-press, which only ever opens a menu). When present, movement past
  // MOVE_TOLERANCE_PX on the SAME contact after onLongPress has already
  // fired hands off into a drag instead of continuing to track for another
  // long-press.
  onDragStart?: (point: Point, event: Event, element: HTMLElement) => void;
  disabled?: boolean;
};

type LongPressHandlers = {
  onMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
  onTouchStart: (event: ReactTouchEvent<HTMLElement>) => void;
};

// Elements a long-press should never arm on — a widget's own interactive
// content (a button, a task row's own drag/tap handling) gets first claim to
// its own touchstart/mousedown; only genuinely "dead space" within a widget
// triggers the whole-widget menu. Extend via data-no-widget-drag on a
// per-widget basis as conflicts turn up.
// Exported so a caller wiring a SEPARATE trigger for the same element (e.g.
// WidgetShell's own onContextMenu, for desktop right-click) can apply the
// identical exclusion rather than drifting out of sync with this hook's own.
export const WIDGET_GESTURE_SKIP_SELECTOR = 'button, a, input, textarea, select, [data-no-widget-drag]';

// Shared long-press primitive: hold LONG_PRESS_MS on the same contact to
// fire onLongPress (e.g. open a context menu), then — while that contact is
// still down — moving past the tolerance hands off into onDragStart so a
// drag can continue from the exact same touch/click without requiring a
// second gesture. A tap released before the timer fires, or movement before
// it fires, is left completely alone (no preventDefault/stopPropagation
// here ever), so ordinary interactive content inside a widget keeps working.
export function useLongPress({ onLongPress, onDragStart, disabled }: UseLongPressOptions): LongPressHandlers {
  const optionsRef = useRef({ onLongPress, onDragStart, disabled });
  useLayoutEffect(() => {
    optionsRef.current = { onLongPress, onDragStart, disabled };
  });

  const elementRef = useRef<HTMLElement | null>(null);
  const startRef = useRef<Point | null>(null);
  const firedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenersRef = useRef<{ move: (e: Event) => void; up: (e: Event) => void } | null>(null);
  // True from the moment onLongPress actually fires until this same contact
  // is released or handed off to onDragStart — claims the shared gesture
  // lock (see gestureLock.ts) for exactly that window so Grid.tsx's own
  // page-swipe recognizer backs off instead of racing the same touchmove
  // stream once the hold has committed to being a long-press. Grid's own
  // beginDrag/beginResize independently claim the lock again for the actual
  // drag/resize that may follow — this only covers the brief "menu open,
  // contact still down, not yet dragging" phase in between.
  const lockedRef = useRef(false);

  const detachWindowListeners = useCallback(() => {
    const listeners = listenersRef.current;
    if (!listeners) return;
    window.removeEventListener('mousemove', listeners.move);
    window.removeEventListener('touchmove', listeners.move);
    window.removeEventListener('mouseup', listeners.up);
    window.removeEventListener('touchend', listeners.up);
    window.removeEventListener('touchcancel', listeners.up);
    listenersRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    detachWindowListeners();
    startRef.current = null;
    firedRef.current = false;
    elementRef.current = null;
    if (lockedRef.current) {
      lockedRef.current = false;
      unlockGestures();
    }
  }, [detachWindowListeners]);

  const handleMove = useCallback(
    (nativeEvent: Event) => {
      const point = getEventPoint(nativeEvent);
      const start = startRef.current;
      if (!point || !start) return;
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      if (Math.sqrt(dx * dx + dy * dy) <= MOVE_TOLERANCE_PX) return;

      if (!firedRef.current) {
        // Moved too far before the hold fired at all — a scroll/flick, not
        // a long-press. Bail out entirely; the caller sees nothing.
        reset();
        return;
      }
      const element = elementRef.current;
      const dragStart = optionsRef.current.onDragStart;
      reset();
      if (element && dragStart) dragStart(point, nativeEvent, element);
    },
    [reset]
  );

  const handleUp = useCallback(() => {
    reset();
  }, [reset]);

  const start = useCallback(
    (event: ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>) => {
      if (optionsRef.current.disabled) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(WIDGET_GESTURE_SKIP_SELECTOR)) return;
      const point = getEventPoint(event.nativeEvent);
      if (!point) return;

      reset();
      startRef.current = point;
      elementRef.current = event.currentTarget;

      const move = handleMove;
      const up = handleUp;
      listenersRef.current = { move, up };
      window.addEventListener('mousemove', move);
      window.addEventListener('touchmove', move, { passive: true });
      window.addEventListener('mouseup', up);
      window.addEventListener('touchend', up);
      window.addEventListener('touchcancel', up);

      const nativeEvent = event.nativeEvent;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        firedRef.current = true;
        lockedRef.current = true;
        lockGestures();
        optionsRef.current.onLongPress(point, nativeEvent);
      }, LONG_PRESS_MS);
    },
    [handleMove, handleUp, reset]
  );

  return { onMouseDown: start, onTouchStart: start };
}
