'use client';

import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { getEventPoint, type Point } from '../../lib/grid/pointerEvents';

export type ResizeCorner = 'se' | 'sw' | 'e' | 'w';

type ResizeHandleProps = {
  corner: ResizeCorner;
  onResizeStart: (point: Point, event: Event, corner: ResizeCorner) => void;
};

// Only rendered once a widget's own long-press menu is already open (see
// WidgetShell) — unlike the whole-widget move drag, this handle's own
// mousedown/touchstart is inherently a fresh, unambiguous gesture (it can't
// exist before the menu does), so it starts tracking a resize immediately,
// no long-press needed.
export default function ResizeHandle({ corner, onResizeStart }: ResizeHandleProps) {
  const start = (event: ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const point = getEventPoint(event.nativeEvent);
    if (!point) return;
    onResizeStart(point, event.nativeEvent, corner);
  };

  return (
    <div
      className={`grid-widget-resize-handle grid-widget-resize-handle--${corner}`}
      onMouseDown={start}
      onTouchStart={start}
    />
  );
}
