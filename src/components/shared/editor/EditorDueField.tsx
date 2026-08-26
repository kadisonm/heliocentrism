'use client';

import EditorField from './EditorField';

type EditorDueFieldProps = {
  value: string; // '' = unset
  onChange: (due: string) => void;
};

// datetime-local silently reports empty until every subfield is filled;
// splitting into separate date/time inputs lets a date alone be valid,
// defaulting time to end-of-day.
export default function EditorDueField({ value, onChange }: EditorDueFieldProps) {
  const [datePart, timePart = ''] = value.split('T');

  const updateDate = (dateValue: string) => {
    if (!dateValue) {
      onChange('');
      return;
    }
    onChange(`${dateValue}T${timePart || '23:59'}`);
  };

  const updateTime = (timeValue: string) => {
    if (!datePart) return;
    onChange(`${datePart}T${timeValue || '23:59'}`);
  };

  return (
    <EditorField label="Due">
      <div className="editor-field-row">
        <input type="date" value={datePart} onChange={(event) => updateDate(event.target.value)} />
        <input
          type="time"
          value={timePart}
          onChange={(event) => updateTime(event.target.value)}
          disabled={!datePart}
        />
      </div>
    </EditorField>
  );
}
