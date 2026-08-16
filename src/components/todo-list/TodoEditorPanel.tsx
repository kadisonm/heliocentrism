'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Subtask, Todo, TodoStage } from '../../lib/types';

type TodoEditorPanelProps = {
  todo: Todo | null;
  onClose: () => void;
  onSave: (todo: Todo) => void;
};

export default function TodoEditorPanel({ todo, onClose, onSave }: TodoEditorPanelProps) {
  const [draft, setDraft] = useState<Todo | null>(todo);
  // Widgets are positioned by react-grid-layout via CSS `transform`, which
  // makes them a containing block for `position: fixed` descendants — this
  // panel would otherwise be trapped inside its widget's box instead of
  // covering the viewport. Portaling to document.body escapes that.
  // document doesn't exist during SSR, so the portal only renders once
  // mounted on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!todo || !draft || !mounted) {
    return null;
  }

  const updateDraft = <K extends keyof Todo>(field: K, value: Todo[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const addSubtask = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const subtask: Subtask = { id: crypto.randomUUID(), title: trimmed, stage: 0 };
    updateDraft('subtasks', [...draft.subtasks, subtask]);
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
            <span>Due</span>
            <input
              type="text"
              value={draft.due}
              onChange={(event) => updateDraft('due', event.target.value)}
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

            <SubtaskAdder onAdd={addSubtask} />
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

function SubtaskAdder({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('');

  return (
    <div className="todo-editor-subtask-add">
      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New subtask"
      />
      <button
        type="button"
        onClick={() => {
          onAdd(title);
          setTitle('');
        }}
      >
        Add
      </button>
    </div>
  );
}
