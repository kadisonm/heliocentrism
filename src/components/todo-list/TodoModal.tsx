'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Subtask, Todo } from '../../lib/types';

type TodoModalProps = {
  isOpen: boolean;
  todo: Todo | null; // null while creating a new todo
  onClose: () => void;
  // createdAt/updatedAt/completedAt are (re)stamped by useTodoLists.
  onSubmit: (todo: Todo) => void;
};

function createDraftTodo(): Todo {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    due: '',
    stage: 0,
    subtasks: [],
    createdAt: '',
    updatedAt: '',
    completedAt: null,
  };
}

export default function TodoModal({ isOpen, todo, onClose, onSubmit }: TodoModalProps) {
  const [draft, setDraft] = useState<Todo>(() => todo ?? createDraftTodo());
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  // Widgets are positioned by react-grid-layout via CSS `transform`, which
  // makes them a containing block for `position: fixed` descendants — this
  // modal would otherwise be trapped inside its widget's box instead of
  // covering the viewport. Portaling to document.body escapes that.
  // document doesn't exist during SSR, so the portal only renders once
  // mounted on the client.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const isEditing = todo !== null;

  const updateDraft = <K extends keyof Todo>(field: K, value: Todo[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
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

  const [dueDatePart, dueTimePart = ''] = draft.due.split('T');

  // A native datetime-local input only reports a value once every subfield
  // (year/month/day/hour/minute) is filled in — pick just a date and it
  // stays empty, silently dropping the due date on save. Splitting into
  // separate date/time inputs avoids that: picking a date alone is already
  // a complete, valid value, and the time defaults to end-of-day.
  const updateDueDate = (dateValue: string) => {
    if (!dateValue) {
      updateDraft('due', '');
      return;
    }
    updateDraft('due', `${dateValue}T${dueTimePart || '23:59'}`);
  };

  const updateDueTime = (timeValue: string) => {
    if (!dueDatePart) return;
    updateDraft('due', `${dueDatePart}T${timeValue || '23:59'}`);
  };

  const handleSubmit = () => {
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) return;
    onSubmit({ ...draft, title: trimmedTitle });
  };

  return createPortal(
    <div className="todo-editor-overlay" onClick={onClose}>
      <div className="todo-editor-panel" onClick={(event) => event.stopPropagation()}>
        <div className="todo-editor-header">
          <h3>{isEditing ? 'Edit Task' : 'Add Task'}</h3>
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
            <div className="todo-editor-due-row">
              <input
                type="date"
                value={dueDatePart}
                onChange={(event) => updateDueDate(event.target.value)}
              />
              <input
                type="time"
                value={dueTimePart}
                onChange={(event) => updateDueTime(event.target.value)}
                disabled={!dueDatePart}
              />
            </div>
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
          <button type="button" className="todo-editor-save" onClick={handleSubmit}>
            {isEditing ? 'Save' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
