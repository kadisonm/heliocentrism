'use client';

import { useMemo } from 'react';
import { useAppSelector } from '../../../lib/store/hooks';
import { buildDueTaskGroups } from '../../../lib/tasks/dueTasks';
import { useWidgetContext } from '../../grid/widgetContext';
import { useNow } from '../../shared/hooks/useNow';
import DueTaskRow from './DueTaskRow';

// Unfinished tasks with due dates (on themselves or their subtasks) across the included lists, soonest first.
export default function DueTasksWidget() {
  const { widget } = useWidgetContext();
  const tasks = useAppSelector((state) => state.taskLists.tasks);
  const subtasks = useAppSelector((state) => state.taskLists.subtasks);
  const taskLists = useAppSelector((state) => state.taskLists.taskLists);
  const isLoading = useAppSelector((state) => state.taskLists.isLoading);
  // Ticks each minute so tasks turn yellow/red as they become due.
  const now = useNow(60_000);

  const listNames = useMemo(() => new Map(taskLists.map((list) => [list.id, list.name])), [taskLists]);
  const groups = useMemo(() => {
    const excluded = new Set(widget.excludedListIds ?? []);
    return buildDueTaskGroups(tasks, subtasks, {
      now,
      includeList: (listId) => listNames.has(listId) && !excluded.has(listId),
      withinDays: widget.dueWithinDays ?? null,
    });
  }, [tasks, subtasks, listNames, widget.excludedListIds, widget.dueWithinDays, now]);

  return (
    <aside className="widget-content-shell">
      <div className="widget-content">
        <div className="widget-content-header">
          <h2>Due Tasks</h2>
        </div>

        {!isLoading && (
          <div className="widget-sections">
            {groups.length > 0 ? (
              <ul className="due-tasks__list">
                {groups.map(({ task, subtasks: dueSubtasks }) => {
                  const listName = listNames.get(task.parentId) ?? '';
                  return (
                    <li key={task.id} className="due-tasks__group">
                      <DueTaskRow
                        variant="task"
                        item={task}
                        stageDef={task.stages[task.stage]}
                        listId={task.parentId}
                        listName={listName}
                        now={now}
                      />
                      {dueSubtasks.map((subtask) => (
                        <DueTaskRow
                          key={subtask.id}
                          variant="subtask"
                          item={subtask}
                          stageDef={task.stages[subtask.stage]}
                          listId={task.parentId}
                          listName={listName}
                          now={now}
                        />
                      ))}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="widget-empty">No tasks with due dates</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
