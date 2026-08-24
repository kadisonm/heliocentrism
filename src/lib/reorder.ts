import { arrayMove } from '@dnd-kit/sortable';

// Reorders `siblings` (already filtered to one parentId, plus whatever
// visibility predicate the caller wants — e.g. hiding completed tasks) by
// moving `activeId` to `overId`'s position, then rewrites `.order`
// sequentially (0..n-1) on just that set. Every record outside `siblings` —
// a different parent, or a filtered-out sibling — is left untouched, since
// order lives on each record rather than being implied by its position in
// one shared backing array.
export function reorderByOrder<T extends { id: string; order: number }>(
  siblings: T[],
  activeId: string,
  overId: string
): T[] {
  const sorted = [...siblings].sort((a, b) => a.order - b.order);
  const fromIndex = sorted.findIndex((item) => item.id === activeId);
  const toIndex = sorted.findIndex((item) => item.id === overId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return siblings;

  return arrayMove(sorted, fromIndex, toIndex).map((item, index) => ({ ...item, order: index }));
}

// The `order` value for a brand-new sibling appended to the end of its
// group.
export function nextOrder<T extends { order: number }>(siblings: T[]): number {
  return siblings.length === 0 ? 0 : Math.max(...siblings.map((item) => item.order)) + 1;
}
