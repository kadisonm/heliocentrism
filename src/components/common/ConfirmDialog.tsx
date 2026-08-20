'use client';

import Modal from './Modal';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Generic yes/no confirmation, built on the shared Modal shell — the first
// (and, deliberately, only) confirmation UI in the app.
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div className="settings-section">
        <p className="confirm-dialog__message">{message}</p>

        <div className="settings-actions">
          <button
            type="button"
            className={`settings-button ${danger ? 'settings-button-danger' : 'settings-button-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className="settings-button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
