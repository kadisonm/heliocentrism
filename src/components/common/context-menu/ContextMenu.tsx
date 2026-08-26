'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ContextMenuPosition = { x: number; y: number };

type ContextMenuProps = {
  position: ContextMenuPosition;
  // Called to close THIS menu when a different one opens anywhere else in
  // the app (see the module-level singleton below) — wire it to whatever
  // makes this instance stop rendering (typically clearing the caller's own
  // "which menu is open" state), the same as a manual dismiss would.
  onClose: () => void;
  // Composed from MenuItem elements — see MenuItem.tsx.
  children: ReactNode;
};

// Minimum gap kept from a viewport edge before that side is treated as
// "too close" and the anchor flips away from it.
const EDGE_MARGIN = 8;

// Whichever ContextMenu instance is currently on screen, app-wide — not
// React state, since it needs to reach across completely unrelated trees
// (e.g. two separate task-list widgets) rather than just one shared parent.
// Holds the CURRENT owner's own close callback, called by the next instance
// to mount so opening any new menu always closes whatever was open before
// it, enforcing "only one context menu on screen at a time" globally.
let activeMenuCloser: (() => void) | null = null;

// Pinned by whichever corner keeps it fully on-screen: top-left by default,
// flipping to the right and/or bottom corner of the click point if the menu
// would otherwise overflow that edge (so it grows left/up instead). Portaled
// to document.body (SSR-safe mounted-gate) to float above everything
// unclipped. Closing on outside click is the caller's responsibility — this
// only stops its own clicks from bubbling to such a listener.
export default function ContextMenu({ position, onClose, children }: ContextMenuProps) {
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // The menu's own rendered size, once known — null on the very first frame
  // (see the layout effect below), before which it renders unflipped.
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  // Kept fresh every render via a ref rather than putting onClose in the
  // claim-slot effect's own dependency array — an inline `onClose={() =>
  // ...}` at a call site is a new function every render, which would
  // otherwise re-fire that effect on every unrelated re-render of the
  // caller (not just open/close) and close the menu it had just opened,
  // immediately, spuriously. Updated from an effect (no deps, so it runs
  // after every render), not during render itself, since refs — unlike
  // state — aren't meant to be written while rendering.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const thisCloser = () => onCloseRef.current();
    activeMenuCloser?.();
    activeMenuCloser = thisCloser;
    return () => {
      // Only release the slot if it's still ours — a newer menu may have
      // already claimed it (and closed this one) before this cleanup runs.
      if (activeMenuCloser === thisCloser) activeMenuCloser = null;
    };
  }, []);

  // Runs before paint so the flip (if any) is already applied on the first
  // frame the menu is actually visible — the menu's size depends on its
  // content, so which corner fits can only be measured once it's in the DOM.
  useLayoutEffect(() => {
    if (!mounted) return;
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSize({ width: rect.width, height: rect.height });
  }, [mounted, position.x, position.y]);

  if (!mounted) return null;

  const flipX = !!size && position.x + size.width > window.innerWidth - EDGE_MARGIN;
  const flipY = !!size && position.y + size.height > window.innerHeight - EDGE_MARGIN;

  // Always positioned via left/top, even when flipped — offsetting by the
  // menu's own measured width/height puts the flipped corner exactly on
  // position, with nothing needing to agree with an assumed viewport size
  // the way `right`/`bottom` (relative to the fixed-position containing
  // block) would.
  const style: CSSProperties = {
    left: flipX && size ? position.x - size.width : position.x,
    top: flipY && size ? position.y - size.height : position.y,
  };

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={style}
      onClick={(event: MouseEvent) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
