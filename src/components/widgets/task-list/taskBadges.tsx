import { Calendar, RefreshCw } from 'lucide-react';
import { formatNextOccurrence, formatNextOccurrenceFull } from '../../../lib/tasks/taskRepeat';
import type { Subtask, Task } from '../../../lib/types';
import Badge from '../../common/Badge';
import { dueBadgeColor, formatDue, formatDueFull, getDueUrgency } from './dueDate';
import type { EditTarget } from './editTarget';

export function renderDueBadge(task: Task, onClick: () => void) {
  if (!task.due) return undefined;
  return (
    <Badge
      icon={Calendar}
      title={formatDue(task.due)}
      ariaLabel={`Due ${formatDueFull(task.due)}`}
      color={dueBadgeColor(getDueUrgency(task.due))}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

export function renderRepeatBadge(task: Task, onClick: () => void) {
  if (!task.repeat) return undefined;
  return (
    <Badge
      icon={RefreshCw}
      title={formatNextOccurrence(task.repeat)}
      ariaLabel={`Repeats ${formatNextOccurrenceFull(task.repeat)}`}
      color="muted"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderSubtaskDueBadge(subtask: Subtask, onClick: () => void) {
  if (!subtask.due) return undefined;
  return (
    <Badge
      icon={Calendar}
      title={formatDue(subtask.due)}
      ariaLabel={`Due ${formatDueFull(subtask.due)}`}
      color={dueBadgeColor(getDueUrgency(subtask.due))}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderSubtaskRepeatBadge(subtask: Subtask, onClick: () => void) {
  if (!subtask.repeat) return undefined;
  return (
    <Badge
      icon={RefreshCw}
      title={formatNextOccurrence(subtask.repeat)}
      ariaLabel={`Repeats ${formatNextOccurrenceFull(subtask.repeat)}`}
      color="muted"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

export function renderSubtaskExtra(
  subtask: Subtask,
  onEditRepeat: (target: EditTarget) => void,
  onEditDue: (target: EditTarget) => void
) {
  return (
    <>
      {renderSubtaskRepeatBadge(subtask, () => onEditRepeat({ type: 'subtask', subtask }))}
      {renderSubtaskDueBadge(subtask, () => onEditDue({ type: 'subtask', subtask }))}
    </>
  );
}

// "Set due date"/"Set repeat" placeholders — passed as editExtra/
// renderSubtaskEditExtra, revealed only in a row's edit mode (see
// TaskRow.tsx's isEditingRow), so these never show for a field that's
// already set.
function renderSetDueBadge(onClick: () => void) {
  return (
    <Badge
      icon={Calendar}
      title="Set due date"
      ariaLabel="Set due date"
      className="badge--ghost"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function renderSetRepeatBadge(onClick: () => void) {
  return (
    <Badge
      icon={RefreshCw}
      title="Set repeat"
      ariaLabel="Set repeat"
      className="badge--ghost"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

export function renderTaskEditExtra(
  task: Task,
  onEditRepeat: (target: EditTarget) => void,
  onEditDue: (target: EditTarget) => void
) {
  return (
    <>
      {!task.repeat && renderSetRepeatBadge(() => onEditRepeat({ type: 'task', task }))}
      {!task.due && renderSetDueBadge(() => onEditDue({ type: 'task', task }))}
    </>
  );
}

export function renderSubtaskEditExtra(
  subtask: Subtask,
  onEditRepeat: (target: EditTarget) => void,
  onEditDue: (target: EditTarget) => void
) {
  return (
    <>
      {!subtask.repeat && renderSetRepeatBadge(() => onEditRepeat({ type: 'subtask', subtask }))}
      {!subtask.due && renderSetDueBadge(() => onEditDue({ type: 'subtask', subtask }))}
    </>
  );
}
