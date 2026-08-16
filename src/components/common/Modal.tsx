import { X } from 'lucide-react';
import type { ReactNode } from 'react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
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
    </div>
  );
}
