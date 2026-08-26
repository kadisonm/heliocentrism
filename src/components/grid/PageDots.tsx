type PageDotsProps = {
  pageCount: number; // real pages only
  activeIndex: number; // 0..pageCount when a blank dot is shown, else 0..pageCount-1
  showBlankDot: boolean;
  onSelect: (index: number) => void;
};

// Bottom-center page navigation — shown whenever there's more than one page,
// or while editing (see page.tsx). "Pressing" a dot is treated the same as
// clicking it; no separate press/hold gesture.
export default function PageDots({ pageCount, activeIndex, showBlankDot, onSelect }: PageDotsProps) {
  const dotCount = pageCount + (showBlankDot ? 1 : 0);

  return (
    <div className="page-dots" role="tablist" aria-label="Dashboard pages">
      {Array.from({ length: dotCount }, (_, index) => {
        const isBlank = index === pageCount;
        const isActive = index === activeIndex;
        return (
          <button
            key={index}
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
    </div>
  );
}
