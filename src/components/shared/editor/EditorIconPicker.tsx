'use client';

import { createElement, useState } from 'react';
import { TASK_STAGE_ICON_NAMES, getTaskStageIcon } from '../../../lib/taskStageIcons';

type EditorIconPickerProps = {
  value?: string;
  onChange: (icon: string | undefined) => void;
  onClose: () => void;
};

// Rendered as an inline expanding panel under the row that opened it, not a
// nested portal/popover — EditorModal is already a document.body overlay,
// and a second independent portal would need its own z-index/outside-click
// handling without also closing the parent modal.
export default function EditorIconPicker({ value, onChange, onClose }: EditorIconPickerProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredNames = normalizedQuery
    ? TASK_STAGE_ICON_NAMES.filter((name) => name.toLowerCase().includes(normalizedQuery))
    : TASK_STAGE_ICON_NAMES;

  return (
    <div className="editor-icon-picker">
      <input
        type="text"
        placeholder="Search icons"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="editor-icon-grid">
        <button
          type="button"
          className={!value ? 'editor-icon-grid__button--selected' : undefined}
          onClick={() => {
            onChange(undefined);
            onClose();
          }}
          title="No icon"
          aria-label="No icon"
        >
          <span className="editor-stage__icon-placeholder">—</span>
        </button>

        {filteredNames.map((name) => {
          const Icon = getTaskStageIcon(name);
          if (!Icon) return null;
          return (
            <button
              key={name}
              type="button"
              className={value === name ? 'editor-icon-grid__button--selected' : undefined}
              onClick={() => {
                onChange(name);
                onClose();
              }}
              title={name}
              aria-label={name}
            >
              {createElement(Icon, { size: 14 })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
