'use client';

import { LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import type { BackgroundImageSettings, BackgroundVariant, NavBarPosition, ThemeMode, ThemePalette } from '../../../lib/types';
import { BACKGROUND_VARIANTS } from '../../../lib/background';
import { resolveMode, THEME_PALETTES } from '../../../lib/theme';
import Modal from '../../common/Modal';
import OptionCardPicker, { type OptionCard } from '../../common/OptionCardPicker';
import RangeField from '../../common/RangeField';
import SettingsField from '../../common/SettingsField';
import { useSettings } from '../../shared/settings/useSettings';
import BackgroundPickerModal from './BackgroundPickerModal';
import { backgroundCard } from './backgroundCard';
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

export default function GeneralSettingsPanel({
  isOpen,
  onClose,
}: GeneralSettingsPanelProps) {
  const { settings, updateSettings } = useSettings();
  const [isBackgroundPickerOpen, setIsBackgroundPickerOpen] = useState(false);
  // Palette swatches preview in whichever light/dark mode is currently showing.
  const previewMode = resolveMode(settings.theme.mode);
  const paletteOptions = THEME_PALETTES.map((palette) => ({
    value: palette.id,
    label: palette.label,
    preview: <ThemeSwatch palette={palette.id} mode={previewMode} />,
  }));
  // Featured backgrounds, plus the current one if it lives behind "More backgrounds".
  const backgroundOptions = BACKGROUND_VARIANTS.filter(
    (background) => background.featured || background.id === settings.background.variant
  ).map(backgroundCard);
  const setBackgroundVariant = (variant: BackgroundVariant) =>
    updateSettings({ ...settings, background: { ...settings.background, variant } });
  const updateBackgroundImage = (patch: Partial<BackgroundImageSettings>) =>
    updateSettings({
      ...settings,
      background: { ...settings.background, image: { ...settings.background.image, ...patch } },
    });
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
            options={backgroundOptions}
            value={settings.background.variant}
            onChange={setBackgroundVariant}
            ariaLabel="Background"
            trailing={
              <button type="button" className="option-card background-picker-more" onClick={() => setIsBackgroundPickerOpen(true)}>
                <LayoutGrid size={18} />
                <span className="option-card__label">More backgrounds</span>
              </button>
            }
          />
        </div>
        {settings.background.variant === 'image' && (
          <>
            <SettingsField
              label="Image URL"
              value={settings.background.image.url}
              onChange={(url) => updateBackgroundImage({ url: url.trim() })}
              placeholder="https://example.com/wallpaper.jpg"
            />
            <p className="settings-hint">Animated GIFs work too — they&apos;ll play behind your dashboard.</p>
            <div className="settings-field-row">
              <RangeField
                label="Blur"
                value={settings.background.image.blur}
                onChange={(blur) => updateBackgroundImage({ blur })}
                min={0}
                max={20}
                suffix="px"
              />
              <RangeField
                label="Dim"
                value={settings.background.image.dim}
                onChange={(dim) => updateBackgroundImage({ dim })}
                min={0}
                max={80}
                step={5}
                suffix="%"
              />
            </div>
          </>
        )}
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

      <BackgroundPickerModal
        isOpen={isBackgroundPickerOpen}
        value={settings.background.variant}
        onSelect={setBackgroundVariant}
        onClose={() => setIsBackgroundPickerOpen(false)}
      />
    </Modal>
  );
}
