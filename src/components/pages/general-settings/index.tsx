'use client';

import type { TaskTitleOverflow, ThemeMode } from '../../../lib/types';
import { THEME_PALETTES } from '../../../lib/theme';
import Modal from '../../common/Modal';
import SettingsField from '../../common/SettingsField';
import { useSettings } from '../../shared/tasks/useSettings';

type GeneralSettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const PALETTE_OPTIONS = THEME_PALETTES.map((palette) => ({
  value: palette.id,
  label: palette.label,
}));

const TASK_TITLE_OVERFLOW_OPTIONS: { value: TaskTitleOverflow; label: string }[] = [
  { value: 'truncate', label: 'Truncate' },
  { value: 'wrap', label: 'Wrap' },
];

export default function GeneralSettingsPanel({
  isOpen,
  onClose,
}: GeneralSettingsPanelProps) {
  const { settings, updateSettings } = useSettings();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="settings-section">
        <SettingsField
          label="Palette"
          type="select"
          value={settings.theme.palette}
          options={PALETTE_OPTIONS}
          onChange={(value) =>
            updateSettings({
              ...settings,
              theme: { ...settings.theme, palette: value as typeof settings.theme.palette },
            })
          }
        />
        <SettingsField
          label="Appearance"
          type="select"
          value={settings.theme.mode}
          options={MODE_OPTIONS}
          onChange={(value) =>
            updateSettings({
              ...settings,
              theme: { ...settings.theme, mode: value as ThemeMode },
            })
          }
        />
        <SettingsField
          label="Task Names"
          type="select"
          value={settings.taskTitleOverflow}
          options={TASK_TITLE_OVERFLOW_OPTIONS}
          onChange={(value) =>
            updateSettings({
              ...settings,
              taskTitleOverflow: value as TaskTitleOverflow,
            })
          }
        />
      </div>
    </Modal>
  );
}
