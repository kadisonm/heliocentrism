import { GRID_COLS } from '../../lib/grid/gridConfig';
import type { DashboardBreakpoint, DashboardPage } from '../../lib/types';

// Rows shown when a page's content is shorter, so small pages don't render as giant boxes.
const MIN_ROWS = 12;

// A miniature of a page's widget layout — each widget as a box at its grid position — to recognise pages at a glance.
export default function PageThumbnail({ page, breakpoint }: { page: DashboardPage; breakpoint: DashboardBreakpoint }) {
  const cols = GRID_COLS[breakpoint];
  const rows = Math.max(MIN_ROWS, ...page.layout.map((item) => (Number.isFinite(item.y) ? item.y + item.h : 0)));

  return (
    <span className="page-thumbnail" aria-hidden>
      {page.layout.map((item) =>
        Number.isFinite(item.y) ? (
          <span
            key={item.i}
            className="page-thumbnail__widget"
            style={{
              left: `${(item.x / cols) * 100}%`,
              top: `${(item.y / rows) * 100}%`,
              width: `${(item.w / cols) * 100}%`,
              height: `${(item.h / rows) * 100}%`,
            }}
          />
        ) : null
      )}
    </span>
  );
}
