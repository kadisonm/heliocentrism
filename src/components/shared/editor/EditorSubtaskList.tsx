'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { Subtask } from '../../../lib/types';
import EditorDueField from './EditorDueField';
import EditorRepeatFields from './EditorRepeatFields';

type EditorSubtaskListProps = {
  subtasks: Subtask[];
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Subtask>) => void;
};

export default function EditorSubtaskList({ subtasks, onAdd, onRemove, onUpdate }: EditorSubtaskListProps) {
  const [newTitle, setNewTitle] = useState('');
  // Mirrors EditorStagesField's openPickerId idiom — at most one subtask's
  // due/repeat fields expanded at a time.
  const [openId, setOpenId] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewTitle('');
  };

  return (
    <>
      {subtasks.map((subtask) => {
        const isOpen = openId === subtask.id;
        return (
          <div key={subtask.id} className="editor-subtask-row">
            <div className="editor-subtask">
              <button
                type="button"
                className="editor-subtask__expand-trigger"
                onClick={() => setOpenId(isOpen ? null : subtask.id)}
                aria-expanded={isOpen}
                aria-label={isOpen ? `Collapse ${subtask.title}` : `Expand ${subtask.title}`}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <span className="editor-subtask__title">{subtask.title}</span>
              <button type="button" className="editor-subtask__remove" onClick={() => onRemove(subtask.id)}>
                Remove
              </button>
            </div>

            {isOpen && (
              <div className="editor-subtask__expanded">
                <EditorDueField value={subtask.due} onChange={(due) => onUpdate(subtask.id, { due })} />
                <EditorRepeatFields
                  repeat={subtask.repeat}
                  onChange={(repeat) => onUpdate(subtask.id, { repeat })}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="editor-subtask-add">
        <input
          type="text"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="New subtask"
        />
        <button type="button" onClick={handleAdd}>
          Add
        </button>
      </div>
    </>
  );
}
