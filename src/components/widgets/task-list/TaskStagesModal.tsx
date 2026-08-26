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

// Task-only: subtasks share their parent task's `stages` array rather than
// having one of their own, so editing here reshapes every subtask's stages
// too. Caller must clamp each subtask's (and the task's own) current stage
// index if the list shrinks (see clampTaskStages in taskCascade.ts).
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
