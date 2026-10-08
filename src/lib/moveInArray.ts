// Returns a copy with the item at `index` swapped one place up (-1) or down (1); unchanged at either end.
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const swapIndex = index + direction;
  if (index < 0 || index >= items.length || swapIndex < 0 || swapIndex >= items.length) return [...items];
  const next = [...items];
  [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  return next;
}
