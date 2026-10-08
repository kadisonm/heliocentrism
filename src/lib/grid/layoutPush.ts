import type { Layout, LayoutItem } from 'react-grid-layout';

function overlaps(a: LayoutItem, b: LayoutItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Free-placement collision handling: items stay where they are (no gravity), and any overlap is resolved by
// pushing the lower item down, cascading to whatever sits beneath it. Anchored items (e.g. the one being
// dragged) keep their spot and everything else yields to them. Returns new items in the input's order.
export function pushDownOverlaps(layout: Layout, anchorIds: readonly string[] = []): LayoutItem[] {
  const items = layout.map((item) => ({ ...item }));
  const anchors = new Set(anchorIds);
  const placed = items.filter((item) => anchors.has(item.i));
  const rest = items.filter((item) => !anchors.has(item.i)).sort((a, b) => a.y - b.y || a.x - b.x);

  for (const item of rest) {
    for (let hit = placed.find((other) => overlaps(other, item)); hit; hit = placed.find((other) => overlaps(other, item))) {
      item.y = hit.y + hit.h;
    }
    placed.push(item);
  }
  return items;
}

// The first free row below every item — where new or incoming widgets are placed.
export function layoutBottom(layout: Layout): number {
  return layout.reduce((bottom, item) => Math.max(bottom, Number.isFinite(item.y) ? item.y + item.h : 0), 0);
}
