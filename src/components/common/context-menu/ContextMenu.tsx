'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ContextMenuPosition = { x: number; y: number };

type ContextMenuProps = {
  position: ContextMenuPosition;
  // Composed from MenuItem elements — see MenuItem.tsx.
  children: ReactNode;
};

// A small popup menu with its TOP-LEFT corner pinned to wherever the user
// clicked, rather than being anchored to any particular element —
// portaled to document.body (same SSR-safe mounted-gate as EditorModal)
// so it floats above everything and is never clipped by an ancestor's own
// overflow. Closing on an outside click is the CALLER's responsibility
// (this only stops its own clicks from bubbling to such a listener) since
// what counts as "outside" depends on where the menu is used.
export default function ContextMenu({ position, children }: ContextMenuProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      onClick={(event: MouseEvent) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
