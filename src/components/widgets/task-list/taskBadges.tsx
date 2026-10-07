import { Calendar, RefreshCw } from 'lucide-react';
import { formatNextOccurrence, formatNextOccurrenceFull } from '../../../lib/tasks/taskRepeat';
import type { Subtask, Task, TaskRepeat } from '../../../lib/types';
import Badge from '../../common/Badge';
import { dueBadgeColor, formatDue, formatDueFull, getDueUrgency } from './dueDate';
import type { EditTarget } from './editTarget';

// Works for tasks and subtasks alike. Omit onClick for a read-only badge (e.g. the Due Tasks preview).
export function renderDueBadge(item: { due: string }, onClick?: () => void, now?: Date) {
  if (!item.due) return undefined;
  return (
    <Badge
      icon={Calendar}
      title={formatDue(item.due, now)}
      ariaLabel={`Due ${formatDueFull(item.due)}`}
      color={dueBadgeColor(getDueUrgency(item.due, now))}
      onClick={
        onClick &&
        ((event) => {
          event.stopPropagation();
          onClick();
        })
      }
    />
  );
}

export function renderRepeatBadge(item: { repeat?: TaskRepeat }, onClick: () => void) {
  if (!item.repeat) return undefined;
  return (
    <Badge
      icon={RefreshCw}
      title={formatNextOccurrence(item.repeat)}
      ariaLabel={`Repeats ${formatNextOccurrenceFull(item.repeat)}`}
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
      {renderRepeatBadge(subtask, () => onEditRepeat({ type: 'subtask', subtask }))}
      {renderDueBadge(subtask, () => onEditDue({ type: 'subtask', subtask }))}
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
