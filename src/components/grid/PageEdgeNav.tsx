'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

type PageEdgeNavProps = {
  canGoPrev: boolean;
  canGoNext: boolean;
  onNavigate: (delta: -1 | 1) => void;
};

const EDGES = [
  { delta: -1, side: 'left', label: 'Previous page', Icon: ChevronLeft },
  { delta: 1, side: 'right', label: 'Next page', Icon: ChevronRight },
] as const;

// Full-height click targets over the dashboard's side margins; hovering one lights it up and shows an arrow.
export default function PageEdgeNav({ canGoPrev, canGoNext, onNavigate }: PageEdgeNavProps) {
  return (
    <>
      {EDGES.map(({ delta, side, label, Icon }) =>
        (delta < 0 ? canGoPrev : canGoNext) ? (
          <button
            key={side}
            type="button"
            className={`page-edge-nav page-edge-nav--${side}`}
            onClick={() => onNavigate(delta)}
            aria-label={label}
            title={label}
          >
            <span className="page-edge-nav__arrow">
              <Icon size={18} />
            </span>
          </button>
        ) : null
      )}
    </>
  );
}
