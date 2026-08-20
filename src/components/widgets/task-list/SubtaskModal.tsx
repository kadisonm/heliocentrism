'use client';

import { useState } from 'react';
import type { Subtask, TaskRepeat } from '../../../lib/types';
import EditorActions from '../../shared/editor/EditorActions';
import EditorDueField from '../../shared/editor/EditorDueField';
import EditorField from '../../shared/editor/EditorField';
import EditorModal from '../../shared/editor/EditorModal';
import EditorRepeatFields from '../../shared/editor/EditorRepeatFields';

export type SubtaskFormValues = {
  title: string;
  description?: string;
  due: string;
  repeat?: TaskRepeat;
};

type SubtaskModalProps = {
  isOpen: boolean;
  subtask: Subtask | null; // non-null while editing — read for initial values only
  onClose: () => void;
  onSubmit: (values: SubtaskFormValues) => void;
};

function createDraftValues(subtask: Subtask | null): SubtaskFormValues {
  return subtask
    ? { title: subtask.title, description: subtask.description, due: subtask.due, repeat: subtask.repeat }
    : { title: '', description: '', due: '', repeat: undefined };
}

export default function SubtaskModal({ isOpen, subtask, onClose, onSubmit }: SubtaskModalProps) {
  const [draft, setDraft] = useState<SubtaskFormValues>(() => createDraftValues(subtask));
  const isEditing = subtask !== null;

  const updateDraft = <K extends keyof SubtaskFormValues>(field: K, value: SubtaskFormValues[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) return;
    onSubmit({ ...draft, title: trimmedTitle });
  };

  return (
    <EditorModal
      isOpen={isOpen}
      title={isEditing ? 'Edit Subtask' : 'Add Subtask'}
      onClose={onClose}
      actions={
        <EditorActions
          onCancel={onClose}
          onSave={handleSubmit}
          saveLabel={isEditing ? 'Save' : 'Add Subtask'}
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

      <EditorDueField value={draft.due} onChange={(due) => updateDraft('due', due)} />

      <EditorRepeatFields repeat={draft.repeat} onChange={(repeat) => updateDraft('repeat', repeat)} />
    </EditorModal>
  );
}
