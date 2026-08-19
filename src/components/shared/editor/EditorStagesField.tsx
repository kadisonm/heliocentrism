'use client';

import { createElement, useState } from 'react';
import { createDefaultStages } from '../../../lib/taskCascade';
import { getTaskStageIcon } from '../../../lib/taskStageIcons';
import type { StageColor, TaskStageDef } from '../../../lib/types';
import EditorIconPicker from './EditorIconPicker';

type EditorStagesFieldProps = {
  stages: TaskStageDef[];
  onChange: (stages: TaskStageDef[]) => void;
};

const STAGE_COLOR_OPTIONS: { value: StageColor; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'accent', label: 'Accent' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'muted', label: 'Muted' },
];

function isDefaultStageShape(stages: TaskStageDef[]): boolean {
  if (stages.length !== 2) return false;
  const [start, done] = stages;
  return (
    start.name === 'Todo' &&
    start.color === 'none' &&
    !start.icon &&
    done.name === 'Done' &&
    done.color === 'success' &&
    done.icon === 'Check'
  );
}

export default function EditorStagesField({ stages, onChange }: EditorStagesFieldProps) {
  // Unlike EditorRepeatFields' toggle, this can't be a pure `checked={...}`
  // derivation from `stages` — `stages` has no "absent/off" state the data
  // model can represent (even the default 2-stage list is real, present
  // data), so a purely-derived checkbox would make unchecking a no-op
  // whenever the shape still equals the default, re-deriving straight back
  // to checked. Seeded once on mount; safe because this component fully
  // remounts whenever the Task modal opens for a different task (the
  // parent's existing `key={...}` pattern).
  const [useDefault, setUseDefault] = useState(() => isDefaultStageShape(stages));
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);

  const updateStage = (id: string, patch: Partial<TaskStageDef>) =>
    onChange(stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)));

  const addStage = () => {
    const next = [...stages];
    next.splice(next.length - 1, 0, { id: crypto.randomUUID(), name: '', color: 'none' });
    onChange(next);
  };

  const removeStage = (id: string) => onChange(stages.filter((stage) => stage.id !== id));

  return (
    <>
      <label className="editor-repeat-toggle">
        <input
          type="checkbox"
          checked={useDefault}
          onChange={(event) => {
            setUseDefault(event.target.checked);
            if (event.target.checked) onChange(createDefaultStages());
          }}
        />
        <span>Use default stages</span>
      </label>

      {!useDefault &&
        stages.map((stage, index) => {
          const locked = index === 0 || index === stages.length - 1;
          const Icon = getTaskStageIcon(stage.icon);

          return (
            <div key={stage.id} className="editor-stage-row">
              <div className="editor-stage">
                <div className="editor-stage__main">
                  <input
                    type="text"
                    placeholder="Stage name"
                    value={stage.name}
                    onChange={(event) => updateStage(stage.id, { name: event.target.value })}
                  />
                  <button
                    type="button"
                    className="editor-stage__icon-trigger"
                    onClick={() => setOpenPickerId(openPickerId === stage.id ? null : stage.id)}
                    aria-label="Choose icon"
                  >
                    {Icon ? (
                      createElement(Icon, { size: 14 })
                    ) : (
                      <span className="editor-stage__icon-placeholder">—</span>
                    )}
                  </button>
                  {!locked && (
                    <button type="button" onClick={() => removeStage(stage.id)}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="editor-stage__swatches">
                  {STAGE_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`editor-swatch editor-swatch--${option.value}${
                        stage.color === option.value ? ' editor-swatch--selected' : ''
                      }`}
                      aria-label={option.label}
                      aria-pressed={stage.color === option.value}
                      onClick={() => updateStage(stage.id, { color: option.value })}
                    />
                  ))}
                </div>
              </div>

              {openPickerId === stage.id && (
                <EditorIconPicker
                  value={stage.icon}
                  onChange={(icon) => updateStage(stage.id, { icon })}
                  onClose={() => setOpenPickerId(null)}
                />
              )}
            </div>
          );
        })}

      {!useDefault && (
        <button type="button" className="editor-stage-add" onClick={addStage}>
          + Add stage
        </button>
      )}
    </>
  );
}
