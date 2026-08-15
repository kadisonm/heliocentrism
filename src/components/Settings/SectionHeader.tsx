import { type KeyboardEvent } from 'react';

type SectionHeaderProps = {
  title: string;
  isOpen: boolean;
  isHealthy: boolean;
  onToggle: () => void;
};

export default function SectionHeader({
  title,
  isOpen,
  isHealthy,
  onToggle,
}: SectionHeaderProps) {
  const handleKeyToggle = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className="settings-section-header"
      role="button"
      tabIndex={0}
      aria-expanded={isOpen}
      onClick={onToggle}
      onKeyDown={handleKeyToggle}
    >
      <span className="settings-section-header-title">{title}</span>
      <span className="settings-section-header-right">
        <span
          className={
            isHealthy
              ? 'settings-status-icon settings-status-icon--ok'
              : 'settings-status-icon settings-status-icon--warn'
          }
          aria-hidden="true"
        >
          {isHealthy ? '✓' : '⚠'}
        </span>
        <span className="settings-section-header-caret" aria-hidden="true">
          {isOpen ? '▾' : '▸'}
        </span>
      </span>
    </div>
  );
}
