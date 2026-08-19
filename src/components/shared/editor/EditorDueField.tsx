'use client';

import EditorField from './EditorField';

type EditorDueFieldProps = {
  value: string; // '' = unset
  onChange: (due: string) => void;
};

// A native datetime-local input only reports a value once every subfield
// (year/month/day/hour/minute) is filled in — pick just a date and it
// stays empty, silently dropping the due date on save. Splitting into
// separate date/time inputs avoids that: picking a date alone is already
// a complete, valid value, and the time defaults to end-of-day. Shared by
// TaskModal's own Due field and EditorSubtaskList's per-subtask expanded
// Due field — identical editing behavior either way.
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
