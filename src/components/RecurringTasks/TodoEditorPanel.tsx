'use client';

import { useState } from 'react';
import type { Recurrence, Todo, TodoStage } from '../../lib/types';

type TodoEditorPanelProps = {
  todo: Todo | null;
  onClose: () => void;
  onSave: (todo: Todo) => void;
};

export default function TodoEditorPanel({
  todo,
  onClose,
  onSave,
}: TodoEditorPanelProps) {
  const [draft, setDraft] = useState<Todo | null>(todo);

  if (!todo || !draft) {
    return null;
  }

  const updateDraft = <K extends keyof Todo>(field: K, value: Todo[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const isRecurringTask = draft.recurrence === 'daily' || draft.recurrence === 'weekly' || draft.recurrence === 'monthly';

  return (
    <div className="todo-editor-overlay" onClick={onClose}>
      <div className="todo-editor-panel" onClick={(event) => event.stopPropagation()}>
        <div className="todo-editor-header">
          <h3>Edit Task</h3>
          <button type="button" className="todo-editor-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="todo-editor-fields">
          <label className="todo-editor-field">
            <span>Title</span>
            <input
              type="text"
              value={draft.title}
              onChange={(event) => updateDraft('title', event.target.value)}
            />
          </label>

          {!isRecurringTask && (
            <label className="todo-editor-field">
              <span>Due</span>
              <input
                type="text"
                value={draft.due}
                onChange={(event) => updateDraft('due', event.target.value)}
              />
            </label>
          )}

          <label className="todo-editor-field">
            <span>Status</span>
            <select
              value={draft.stage}
              onChange={(event) => updateDraft('stage', Number(event.target.value) as TodoStage)}
            >
              <option value={0}>To do</option>
              <option value={1}>In progress</option>
              <option value={2}>Done</option>
            </select>
          </label>

          <label className="todo-editor-field">
            <span>Recurring</span>
            <select
              value={draft.recurrence || ''}
              onChange={(event) =>
                updateDraft('recurrence', (event.target.value || null) as Recurrence)
              }
            >
              <option value="">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>

        <div className="todo-editor-actions">
          <button type="button" className="todo-editor-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="todo-editor-save" onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
