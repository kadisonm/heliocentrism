import type { MouseEvent } from 'react';
import { getTaskStageIcon } from '../../../lib/tasks/taskStageIcons';
import type { TaskStageDef } from '../../../lib/types';
import Badge from '../../common/Badge';
import { isBlankStage, stageAriaLabel } from './taskStageDisplay';

type TaskStageBadgeProps = {
  stageDef: TaskStageDef;
  stageIndex: number;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void; // omit for a read-only badge
};

// A task's current stage as a badge; renders nothing for a blank (unnamed, uncoloured, icon-less) stage.
export default function TaskStageBadge({ stageDef, stageIndex, onClick }: TaskStageBadgeProps) {
  if (isBlankStage(stageDef)) return null;
  return (
    <Badge
      icon={getTaskStageIcon(stageDef.icon)}
      title={stageDef.name || undefined}
      ariaLabel={`Stage: ${stageAriaLabel(stageDef, stageIndex)}`}
      color={stageDef.color}
      onClick={onClick}
    />
  );
}
