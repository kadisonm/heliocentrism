export type Point = { x: number; y: number };

// Pulls a client point out of either a mouse or touch event — react-grid-
// layout's onDrag, and every hand-rolled gesture in this folder, hands back
// the raw DOM event, which is one or the other depending on input device.
export function getEventPoint(event: Event): Point | null {
  if (typeof MouseEvent !== 'undefined' && event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  const touchEvent = event as TouchEvent;
  const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

export function isPointInRect(point: Point, rect: DOMRect | undefined): boolean {
  if (!rect) return false;
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}
