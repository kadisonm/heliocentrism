import type { ReactNode } from 'react';

export type OptionCard<T extends string> = {
  value: T;
  label: string;
  preview: ReactNode; // small visual rendered above the label
};

type OptionCardPickerProps<T extends string> = {
  options: OptionCard<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
};

// A grid of selectable preview cards — a visual replacement for a <select> whose options are easier shown than named.
export default function OptionCardPicker<T extends string>({ options, value, onChange, ariaLabel }: OptionCardPickerProps<T>) {
  return (
    <div className="option-card-picker" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? 'option-card option-card--selected' : 'option-card'}
          onClick={() => onChange(option.value)}
        >
          <span className="option-card__preview" aria-hidden>
            {option.preview}
          </span>
          <span className="option-card__label">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
