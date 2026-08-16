'use client';

import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Widgets are positioned by react-grid-layout via CSS `transform`, which
  // makes them a containing block for `position: fixed` descendants — a
  // modal rendered directly in the tree would get trapped inside its
  // widget's box instead of covering the viewport. Portaling to
  // document.body escapes that entirely. document doesn't exist during
  // SSR, so the portal only renders once mounted on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Sanctioned "sync from an external system" effect pattern — client-only
    // mount detection can't be derived during render since it would desync
    // the server/client hydration output (document doesn't exist on the server).
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <h2>{title}</h2>
          <button className="settings-close" onClick={onClose} title="Close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">{children}</div>
      </div>
    </div>,
    document.body
  );
}
