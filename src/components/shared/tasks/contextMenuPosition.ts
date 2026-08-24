import type { MouseEvent } from 'react';
import type { ContextMenuPosition } from '../../common/context-menu/ContextMenu';

// Where a row's "..." context menu should anchor — its top-left corner at
// the click that opened it.
export function toContextMenuPosition(event: MouseEvent): ContextMenuPosition {
  return { x: event.clientX, y: event.clientY };
}
