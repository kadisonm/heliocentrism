import { createDefaultRepeat } from '../../../lib/tasks/taskRepeat';
import type { RepeatUnit, TaskRepeat } from '../../../lib/types';
import EditorField from './EditorField';

type EditorRepeatFieldsProps = {
  repeat: TaskRepeat | undefined;
  onChange: (repeat: TaskRepeat | undefined) => void;
};

const UNIT_OPTIONS: { value: RepeatUnit; label: string }[] = [
  { value: 'day', label: 'day' },
  { value: 'week', label: 'week' },
  { value: 'month', label: 'month' },
  { value: 'year', label: 'year' },
];

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function EditorRepeatFields({ repeat, onChange }: EditorRepeatFieldsProps) {
  return (
    <>
      <label className="editor-repeat-toggle">
        <input
          type="checkbox"
          checked={!!repeat}
          onChange={(event) => onChange(event.target.checked ? createDefaultRepeat() : undefined)}
        />
        <span>Repeats</span>
      </label>

      {repeat && (
        <>
          <EditorField label="Every">
            <div className="editor-field-row">
              <input
                type="number"
                min={1}
                value={repeat.interval}
                onChange={(event) => onChange({ ...repeat, interval: Number(event.target.value) || 1 })}
              />
              <select
                value={repeat.unit}
                onChange={(event) => onChange({ ...repeat, unit: event.target.value as RepeatUnit })}
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </EditorField>

          <EditorField label="At">
            <input
              type="time"
              value={repeat.time}
              onChange={(event) => onChange({ ...repeat, time: event.target.value })}
            />
          </EditorField>

          <EditorField label="Ends">
            <div className="editor-field-row">
              <select
                value={repeat.end.type}
                onChange={(event) => {
                  const type = event.target.value;
                  if (type === 'never') {
                    onChange({ ...repeat, end: { type: 'never' } });
                  } else if (type === 'onDate') {
                    onChange({ ...repeat, end: { type: 'onDate', date: todayDateString() } });
                  } else {
                    onChange({ ...repeat, end: { type: 'afterOccurrences', count: 5 } });
                  }
                }}
              >
                <option value="never">Never</option>
                <option value="onDate">On date</option>
                <option value="afterOccurrences">After occurrences</option>
              </select>

              {repeat.end.type === 'onDate' && (
                <input
                  type="date"
                  value={repeat.end.date}
                  onChange={(event) =>
                    onChange({ ...repeat, end: { type: 'onDate', date: event.target.value } })
                  }
                />
              )}

              {repeat.end.type === 'afterOccurrences' && (
                <input
                  type="number"
                  min={1}
                  value={repeat.end.count}
                  onChange={(event) =>
                    onChange({
                      ...repeat,
                      end: { type: 'afterOccurrences', count: Number(event.target.value) || 1 },
                    })
                  }
                />
              )}
            </div>
          </EditorField>
        </>
      )}
    </>
  );
}
