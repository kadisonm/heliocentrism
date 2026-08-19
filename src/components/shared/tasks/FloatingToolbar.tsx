'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type FloatingToolbarPosition = { x: number; y: number };

type FloatingToolbarProps = {
  position: FloatingToolbarPosition;
  children: ReactNode;
};

// A small icon-button row that pops up with its bottom-left corner pinned
// to wherever the user clicked (a task/subtask row), rather than being
// anchored to any particular card — portaled to document.body (same
// SSR-safe mounted-gate as EditorModal) so it floats above everything and
// is never clipped by a widget's own overflow.
export default function FloatingToolbar({ position, children }: FloatingToolbarProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="floating-toolbar"
      style={{ left: position.x, bottom: window.innerHeight - position.y }}
      onClick={(event: MouseEvent) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
