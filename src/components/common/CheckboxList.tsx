type CheckboxOption = { value: string; label: string };

type CheckboxListProps = {
  options: CheckboxOption[];
  checked: string[];
  onChange: (checked: string[]) => void;
  ariaLabel?: string;
};

// A vertical list of labelled checkboxes for picking any subset of options.
export default function CheckboxList({ options, checked, onChange, ariaLabel }: CheckboxListProps) {
  const toggle = (value: string) =>
    onChange(checked.includes(value) ? checked.filter((v) => v !== value) : [...checked, value]);

  return (
    <div className="checkbox-list" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <label key={option.value} className="checkbox-list__option">
          <input type="checkbox" checked={checked.includes(option.value)} onChange={() => toggle(option.value)} />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
