'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ContextMenuPosition = { x: number; y: number };

type ContextMenuProps = {
  position: ContextMenuPosition;
  // Composed from MenuItem elements — see MenuItem.tsx.
  children: ReactNode;
};

// Popup pinned by its top-left corner to the click point; portaled to
// document.body (SSR-safe mounted-gate) to float above everything unclipped.
// Closing on outside click is the caller's responsibility — this only stops
// its own clicks from bubbling to such a listener.
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
