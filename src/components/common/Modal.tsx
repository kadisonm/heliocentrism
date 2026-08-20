'use client';

import { Layers, Square, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalScope = 'instance' | 'shared';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  // Clarifies whether this modal's settings affect just the one widget it
  // was opened from ('instance', e.g. Photo's own image URL) or every
  // instance of that widget type at once ('shared', e.g. Pomodoro's
  // study/break minutes). Omit for modals that aren't per-widget settings
  // at all (general app settings, sync config).
  scope?: ModalScope;
  scopeLabel?: string;
  children: ReactNode;
};

const SCOPE_ICONS: Record<ModalScope, typeof Square> = {
  instance: Square,
  shared: Layers,
};

export default function Modal({ isOpen, onClose, title, scope, scopeLabel, children }: ModalProps) {
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const ScopeIcon = scope ? SCOPE_ICONS[scope] : null;

  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-header-titles">
            <h2>{title}</h2>
            {ScopeIcon && scopeLabel && (
              <span className={`settings-scope-badge settings-scope-badge--${scope}`}>
                <ScopeIcon size={12} />
                {scopeLabel}
              </span>
            )}
          </div>
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
