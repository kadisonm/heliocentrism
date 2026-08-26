'use client';

type BlankPagePaneProps = {
  // 'current': shown as the main canvas while sitting on the blank page.
  // 'peek': shown in the peek carousel's trailing slot.
  variant: 'current' | 'peek';
  onClick?: () => void;
};

// The synthetic "create a new page" placeholder — never a real DashboardPage,
// so there's nothing to lay out here, unlike GridPage. Left visually empty
// (no icon/label) by design — just an empty page-sized area.
export default function BlankPagePane({ variant, onClick }: BlankPagePaneProps) {
  return (
    <div
      className={`grid-blank-page grid-blank-page--${variant}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    />
  );
}
