'use client';

import { useState } from 'react';
import Modal from '../../common/Modal';
import SettingsField from '../../common/SettingsField';
import type { TaskList } from '../../../lib/types';

type AddTaskListModalProps = {
  isOpen: boolean;
  // Non-null while editing an existing list — read for its initial name
  // only, matching SubtaskModal's `subtask: Subtask | null` convention.
  list?: TaskList | null;
  // Pre-fills the name field on add. Parent remounts this component (via a
  // `key`) whenever it changes, since this only matters at mount.
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export default function AddTaskListModal({ isOpen, list = null, initialName = '', onClose, onSubmit }: AddTaskListModalProps) {
  const [name, setName] = useState(list?.name ?? initialName);
  const isEditing = list !== null;

  const resetAndClose = () => {
    setName('');
    onClose();
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onSubmit(trimmedName);
    resetAndClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={isEditing ? 'Edit List' : 'New List'}>
      {/* A <form> so Enter in the name field submits natively, no keydown handler needed. */}
      <form
        className="settings-section"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <SettingsField
          label="Name"
          value={name}
          onChange={setName}
          placeholder="List name"
        />

        <div className="settings-actions">
          <button
            type="submit"
            className="settings-button settings-button-primary"
            disabled={!name.trim()}
          >
            {isEditing ? 'Save' : 'Create List'}
          </button>

          <button type="button" className="settings-button" onClick={resetAndClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
