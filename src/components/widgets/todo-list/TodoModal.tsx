'use client';

import { useState } from 'react';
import type { Subtask, Todo } from '../../../lib/types';
import EditorActions from '../../common/editor/EditorActions';
import EditorField from '../../common/editor/EditorField';
import EditorModal from '../../common/editor/EditorModal';
import EditorSubtaskList from '../../common/editor/EditorSubtaskList';

type TodoModalProps = {
  isOpen: boolean;
  todo: Todo | null; // null while creating a new todo
  onClose: () => void;
  // createdAt/updatedAt/completedAt are (re)stamped by useTodoLists.
  onSubmit: (todo: Todo) => void;
};

function createDraftTodo(): Todo {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    due: '',
    stage: 0,
    subtasks: [],
    createdAt: '',
    updatedAt: '',
    completedAt: null,
  };
}

export default function TodoModal({ isOpen, todo, onClose, onSubmit }: TodoModalProps) {
  const [draft, setDraft] = useState<Todo>(() => todo ?? createDraftTodo());
  const isEditing = todo !== null;

  const updateDraft = <K extends keyof Todo>(field: K, value: Todo[K]) => {
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

  const [dueDatePart, dueTimePart = ''] = draft.due.split('T');

  // A native datetime-local input only reports a value once every subfield
  // (year/month/day/hour/minute) is filled in — pick just a date and it
  // stays empty, silently dropping the due date on save. Splitting into
  // separate date/time inputs avoids that: picking a date alone is already
  // a complete, valid value, and the time defaults to end-of-day.
  const updateDueDate = (dateValue: string) => {
    if (!dateValue) {
      updateDraft('due', '');
      return;
    }
    updateDraft('due', `${dateValue}T${dueTimePart || '23:59'}`);
  };

  const updateDueTime = (timeValue: string) => {
    if (!dueDatePart) return;
    updateDraft('due', `${dueDatePart}T${timeValue || '23:59'}`);
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

      <EditorField label="Due">
        <div className="editor-field-row">
          <input
            type="date"
            value={dueDatePart}
            onChange={(event) => updateDueDate(event.target.value)}
          />
          <input
            type="time"
            value={dueTimePart}
            onChange={(event) => updateDueTime(event.target.value)}
            disabled={!dueDatePart}
          />
        </div>
      </EditorField>

      <EditorField label="Subtasks" as="div">
        <EditorSubtaskList subtasks={draft.subtasks} onAdd={addSubtask} onRemove={removeSubtask} />
      </EditorField>
    </EditorModal>
  );
}
