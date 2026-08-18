import { arrayMove } from '@dnd-kit/sortable';

// Reorders only the items matching `predicate`, preserving every other
// item's position in the underlying array untouched — e.g. reordering only
// the currently-visible items when completed ones are hidden, without
// disturbing where hidden items sit in the flat backing array.
export function reorderWithinGroup<T>(
  items: T[],
  predicate: (item: T) => boolean,
  activeId: string,
  overId: string,
  getId: (item: T) => string
): T[] {
  const groupIndices: number[] = [];
  items.forEach((item, index) => {
    if (predicate(item)) groupIndices.push(index);
  });

  const group = groupIndices.map((index) => items[index]);
  const fromIndex = group.findIndex((item) => getId(item) === activeId);
  const toIndex = group.findIndex((item) => getId(item) === overId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return items;

  const reorderedGroup = arrayMove(group, fromIndex, toIndex);
  const next = [...items];
  groupIndices.forEach((originalIndex, i) => {
    next[originalIndex] = reorderedGroup[i];
  });
  return next;
}
