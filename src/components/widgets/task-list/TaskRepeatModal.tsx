'use client';

import { useState } from 'react';
import type { Task, TaskRepeat } from '../../../lib/types';
import EditorActions from '../../shared/editor/EditorActions';
import EditorModal from '../../shared/editor/EditorModal';
import EditorRepeatFields from '../../shared/editor/EditorRepeatFields';

type TaskRepeatModalProps = {
  isOpen: boolean;
  task: Task | null; // null while closed
  onClose: () => void;
  onSubmit: (task: Task) => void;
};

// A focused quick-edit surface for just a task's repeat schedule, opened by
// clicking its clock badge — the same EditorRepeatFields used inline in
// TaskModal, so both entry points edit the exact same data with no
// duplicated fields/logic.
export default function TaskRepeatModal({ isOpen, task, onClose, onSubmit }: TaskRepeatModalProps) {
  const [draftRepeat, setDraftRepeat] = useState<TaskRepeat | undefined>(task?.repeat);

  const handleSubmit = () => {
    if (!task) return;
    onSubmit({ ...task, repeat: draftRepeat });
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
