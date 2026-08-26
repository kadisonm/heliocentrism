import type { MouseEvent } from 'react';
import type { ContextMenuPosition } from '../../common/context-menu/ContextMenu';

// Where a row's "..." context menu should anchor — the click point itself;
// ContextMenu picks whichever of its own corners to pin there.
export function toContextMenuPosition(event: MouseEvent): ContextMenuPosition {
  return { x: event.clientX, y: event.clientY };
}
