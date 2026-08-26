'use client';

import { Layers, Square, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalScope = 'instance' | 'shared';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  // 'instance' = affects only this widget (e.g. Photo's image URL); 'shared'
  // = affects every instance of the widget type (e.g. Pomodoro minutes).
  // Omit for non-per-widget modals (general settings, sync config).
  scope?: ModalScope;
  scopeLabel?: string;
  children: ReactNode;
};

const SCOPE_ICONS: Record<ModalScope, typeof Square> = {
  instance: Square,
  shared: Layers,
};

export default function Modal({ isOpen, onClose, title, scope, scopeLabel, children }: ModalProps) {
  // react-grid-layout positions widgets via CSS transform, making them a
  // containing block for position:fixed — portal to document.body to escape
  // it. document doesn't exist during SSR, so only render once mounted.
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
