'use client';

import { useState } from 'react';
import type { Recurrence, Todo } from '../../lib/types';
import Modal from '../common/Modal';
import SettingsField from '../common/SettingsField';

type AddTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (todo: Todo) => void;
  // When set, the new task always gets this recurrence and the picker below
  // is hidden — used by the per-cadence widgets (Daily/Weekly/Monthly
  // Routine), which only ever add tasks into their own section.
  fixedRecurrence?: Recurrence;
};

export default function AddTaskModal({
  isOpen,
  onClose,
  onAdd,
  fixedRecurrence,
}: AddTaskModalProps) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>(fixedRecurrence ?? null);

  const resolvedRecurrence = fixedRecurrence ?? recurrence;
  const isRecurring = resolvedRecurrence !== null;

  const resetAndClose = () => {
    setTitle('');
    setDue('');
    setRecurrence(fixedRecurrence ?? null);
    onClose();
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onAdd({
      id: crypto.randomUUID(),
      title: trimmedTitle,
      due: isRecurring ? '' : due.trim(),
      stage: 0,
      recurrence: resolvedRecurrence,
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

        {!fixedRecurrence && (
          <div className="settings-field">
            <label>Recurrence</label>
            <select
              className="settings-input"
              value={recurrence ?? ''}
              onChange={(event) =>
                setRecurrence((event.target.value || null) as Recurrence)
              }
            >
              <option value="">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        )}

        {!isRecurring && (
          <SettingsField
            label="Due"
            value={due}
            onChange={setDue}
            placeholder="e.g. Friday"
          />
        )}

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
