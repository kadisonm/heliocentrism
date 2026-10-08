'use client';

import type { BackgroundVariant, NavBarPosition, ThemeMode, ThemePalette } from '../../../lib/types';
import { BACKGROUND_VARIANTS } from '../../../lib/background';
import { resolveMode, THEME_PALETTES } from '../../../lib/theme';
import Modal from '../../common/Modal';
import OptionCardPicker, { type OptionCard } from '../../common/OptionCardPicker';
import SettingsField from '../../common/SettingsField';
import { useSettings } from '../../shared/settings/useSettings';
import BackgroundSwatch from './BackgroundSwatch';
import SystemModeSwatch from './SystemModeSwatch';
import ThemeSwatch from './ThemeSwatch';

type GeneralSettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

const NAV_POSITION_OPTIONS: { value: NavBarPosition; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'left', label: 'Left (sidebar)' },
  { value: 'right', label: 'Right (sidebar)' },
  { value: 'bottom', label: 'Bottom' },
];

const BACKGROUND_OPTIONS = BACKGROUND_VARIANTS.map((background) => ({
  value: background.id,
  label: background.label,
  preview: <BackgroundSwatch variant={background.id} />,
}));

export default function GeneralSettingsPanel({
  isOpen,
  onClose,
}: GeneralSettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  // Palette swatches preview in whichever light/dark mode is currently showing.
  const previewMode = resolveMode(settings.theme.mode);
  const paletteOptions = THEME_PALETTES.map((palette) => ({
    value: palette.id,
    label: palette.label,
    preview: <ThemeSwatch palette={palette.id} mode={previewMode} />,
  }));
  // Appearance swatches preview in the current palette.
  const { palette } = settings.theme;
  const modeOptions: OptionCard<ThemeMode>[] = [
    { value: 'system', label: 'System', preview: <SystemModeSwatch palette={palette} /> },
    { value: 'light', label: 'Light', preview: <ThemeSwatch palette={palette} mode="light" /> },
    { value: 'dark', label: 'Dark', preview: <ThemeSwatch palette={palette} mode="dark" /> },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="settings-section">
        <div className="settings-field">
          <label>Palette</label>
          <OptionCardPicker
            options={paletteOptions}
            value={settings.theme.palette}
            onChange={(palette: ThemePalette) => updateSettings({ ...settings, theme: { ...settings.theme, palette } })}
            ariaLabel="Palette"
          />
        </div>
        <div className="settings-field">
          <label>Appearance</label>
          <OptionCardPicker
            options={modeOptions}
            value={settings.theme.mode}
            onChange={(mode: ThemeMode) => updateSettings({ ...settings, theme: { ...settings.theme, mode } })}
            ariaLabel="Appearance"
          />
        </div>
        <div className="settings-field">
          <label>Background</label>
          <OptionCardPicker
            options={BACKGROUND_OPTIONS}
            value={settings.background.variant}
            onChange={(variant: BackgroundVariant) =>
              updateSettings({ ...settings, background: { ...settings.background, variant } })
            }
            ariaLabel="Background"
          />
        </div>
        <SettingsField
          label="Navigation bar position (desktop)"
          type="select"
          value={settings.navBar.position}
          options={NAV_POSITION_OPTIONS}
          onChange={(value) =>
            updateSettings({
              ...settings,
              navBar: { ...settings.navBar, position: value as NavBarPosition },
            })
          }
        />
      </div>
    </Modal>
  );
}
