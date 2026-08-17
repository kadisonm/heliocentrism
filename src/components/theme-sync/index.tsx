'use client';

import { useEffect } from 'react';
import { applyTheme, cacheTheme } from '../../lib/theme';
import { useSettings } from '../tasks/useSettings';

// Renders nothing — mounted once in layout.tsx to keep the DOM theme
// attributes (set synchronously pre-paint by the inline script, see
// THEME_INIT_SCRIPT) in sync with the Firestore-backed setting once it
// resolves, and to react live to OS color-scheme changes while mode is
// 'system'.
export default function ThemeSync() {
  const { settings, isLoading } = useSettings();

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
    const handleChange = () => applyTheme(settings.theme);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [isLoading, settings.theme]);

  return null;
}
