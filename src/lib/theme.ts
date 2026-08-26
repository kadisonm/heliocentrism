import { DEFAULT_THEME_SETTINGS } from './data';
import type { ThemeMode, ThemePalette, ThemeSettings } from './types';

// Extend as new palettes are added to $themes in src/styles/theme.scss.
export const THEME_PALETTES: { id: ThemePalette; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'catppuccin', label: 'Catppuccin' },
];

const THEME_STORAGE_KEY = 'heliocentrism_theme';

export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return mode;
}

export function applyTheme(theme: ThemeSettings): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.palette = theme.palette;
  document.documentElement.dataset.theme = resolveMode(theme.mode);
}

export function loadCachedTheme(): ThemeSettings {
  try {
    if (typeof window === 'undefined') return DEFAULT_THEME_SETTINGS;
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) return DEFAULT_THEME_SETTINGS;
    return { ...DEFAULT_THEME_SETTINGS, ...JSON.parse(stored) };
  } catch (error) {
    console.error('Error loading cached theme:', error);
    return DEFAULT_THEME_SETTINGS;
  }
}

export function cacheTheme(theme: ThemeSettings): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch (error) {
    console.error('Error caching theme:', error);
  }
}

// Pre-paint script (injected in layout.tsx) that stamps data-palette/
// data-theme on <html> before first paint so the cached choice renders with
// no flash. Runs before any module script, so it can't import loadCachedTheme
// /applyTheme — keep this in sync with them by hand if the cache shape changes.
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = stored ? JSON.parse(stored) : {};
    var palette = theme.palette || ${JSON.stringify(DEFAULT_THEME_SETTINGS.palette)};
    var mode = theme.mode || ${JSON.stringify(DEFAULT_THEME_SETTINGS.mode)};
    var resolved = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    document.documentElement.dataset.palette = palette;
    document.documentElement.dataset.theme = resolved;
  } catch (e) {}
})();`;
