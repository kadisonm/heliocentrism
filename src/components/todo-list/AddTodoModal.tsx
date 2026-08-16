'use client';

import { useState } from 'react';
import type { Todo } from '../../lib/types';
import Modal from '../common/Modal';
import SettingsField from '../common/SettingsField';

type AddTodoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  // createdAt/updatedAt/completedAt are stamped by useTodos' addTodo.
  onAdd: (todo: Omit<Todo, 'createdAt' | 'updatedAt' | 'completedAt'>) => void;
};

export default function AddTodoModal({ isOpen, onClose, onAdd }: AddTodoModalProps) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  const resetAndClose = () => {
    setTitle('');
    setDue('');
    onClose();
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onAdd({
      id: crypto.randomUUID(),
      title: trimmedTitle,
      due: due.trim(),
      stage: 0,
      subtasks: [],
    });
    resetAndClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Add Task">
      <div className="settings-section">
        <SettingsField
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="Task title"
        />

        <SettingsField
          label="Due"
          value={due}
          onChange={setDue}
          placeholder="e.g. Friday"
        />

        <div className="settings-actions">
          <button
            type="button"
            className="settings-button settings-button-primary"
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            Add Task
          </button>

          <button type="button" className="settings-button" onClick={resetAndClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
