type RangeFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string; // shown after the current value, e.g. "px" or "%"
};

// Labelled slider with its current value shown alongside the label.
export default function RangeField({ label, value, onChange, min, max, step = 1, suffix = '' }: RangeFieldProps) {
  return (
    <label className="settings-field range-field">
      <span className="range-field__header">
        <span>{label}</span>
        <span className="range-field__value">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        className="range-field__input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
