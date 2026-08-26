'use client';

import { useState } from 'react';
import EditorActions from '../../shared/editor/EditorActions';
import EditorDueField from '../../shared/editor/EditorDueField';
import EditorModal from '../../shared/editor/EditorModal';

type TaskDueModalProps = {
  isOpen: boolean;
  due: string; // current value, whether editing a task's or a subtask's
  onClose: () => void;
  onSubmit: (due: string) => void;
};

// Quick-edit surface for just a due date. Works on the plain value rather
// than a Task, so it serves both tasks and subtasks (mirrors TaskRepeatModal).
export default function TaskDueModal({ isOpen, due, onClose, onSubmit }: TaskDueModalProps) {
  const [draftDue, setDraftDue] = useState(due);

  const handleSubmit = () => {
    onSubmit(draftDue);
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
