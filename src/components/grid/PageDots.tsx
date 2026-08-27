'use client';

import { useLayoutEffect, useRef, useState } from 'react';

type PageDotsProps = {
  pageCount: number; // real pages only
  activeIndex: number; // 0..pageCount when a blank dot is shown, else 0..pageCount-1
  showBlankDot: boolean;
  onSelect: (index: number) => void;
};

type WormRect = { left: number; width: number };

// How long each half of the worm transition (see below) takes — kept in
// sync by hand with .page-dot-worm's own transition duration in
// grid/page-dots.scss.
const WORM_PHASE_MS = 150;

// Bottom-center page navigation — shown whenever there's more than one page,
// or while editing (see page.tsx). "Pressing" a dot is treated the same as
// clicking it; no separate press/hold gesture.
export default function PageDots({ pageCount, activeIndex, showBlankDot, onSelect }: PageDotsProps) {
  const dotCount = pageCount + (showBlankDot ? 1 : 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const previousIndexRef = useRef(activeIndex);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // null = at rest — the active dot's own accent color (see .page-dot--active
  // below) is all that shows. Only set while the transition below is playing.
  const [wormRect, setWormRect] = useState<WormRect | null>(null);

  const measureDot = (index: number): WormRect | null => {
    const container = containerRef.current;
    const dot = dotRefs.current[index];
    if (!container || !dot) return null;
    const containerRect = container.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();
    return { left: dotRect.left - containerRect.left, width: dotRect.width };
  };

  // Plays a two-phase "worm" in place of the active dot's color just
  // teleporting to its new position: first stretches from the old dot to
  // bridge across to the new one (covering both), then shrinks back down
  // onto just the new dot — see grid/page-dots.scss for the actual
  // transition. Every dot is the same fixed size (no more width jump on
  // --active), so dot positions never shift under this regardless of which
  // one is active, which is what makes measuring old/new safe at any point.
  useLayoutEffect(() => {
    for (const timeout of timeoutsRef.current) clearTimeout(timeout);
    timeoutsRef.current = [];

    const previousIndex = previousIndexRef.current;
    previousIndexRef.current = activeIndex;
    if (previousIndex === activeIndex) return;

    const startRect = measureDot(previousIndex);
    const endRect = measureDot(activeIndex);
    if (!startRect || !endRect) return;

    // Mount sitting exactly on the old dot first (no transition needed to
    // get here — it's simply appearing where the dot already visually is),
    // then defer the move to the stretched span to the next frame. Setting
    // both on the same render wouldn't animate at all: a freshly-mounted
    // element has no "before" frame painted yet to transition from.
    setWormRect(startRect);
    const raf = requestAnimationFrame(() => {
      const stretchLeft = Math.min(startRect.left, endRect.left);
      const stretchRight = Math.max(startRect.left + startRect.width, endRect.left + endRect.width);
      setWormRect({ left: stretchLeft, width: stretchRight - stretchLeft });

      const shrinkTimeout = setTimeout(() => {
        setWormRect(endRect);

        // By now the worm's rect exactly matches the new dot's own rect,
        // which already carries the same accent color (.page-dot--active)
        // underneath — removing it here is a no-op visually, not a snap.
        const hideTimeout = setTimeout(() => setWormRect(null), WORM_PHASE_MS);
        timeoutsRef.current.push(hideTimeout);
      }, WORM_PHASE_MS);
      timeoutsRef.current.push(shrinkTimeout);
    });

    return () => {
      cancelAnimationFrame(raf);
      for (const timeout of timeoutsRef.current) clearTimeout(timeout);
      timeoutsRef.current = [];
    };
  }, [activeIndex]);

  return (
    <div className="page-dots" ref={containerRef} role="tablist" aria-label="Dashboard pages">
      {Array.from({ length: dotCount }, (_, index) => {
        const isBlank = index === pageCount;
        const isActive = index === activeIndex;
        return (
          <button
            key={index}
            ref={(el) => {
              dotRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={isBlank ? 'New page' : `Page ${index + 1}`}
            className={[
              'page-dot',
              isActive && 'page-dot--active',
              isBlank && 'page-dot--blank',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(index)}
          />
        );
      })}

      {wormRect && (
        <span
          className="page-dot-worm"
          style={{ left: wormRect.left, width: wormRect.width }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
