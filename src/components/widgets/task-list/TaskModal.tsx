'use client';

import { useState } from 'react';
import { createDefaultStages } from '../../../lib/tasks/taskCascade';
import type { Task } from '../../../lib/types';
import EditorActions from '../../shared/editor/EditorActions';
import EditorDueField from '../../shared/editor/EditorDueField';
import EditorField from '../../shared/editor/EditorField';
import EditorModal from '../../shared/editor/EditorModal';
import EditorRepeatFields from '../../shared/editor/EditorRepeatFields';
import EditorStagesField from '../../shared/editor/EditorStagesField';
import EditorSubtaskList, { type SubtaskDraft } from '../../shared/editor/EditorSubtaskList';

type TaskDraft = Omit<Task, 'parentId' | 'order' | 'createdAt' | 'updatedAt' | 'completedAt'>;

// Add-only — editing an existing task's title/description happens inline
// now, and stage/due/repeat each have their own dedicated badge.
type TaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  // createdAt/updatedAt/completedAt/parentId/order are (re)stamped by
  // useTaskLists' addTask.
  onSubmit: (task: TaskDraft, subtasks: SubtaskDraft[]) => void;
};

function createDraftTask(): TaskDraft {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    due: '',
    stage: 0,
    stages: createDefaultStages(),
  };
}

export default function TaskModal({ isOpen, onClose, onSubmit }: TaskModalProps) {
  const [draft, setDraft] = useState<TaskDraft>(createDraftTask);
  const [subtaskDrafts, setSubtaskDrafts] = useState<SubtaskDraft[]>([]);

  const updateDraft = <K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const addSubtask = (title: string) => {
    const subtask: SubtaskDraft = {
      id: crypto.randomUUID(),
      title,
      description: '',
      stage: 0,
      due: '',
      repeat: undefined,
      completedAt: null,
    };
    setSubtaskDrafts((current) => [...current, subtask]);
  };

  const removeSubtask = (id: string) => {
    setSubtaskDrafts((current) => current.filter((subtask) => subtask.id !== id));
  };

  const updateSubtask = (id: string, patch: Partial<SubtaskDraft>) => {
    setSubtaskDrafts((current) => current.map((subtask) => (subtask.id === id ? { ...subtask, ...patch } : subtask)));
  };

  const handleSubmit = () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) return;
    const maxIndex = draft.stages.length - 1;
    onSubmit(
      { ...draft, title: trimmedTitle, stage: Math.min(draft.stage, maxIndex) },
      subtaskDrafts.map((subtask) => ({ ...subtask, stage: Math.min(subtask.stage, maxIndex) }))
    );
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
          subtasks={subtaskDrafts}
          onAdd={addSubtask}
          onRemove={removeSubtask}
          onUpdate={updateSubtask}
        />
      </EditorField>
    </EditorModal>
  );
}
