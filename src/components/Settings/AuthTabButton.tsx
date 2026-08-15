type AuthTabButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

export default function AuthTabButton({
  label,
  isActive,
  onClick,
}: AuthTabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={isActive ? 'settings-tab settings-tab--active' : 'settings-tab'}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
