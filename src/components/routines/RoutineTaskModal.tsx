'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RecurrenceValue, RoutineTask, Subtask } from '../../lib/types';

type RoutineTaskModalProps = {
  isOpen: boolean;
  task: RoutineTask | null; // null while creating a new task
  onClose: () => void;
  // createdAt/updatedAt/completedAt are (re)stamped by useRoutineTasks.
  onSubmit: (task: RoutineTask) => void;
  // When set, a newly created task always gets this recurrence and the
  // picker below is hidden — used by the per-cadence widgets (Daily/Weekly/
  // Monthly Routine), which only ever add tasks into their own section.
  // Editing an existing task always allows changing its recurrence.
  fixedRecurrence?: RecurrenceValue;
};

function createDraftTask(fixedRecurrence?: RecurrenceValue): RoutineTask {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    stage: 0,
    subtasks: [],
    recurrence: fixedRecurrence ?? 'daily',
    createdAt: '',
    updatedAt: '',
    completedAt: null,
  };
}

export default function RoutineTaskModal({
  isOpen,
  task,
  onClose,
  onSubmit,
  fixedRecurrence,
}: RoutineTaskModalProps) {
  const [draft, setDraft] = useState<RoutineTask>(() => task ?? createDraftTask(fixedRecurrence));
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

  const isEditing = task !== null;
  const showRecurrencePicker = isEditing || !fixedRecurrence;

  const updateDraft = <K extends keyof RoutineTask>(field: K, value: RoutineTask[K]) => {
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

          {showRecurrencePicker && (
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
          )}

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
