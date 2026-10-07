import { buildDueTaskGroups } from '../../lib/tasks/dueTasks';
import type { Subtask, Task } from '../../lib/types';

const NOW = new Date(2026, 9, 8, 12, 0); // Thu 8 Oct 2026, noon
const STAGES = [
  { id: 's0', name: '', color: 'none' as const },
  { id: 's1', name: '', color: 'none' as const },
];

function task(id: string, due = '', listId = 'list', done = false): Task {
  return {
    id,
    parentId: listId,
    order: 0,
    title: id,
    stage: done ? 1 : 0,
    stages: STAGES,
    due,
    createdAt: '',
    updatedAt: '',
    completedAt: null,
  };
}

function subtask(id: string, parentId: string, due: string, done = false): Subtask {
  return { id, parentId, order: 0, title: id, stage: done ? 1 : 0, due, completedAt: null };
}

const options = { now: NOW, includeList: () => true, withinDays: null };
const ids = (groups: ReturnType<typeof buildDueTaskGroups>) => groups.map((g) => [g.task.id, ...g.subtasks.map((s) => s.id)]);

describe('buildDueTaskGroups', () => {
  it('orders groups by their earliest due date, parent or subtask', () => {
    const tasks = [task('a', '2026-10-20T09:00'), task('b', '2026-10-09T09:00'), task('c')];
    const subtasks = [subtask('a1', 'a', '2026-10-25T09:00'), subtask('a2', 'a', '2026-10-07T09:00'), subtask('c1', 'c', '2026-10-10T09:00')];
    expect(ids(buildDueTaskGroups(tasks, subtasks, options))).toEqual([['a', 'a2', 'a1'], ['b'], ['c', 'c1']]);
  });

  it('skips finished tasks and subtasks, and excluded lists', () => {
    const tasks = [task('a', '2026-10-09T09:00', 'list', true), task('b'), task('c', '2026-10-09T09:00', 'hidden')];
    const subtasks = [subtask('b1', 'b', '2026-10-09T09:00', true)];
    const groups = buildDueTaskGroups(tasks, subtasks, { ...options, includeList: (id) => id !== 'hidden' });
    expect(groups).toEqual([]);
  });

  it('limits to the next N days but always keeps overdue items', () => {
    const tasks = [task('overdue', '2026-09-01T09:00'), task('soon', '2026-10-10T23:00'), task('later', '2026-10-11T09:00')];
    expect(ids(buildDueTaskGroups(tasks, [], { ...options, withinDays: 2 }))).toEqual([['overdue'], ['soon']]);
  });
});
