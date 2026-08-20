'use client';

import { useState } from 'react';
import type { Task } from '../../../lib/types';
import EditorActions from '../../shared/editor/EditorActions';
import EditorDueField from '../../shared/editor/EditorDueField';
import EditorModal from '../../shared/editor/EditorModal';

type TaskDueModalProps = {
  isOpen: boolean;
  task: Task | null; // null while closed
  onClose: () => void;
  onSubmit: (task: Task) => void;
};

// A focused quick-edit surface for just a task's due date, opened by
// clicking its calendar badge — mirrors TaskRepeatModal, reusing the same
// EditorDueField that TaskModal uses inline so both entry points edit the
// exact same data with no duplicated fields/logic.
export default function TaskDueModal({ isOpen, task, onClose, onSubmit }: TaskDueModalProps) {
  const [draftDue, setDraftDue] = useState(task?.due ?? '');

  const handleSubmit = () => {
    if (!task) return;
    onSubmit({ ...task, due: draftDue });
  };

  return (
    <EditorModal
      isOpen={isOpen}
      title="Edit Due Date"
      onClose={onClose}
      actions={<EditorActions onCancel={onClose} onSave={handleSubmit} saveLabel="Save" />}
    >
      <EditorDueField value={draftDue} onChange={setDraftDue} />
    </EditorModal>
  );
}
