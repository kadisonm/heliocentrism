'use client';

import { useState } from 'react';
import type { RecurrenceValue, RoutineTask, Subtask } from '../../../lib/types';
import EditorActions from '../../shared/editor/EditorActions';
import EditorField from '../../shared/editor/EditorField';
import EditorModal from '../../shared/editor/EditorModal';
import EditorSubtaskList from '../../shared/editor/EditorSubtaskList';

type RoutineTaskModalProps = {
  isOpen: boolean;
  task: RoutineTask | null; // null while creating a new task
  onClose: () => void;
  // createdAt/updatedAt/completedAt are (re)stamped by useRoutineTasks.
  onSubmit: (task: RoutineTask) => void;
  // When set, a newly created task always gets this recurrence and the
  // picker below is hidden — used by the per-cadence widgets (Daily/Weekly/
  // Monthly Routine), which only ever add tasks into their own section.
  // Editing an existing task always allows changing its recurrence.
  fixedRecurrence?: RecurrenceValue;
};

function createDraftTask(fixedRecurrence?: RecurrenceValue): RoutineTask {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    stage: 0,
    subtasks: [],
    recurrence: fixedRecurrence ?? 'daily',
    createdAt: '',
    updatedAt: '',
    completedAt: null,
  };
}

export default function RoutineTaskModal({
  isOpen,
  task,
  onClose,
  onSubmit,
  fixedRecurrence,
}: RoutineTaskModalProps) {
  const [draft, setDraft] = useState<RoutineTask>(() => task ?? createDraftTask(fixedRecurrence));
  const isEditing = task !== null;
  const showRecurrencePicker = isEditing || !fixedRecurrence;

  const updateDraft = <K extends keyof RoutineTask>(field: K, value: RoutineTask[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const addSubtask = (title: string) => {
    const subtask: Subtask = { id: crypto.randomUUID(), title, stage: 0 };
    updateDraft('subtasks', [...draft.subtasks, subtask]);
  };

  const removeSubtask = (id: string) => {
    updateDraft(
      'subtasks',
      draft.subtasks.filter((subtask) => subtask.id !== id)
    );
  };

  const handleSubmit = () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) return;
    onSubmit({ ...draft, title: trimmedTitle });
  };

  return (
    <EditorModal
      isOpen={isOpen}
      title={isEditing ? 'Edit Task' : 'Add Task'}
      onClose={onClose}
      actions={
        <EditorActions
          onCancel={onClose}
          onSave={handleSubmit}
          saveLabel={isEditing ? 'Save' : 'Add Task'}
        />
      }
    >
      <EditorField label="Title">
        <input
          type="text"
          value={draft.title}
          onChange={(event) => updateDraft('title', event.target.value)}
        />
      </EditorField>

      <EditorField label="Description">
        <input
          type="text"
          value={draft.description ?? ''}
          onChange={(event) => updateDraft('description', event.target.value)}
        />
      </EditorField>

      {showRecurrencePicker && (
        <EditorField label="Recurring">
          <select
            value={draft.recurrence}
            onChange={(event) => updateDraft('recurrence', event.target.value as RecurrenceValue)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </EditorField>
      )}

      <EditorField label="Subtasks" as="div">
        <EditorSubtaskList subtasks={draft.subtasks} onAdd={addSubtask} onRemove={removeSubtask} />
      </EditorField>
    </EditorModal>
  );
}
