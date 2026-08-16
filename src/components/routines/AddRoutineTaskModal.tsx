'use client';

import { useState } from 'react';
import type { RecurrenceValue, RoutineTask } from '../../lib/types';
import Modal from '../common/Modal';
import SettingsField from '../common/SettingsField';

type AddRoutineTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  // createdAt/updatedAt/completedAt are stamped by useRoutineTasks' addTask.
  onAdd: (task: Omit<RoutineTask, 'createdAt' | 'updatedAt' | 'completedAt'>) => void;
  // When set, the new task always gets this recurrence and the picker below
  // is hidden — used by the per-cadence widgets (Daily/Weekly/Monthly
  // Routine), which only ever add tasks into their own section.
  fixedRecurrence?: RecurrenceValue;
};

export default function AddRoutineTaskModal({
  isOpen,
  onClose,
  onAdd,
  fixedRecurrence,
}: AddRoutineTaskModalProps) {
  const [title, setTitle] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(fixedRecurrence ?? 'daily');

  const resolvedRecurrence = fixedRecurrence ?? recurrence;

  const resetAndClose = () => {
    setTitle('');
    setRecurrence(fixedRecurrence ?? 'daily');
    onClose();
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onAdd({
      id: crypto.randomUUID(),
      title: trimmedTitle,
      stage: 0,
      subtasks: [],
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
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value as RecurrenceValue)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
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
