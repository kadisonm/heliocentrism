'use client';

import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  ariaLabel?: string;
};

// − [input] + — a number input with tap-friendly increment buttons.
export default function NumberStepper({ value, onChange, step = 1, min = 0, ariaLabel }: NumberStepperProps) {
  // Local text so a half-typed value ("1." or "") isn't clobbered mid-edit; null = mirror `value`.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: number) => onChange(Math.max(min, next));

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    if (draft.trim() !== '' && !Number.isNaN(parsed)) commit(parsed);
    setDraft(null);
  };

  return (
    <div className="number-stepper">
      <button
        type="button"
        className="number-stepper__button"
        onClick={() => commit(value - step)}
        disabled={value <= min}
        aria-label="Decrease"
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        inputMode="decimal"
        className="number-stepper__input"
        value={draft ?? String(value)}
        step={step}
        min={min}
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <button type="button" className="number-stepper__button" onClick={() => commit(value + step)} aria-label="Increase">
        <Plus size={14} />
      </button>
    </div>
  );
}
