'use client';

import { useSortable } from '@dnd-kit/react/sortable';

// Shared dnd-kit v7 sortable setup for task/subtask rows. No `plugins`
// override on purpose — passing one REPLACES the default list
// ([SortableKeyboardPlugin, OptimisticSortingPlugin]) unless given as an
// (defaults) => [...defaults, ...] function, killing the live-reorder animation.
const TRANSITION = { duration: 250, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', idle: false };

type TaskSortableInput = {
  id: string;
  index: number;
  group: string;
  type: string;
  disabled?: boolean;
};

export function useTaskSortable({ id, index, group, type, disabled }: TaskSortableInput) {
  const { ref } = useSortable({
    id,
    index,
    group,
    type,
    accept: type,
    disabled,
    transition: TRANSITION,
  });
  return { dragRef: ref };
}
