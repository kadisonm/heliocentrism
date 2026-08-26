'use client';

import { useEffect, useRef } from 'react';
import { applyTheme, cacheTheme } from '../../lib/theme';
import { useSettings } from '../shared/settings/useSettings';

// Renders nothing — keeps DOM theme attributes (set pre-paint by
// THEME_INIT_SCRIPT) in sync with the Firestore setting once it resolves,
// and reacts live to OS color-scheme changes while mode is 'system'.
export default function ThemeSync() {
  const { settings, isLoading } = useSettings();

  // Lets the OS-preference listener read current theme without depending on
  // `settings.theme` directly, which would recreate the matchMedia
  // subscription on every theme edit, not just mode entering/leaving 'system'.
  const themeRef = useRef(settings.theme);
  useEffect(() => {
    themeRef.current = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    // Firestore hasn't resolved yet — leave the localStorage-restored
    // attributes from the pre-paint script alone rather than stomping them
    // with DEFAULT_SETTINGS.
    if (isLoading) return;

    applyTheme(settings.theme);
    cacheTheme(settings.theme);
  }, [isLoading, settings.theme]);

  useEffect(() => {
    if (isLoading || settings.theme.mode !== 'system') return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme(themeRef.current);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [isLoading, settings.theme.mode]);

  return null;
}
