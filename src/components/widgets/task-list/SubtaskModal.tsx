'use client';

import { useState } from 'react';
import type { TaskRepeat } from '../../../lib/types';
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

// Add-only — editing an existing subtask's title/description happens
// inline now, and due/repeat each have their own dedicated badge.
type SubtaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: SubtaskFormValues) => void;
};

function createDraftValues(): SubtaskFormValues {
  return { title: '', description: '', due: '', repeat: undefined };
}

export default function SubtaskModal({ isOpen, onClose, onSubmit }: SubtaskModalProps) {
  const [draft, setDraft] = useState<SubtaskFormValues>(createDraftValues);

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
      title="Add Subtask"
      onClose={onClose}
      actions={<EditorActions onCancel={onClose} onSave={handleSubmit} saveLabel="Add Subtask" />}
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
