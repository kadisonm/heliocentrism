'use client';

import type { ThemeMode } from '../../../lib/types';
import { BACKGROUND_VARIANTS } from '../../../lib/background';
import { THEME_PALETTES } from '../../../lib/theme';
import Modal from '../../common/Modal';
import SettingsField from '../../common/SettingsField';
import { useSettings } from '../../shared/settings/useSettings';

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

const BACKGROUND_OPTIONS = BACKGROUND_VARIANTS.map((background) => ({
  value: background.id,
  label: background.label,
}));

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
          label="Background"
          type="select"
          value={settings.background.variant}
          options={BACKGROUND_OPTIONS}
          onChange={(value) =>
            updateSettings({
              ...settings,
              background: { ...settings.background, variant: value as typeof settings.background.variant },
            })
          }
        />
      </div>
    </Modal>
  );
}
