'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RecurrenceValue, RoutineTask, Subtask, TodoStage } from '../../lib/types';

type RoutineTaskEditorPanelProps = {
  task: RoutineTask | null;
  onClose: () => void;
  onSave: (task: RoutineTask) => void;
};

export default function RoutineTaskEditorPanel({
  task,
  onClose,
  onSave,
}: RoutineTaskEditorPanelProps) {
  const [draft, setDraft] = useState<RoutineTask | null>(task);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  // See TodoEditorPanel's original comment (now in src/components/todo-list/):
  // widgets are positioned via CSS transform, which traps position:fixed
  // descendants inside them — portaling to document.body escapes that.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!task || !draft || !mounted) {
    return null;
  }

  const updateDraft = <K extends keyof RoutineTask>(field: K, value: RoutineTask[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const addSubtask = () => {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    const subtask: Subtask = { id: crypto.randomUUID(), title, stage: 0 };
    updateDraft('subtasks', [...draft.subtasks, subtask]);
    setNewSubtaskTitle('');
  };

  const removeSubtask = (id: string) => {
    updateDraft(
      'subtasks',
      draft.subtasks.filter((subtask) => subtask.id !== id)
    );
  };

  return createPortal(
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

          <label className="todo-editor-field">
            <span>Description</span>
            <input
              type="text"
              value={draft.description ?? ''}
              onChange={(event) => updateDraft('description', event.target.value)}
            />
          </label>

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
              value={draft.recurrence}
              onChange={(event) =>
                updateDraft('recurrence', event.target.value as RecurrenceValue)
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <div className="todo-editor-field">
            <span>Subtasks</span>

            {draft.subtasks.map((subtask) => (
              <div key={subtask.id} className="todo-editor-subtask">
                <span>{subtask.title}</span>
                <button type="button" onClick={() => removeSubtask(subtask.id)}>
                  Remove
                </button>
              </div>
            ))}

            <div className="todo-editor-subtask-add">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                placeholder="New subtask"
              />
              <button type="button" onClick={addSubtask}>
                Add
              </button>
            </div>
          </div>
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
    </div>,
    document.body
  );
}
