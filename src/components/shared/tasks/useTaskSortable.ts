'use client';

import { useSortable } from '@dnd-kit/react/sortable';

// Shared dnd-kit v7 sortable setup for both task and subtask rows (see
// SortableTask.tsx and TaskParent.tsx's SubtaskSortableRow) — same
// transition config either way, just a different id/index/group/type per
// call site. No `plugins` override here on purpose: passing one (even to
// just add a feedback option) REPLACES useSortable's own default plugin
// list — [SortableKeyboardPlugin, OptimisticSortingPlugin] — unless it's
// given as an (defaults) => [...defaults, ...] function, so leaving it
// alone is what keeps OptimisticSortingPlugin's live reorder animation
// active. The floating drag visual (dnd-kit's Feedback plugin) and its
// left-in-place clone are styled purely via CSS — see [data-dnd-dragging]
// and [data-dnd-placeholder] in task-item.scss.
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
