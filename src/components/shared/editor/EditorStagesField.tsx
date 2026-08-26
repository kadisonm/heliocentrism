'use client';

import { createElement, useState } from 'react';
import { BUILT_IN_STAGE_PRESETS } from '../../../lib/taskCascade';
import { getTaskStageIcon } from '../../../lib/taskStageIcons';
import type { StageColor, StagePreset, TaskStageDef } from '../../../lib/types';
import { useSettings } from '../settings/useSettings';
import EditorField from './EditorField';
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

function stagesMatch(a: TaskStageDef[], b: TaskStageDef[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((stage, index) => {
    const other = b[index];
    return stage.name === other.name && stage.color === other.color && stage.icon === other.icon;
  });
}

function detectPresetId(stages: TaskStageDef[], customPresets: StagePreset[]): string {
  for (const preset of BUILT_IN_STAGE_PRESETS) {
    if (stagesMatch(stages, preset.createStages())) return preset.id;
  }
  for (const preset of customPresets) {
    if (stagesMatch(stages, preset.stages)) return preset.id;
  }
  return 'custom';
}

export default function EditorStagesField({ stages, onChange }: EditorStagesFieldProps) {
  const { settings, updateSettings } = useSettings();
  const customPresets = settings.customStagePresets;

  // null = derive preset from `stages` (self-corrects if settings/customPresets
  // are still loading on mount); becomes non-null once the user makes an
  // explicit choice, so hand-editing stages afterward won't snap back to Custom.
  const [presetOverride, setPresetOverride] = useState<string | null>(null);
  const selectedPresetId = presetOverride ?? detectPresetId(stages, customPresets);
  const isCustomPresetSelected = customPresets.some((preset) => preset.id === selectedPresetId);

  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);

  const updateStage = (id: string, patch: Partial<TaskStageDef>) =>
    onChange(stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)));

  const addStage = () => {
    const next = [...stages];
    next.splice(next.length - 1, 0, { id: crypto.randomUUID(), name: '', color: 'none' });
    onChange(next);
  };

  const removeStage = (id: string) => onChange(stages.filter((stage) => stage.id !== id));

  const handlePresetChange = (id: string) => {
    setPresetOverride(id);
    setIsSavingPreset(false);
    if (id === 'custom') return;
    const builtIn = BUILT_IN_STAGE_PRESETS.find((preset) => preset.id === id);
    if (builtIn) {
      onChange(builtIn.createStages());
      return;
    }
    const custom = customPresets.find((preset) => preset.id === id);
    if (custom) onChange(custom.stages.map((stage) => ({ ...stage })));
  };

  const handleSavePreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const preset: StagePreset = { id: crypto.randomUUID(), name, stages };
    updateSettings({ ...settings, customStagePresets: [...customPresets, preset] });
    setPresetOverride(preset.id);
    setIsSavingPreset(false);
    setNewPresetName('');
  };

  const handleDeletePreset = () => {
    updateSettings({
      ...settings,
      customStagePresets: customPresets.filter((preset) => preset.id !== selectedPresetId),
    });
    setPresetOverride('custom');
  };

  return (
    <>
      <EditorField label="Preset">
        <div className="editor-field-row">
          <select value={selectedPresetId} onChange={(event) => handlePresetChange(event.target.value)}>
            {BUILT_IN_STAGE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
            {customPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
          {isCustomPresetSelected && (
            <button type="button" className="editor-preset-delete" onClick={handleDeletePreset}>
              Delete preset
            </button>
          )}
        </div>
      </EditorField>

      {selectedPresetId === 'custom' &&
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

      {selectedPresetId === 'custom' && (
        <>
          <button type="button" className="editor-stage-add" onClick={addStage}>
            + Add stage
          </button>

          {!isSavingPreset ? (
            <button type="button" onClick={() => setIsSavingPreset(true)}>
              Save as preset
            </button>
          ) : (
            <div className="editor-preset-save">
              <input
                type="text"
                placeholder="Preset name"
                value={newPresetName}
                onChange={(event) => setNewPresetName(event.target.value)}
              />
              <button type="button" className="editor-save" onClick={handleSavePreset}>
                Save
              </button>
              <button type="button" className="editor-cancel" onClick={() => setIsSavingPreset(false)}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
