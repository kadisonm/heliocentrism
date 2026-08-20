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

// A focused quick-edit surface for just a due date, opened by clicking a
// calendar badge — works on the plain value rather than a Task, so the same
// modal serves both a task's and a subtask's due date (mirrors
// TaskRepeatModal). Reuses the same EditorDueField that TaskModal uses
// inline so every entry point edits the exact same data with no duplicated
// fields/logic.
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
