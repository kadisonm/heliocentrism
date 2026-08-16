'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type EditorModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
};

// Shared shell for task-editing modals (routine tasks, todos) — an overlay
// + panel with a header/close button, a fields section, and an actions row.
// Visually distinct from common/Modal.tsx (used by Settings-style modals):
// same portal-to-body/mounted-gate mechanics, different chrome.
export default function EditorModal({ isOpen, title, onClose, children, actions }: EditorModalProps) {
  // Widgets are positioned by react-grid-layout via CSS `transform`, which
  // makes them a containing block for `position: fixed` descendants — this
  // modal would otherwise be trapped inside its widget's box instead of
  // covering the viewport. Portaling to document.body escapes that.
  // document doesn't exist during SSR, so the portal only renders once
  // mounted on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-panel" onClick={(event) => event.stopPropagation()}>
        <div className="editor-header">
          <h3>{title}</h3>
          <button type="button" className="editor-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="editor-fields">{children}</div>

        <div className="editor-actions">{actions}</div>
      </div>
    </div>,
    document.body
  );
}
