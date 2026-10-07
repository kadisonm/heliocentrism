'use client';

import { ArrowRight } from 'lucide-react';
import { requestTaskFocus } from '../../../lib/grid/taskFocus';
import type { TaskStageDef } from '../../../lib/types';
import TaskStageBadge from '../../shared/tasks/TaskStageBadge';
import { getDueUrgency } from '../task-list/dueDate';
import { renderDueBadge } from '../task-list/taskBadges';

type DueTaskRowProps = {
  variant: 'task' | 'subtask';
  item: { id: string; title: string; description?: string; due: string; stage: number };
  stageDef: TaskStageDef; // a subtask's stage indexes into its parent's stages
  listId: string;
  listName: string;
  now: Date;
};

// Read-only preview of a task or subtask; the arrow jumps to it in its Task List widget.
export default function DueTaskRow({ variant, item, stageDef, listId, listName, now }: DueTaskRowProps) {
  const urgency = getDueUrgency(item.due, now);

  return (
    <div className={`due-task due-task--${variant} due-task--${urgency}`}>
      <div className="due-task__content">
        <span className="due-task__title">{item.title}</span>
        {item.description && <p className="due-task__description">{item.description}</p>}
        <div className="due-task__footer">
          <TaskStageBadge stageDef={stageDef} stageIndex={item.stage} />
          {renderDueBadge(item, undefined, now)}
          {variant === 'task' && <span className="due-task__list">{listName}</span>}
        </div>
      </div>
      <button
        type="button"
        className="due-task__jump"
        onClick={() => requestTaskFocus({ taskId: item.id, listId })}
        title={`Show in ${listName}`}
        aria-label={`Show ${item.title} in ${listName}`}
      >
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
