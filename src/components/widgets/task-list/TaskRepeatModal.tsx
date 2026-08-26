'use client';

import { useState } from 'react';
import type { TaskRepeat } from '../../../lib/types';
import EditorActions from '../../shared/editor/EditorActions';
import EditorModal from '../../shared/editor/EditorModal';
import EditorRepeatFields from '../../shared/editor/EditorRepeatFields';

type TaskRepeatModalProps = {
  isOpen: boolean;
  repeat: TaskRepeat | undefined; // current value, whether editing a task's or a subtask's
  onClose: () => void;
  onSubmit: (repeat: TaskRepeat | undefined) => void;
};

// Quick-edit surface for just a repeat schedule. Works on the plain value
// rather than a Task, so it serves both tasks and subtasks (mirrors TaskDueModal).
export default function TaskRepeatModal({ isOpen, repeat, onClose, onSubmit }: TaskRepeatModalProps) {
  const [draftRepeat, setDraftRepeat] = useState<TaskRepeat | undefined>(repeat);

  const handleSubmit = () => {
    onSubmit(draftRepeat);
  };

  return (
    <EditorModal
      isOpen={isOpen}
      title="Edit Repeat"
      onClose={onClose}
      actions={<EditorActions onCancel={onClose} onSave={handleSubmit} saveLabel="Save" />}
    >
      <EditorRepeatFields repeat={draftRepeat} onChange={setDraftRepeat} />
    </EditorModal>
  );
}
