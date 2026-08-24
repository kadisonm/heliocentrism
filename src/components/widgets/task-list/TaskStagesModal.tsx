'use client';

import { useState } from 'react';
import type { TaskStageDef } from '../../../lib/types';
import EditorActions from '../../shared/editor/EditorActions';
import EditorModal from '../../shared/editor/EditorModal';
import EditorStagesField from '../../shared/editor/EditorStagesField';

type TaskStagesModalProps = {
  isOpen: boolean;
  stages: TaskStageDef[];
  onClose: () => void;
  onSubmit: (stages: TaskStageDef[]) => void;
};

// A focused quick-edit surface for a task's Stage list, opened by clicking
// its Stage badge — reuses the same EditorStagesField TaskModal uses
// inline, so this edits the exact same data with no duplicated fields/
// logic. Task-only: subtasks share their parent task's `stages` array
// (see TaskParent.tsx) rather than having one of their own, so editing here
// reshapes every subtask's available stages too — the caller is
// responsible for clamping each subtask's (and the task's own) current
// stage index if the list shrinks (see clampTaskStages in taskCascade.ts).
export default function TaskStagesModal({ isOpen, stages, onClose, onSubmit }: TaskStagesModalProps) {
  const [draftStages, setDraftStages] = useState<TaskStageDef[]>(stages);

  const handleSubmit = () => {
    onSubmit(draftStages);
  };

  return (
    <EditorModal
      isOpen={isOpen}
      title="Edit Stages"
      onClose={onClose}
      actions={<EditorActions onCancel={onClose} onSave={handleSubmit} saveLabel="Save" />}
    >
      <EditorStagesField stages={draftStages} onChange={setDraftStages} />
    </EditorModal>
  );
}
