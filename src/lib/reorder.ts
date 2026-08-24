// The `order` value for a brand-new sibling appended to the end of its
// group.
export function nextOrder<T extends { order: number }>(siblings: T[]): number {
  return siblings.length === 0 ? 0 : Math.max(...siblings.map((item) => item.order)) + 1;
}
