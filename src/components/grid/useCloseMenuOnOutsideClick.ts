'use client';

import { useEffect } from 'react';

// ContextMenu itself only stops its own clicks from bubbling — closing on an
// outside interaction is deliberately left to each caller (see its own doc
// comment). Shared here since WidgetShell's and Grid.tsx's canvas menu both
// need the identical pattern task-list's own "..." menu already uses.
//
// Listens for mousedown/touchstart, not click: these menus open from a
// long-press's own onLongPress firing mid-hold, not from the eventual
// release — and a long-press's release still fires a native 'click' on
// whatever element it started on (mousedown/touchstart -> [500ms, no
// movement] -> mouseup/touchend still counts as a click; useLongPress never
// calls preventDefault to suppress it). A 'click'-based outside listener
// attached the instant the menu opens would catch that SAME release and
// instantly close the menu it just opened, regardless of how long the hold
// lasted. mousedown/touchstart can't have this problem: the gesture that
// opened the menu already fired its own mousedown/touchstart up to 500ms in
// the past, before this listener even existed, so a freshly-attached
// listener can never retroactively catch it.
export function useCloseMenuOnOutsideClick(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.context-menu')) return;
      onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen, onClose]);
}
