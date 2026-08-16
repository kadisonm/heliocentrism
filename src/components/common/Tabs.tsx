type TabOption<T extends string> = {
  value: T;
  label: string;
};

type TabsProps<T extends string> = {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
};

export default function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: TabsProps<T>) {
  return (
    <div className="settings-tabs" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={
            option.value === value ? 'settings-tab settings-tab--active' : 'settings-tab'
          }
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
