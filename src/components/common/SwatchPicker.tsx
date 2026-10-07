import type { CSSProperties } from 'react';

export type SwatchOption<T extends string> = {
  value: T;
  label: string;
  color: string; // any CSS colour, normally a theme var() — 'transparent' for "none"
};

type SwatchPickerProps<T extends string> = {
  options: SwatchOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
};

// A row of colour buttons — a visual replacement for a <select> of colours.
export default function SwatchPicker<T extends string>({ options, value, onChange, ariaLabel }: SwatchPickerProps<T>) {
  return (
    <div className="swatch-picker" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          className={option.value === value ? 'swatch-picker__swatch swatch-picker__swatch--selected' : 'swatch-picker__swatch'}
          style={{ '--swatch-color': option.color } as CSSProperties}
          title={option.label}
          aria-label={option.label}
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}
