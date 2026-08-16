'use client';

import { useState } from 'react';
import type { Subtask } from '../../../lib/types';

type EditorSubtaskListProps = {
  subtasks: Subtask[];
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
};

export default function EditorSubtaskList({ subtasks, onAdd, onRemove }: EditorSubtaskListProps) {
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewTitle('');
  };

  return (
    <>
      {subtasks.map((subtask) => (
        <div key={subtask.id} className="editor-subtask">
          <span>{subtask.title}</span>
          <button type="button" onClick={() => onRemove(subtask.id)}>
            Remove
          </button>
        </div>
      ))}

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
