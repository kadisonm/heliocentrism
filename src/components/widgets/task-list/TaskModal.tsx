'use client';

import { useState } from 'react';
import { clampTaskStages, createDefaultStages } from '../../../lib/taskCascade';
import type { Subtask, Task } from '../../../lib/types';
import EditorActions from '../../shared/editor/EditorActions';
import EditorDueField from '../../shared/editor/EditorDueField';
import EditorField from '../../shared/editor/EditorField';
import EditorModal from '../../shared/editor/EditorModal';
import EditorRepeatFields from '../../shared/editor/EditorRepeatFields';
import EditorStagesField from '../../shared/editor/EditorStagesField';
import EditorSubtaskList from '../../shared/editor/EditorSubtaskList';

// Add-only — editing an existing task's title/description happens inline
// now, and stage/due/repeat each have their own dedicated badge.
type TaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  // createdAt/updatedAt/completedAt are (re)stamped by useTaskLists.
  onSubmit: (task: Task) => void;
};

function createDraftTask(): Task {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    due: '',
    stage: 0,
    stages: createDefaultStages(),
    subtasks: [],
    createdAt: '',
    updatedAt: '',
    completedAt: null,
  };
}

export default function TaskModal({ isOpen, onClose, onSubmit }: TaskModalProps) {
  const [draft, setDraft] = useState<Task>(createDraftTask);

  const updateDraft = <K extends keyof Task>(field: K, value: Task[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const addSubtask = (title: string) => {
    const subtask: Subtask = {
      id: crypto.randomUUID(),
      title,
      description: '',
      stage: 0,
      due: '',
      repeat: undefined,
      completedAt: null,
    };
    updateDraft('subtasks', [...draft.subtasks, subtask]);
  };

  const removeSubtask = (id: string) => {
    updateDraft(
      'subtasks',
      draft.subtasks.filter((subtask) => subtask.id !== id)
    );
  };

  const updateSubtask = (id: string, patch: Partial<Subtask>) => {
    updateDraft(
      'subtasks',
      draft.subtasks.map((subtask) => (subtask.id === id ? { ...subtask, ...patch } : subtask))
    );
  };

  const handleSubmit = () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) return;
    onSubmit(clampTaskStages({ ...draft, title: trimmedTitle }));
  };

  return (
    <EditorModal
      isOpen={isOpen}
      title="Add Task"
      onClose={onClose}
      actions={<EditorActions onCancel={onClose} onSave={handleSubmit} saveLabel="Add Task" />}
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

      <EditorStagesField stages={draft.stages} onChange={(stages) => updateDraft('stages', stages)} />

      <EditorDueField value={draft.due} onChange={(due) => updateDraft('due', due)} />

      <EditorRepeatFields repeat={draft.repeat} onChange={(repeat) => updateDraft('repeat', repeat)} />

      <EditorField label="Subtasks" as="div">
        <EditorSubtaskList
          subtasks={draft.subtasks}
          onAdd={addSubtask}
          onRemove={removeSubtask}
          onUpdate={updateSubtask}
        />
      </EditorField>
    </EditorModal>
  );
}
