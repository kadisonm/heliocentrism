'use client';

import { useState } from 'react';
import Modal from '../common/Modal';
import SettingsField from '../common/SettingsField';

type AddTodoListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

export default function AddTodoListModal({ isOpen, onClose, onCreate }: AddTodoListModalProps) {
  const [name, setName] = useState('');

  const resetAndClose = () => {
    setName('');
    onClose();
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onCreate(trimmedName);
    resetAndClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="New List">
      <div className="settings-section">
        <SettingsField
          label="Name"
          value={name}
          onChange={setName}
          placeholder="List name"
        />

        <div className="settings-actions">
          <button
            type="button"
            className="settings-button settings-button-primary"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Create List
          </button>

          <button type="button" className="settings-button" onClick={resetAndClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
