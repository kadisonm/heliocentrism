'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  DEFAULT_BACKGROUND_SETTINGS,
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  type AppSettings,
} from '../../../lib/data';
import { readAppSettings, writeAppSettings } from '../../../lib/firebaseSync';

// Module-level singleton — every component that calls useSettings() shares
// this same in-memory copy, and getSettingsSnapshot() lets non-React code
// (e.g. the Pomodoro timer's countdown logic) read the current value
// synchronously outside of a hook.
let settings: AppSettings = DEFAULT_SETTINGS;
let isLoading = true;
let hasStartedLoad = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return settings;
}

function getIsLoadingSnapshot() {
  return isLoading;
}

function ensureLoaded() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;

  (async () => {
    const syncedSettings = await readAppSettings();
    // Pre-existing accounts synced before pomodoro settings existed won't
    // have that field — fill in defaults rather than crash or silently drop
    // the rest of the settings.
    settings = syncedSettings
      ? {
          ...DEFAULT_SETTINGS,
          ...syncedSettings,
          pomodoro: { ...DEFAULT_POMODORO_SETTINGS, ...syncedSettings.pomodoro },
          theme: { ...DEFAULT_THEME_SETTINGS, ...syncedSettings.theme },
          background: { ...DEFAULT_BACKGROUND_SETTINGS, ...syncedSettings.background },
        }
      : DEFAULT_SETTINGS;
    isLoading = false;
    notify();
  })();
}

// Debounces the Firestore write only — free-typed fields call updateSettings
// per keystroke, and the in-memory copy still updates/notifies synchronously
// above, so typing stays instant while the network write waits for settle.
let writeTimeout: ReturnType<typeof setTimeout> | null = null;

function updateSettings(next: AppSettings) {
  settings = next;
  notify();

  if (writeTimeout) clearTimeout(writeTimeout);
  writeTimeout = setTimeout(() => {
    writeTimeout = null;
    writeAppSettings(settings);
  }, 500);
}

export function getSettingsSnapshot(): AppSettings {
  return settings;
}

export function useSettings() {
  useEffect(() => {
    ensureLoaded();
  }, []);

  const currentSettings = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_SETTINGS);
  const currentIsLoading = useSyncExternalStore(subscribe, getIsLoadingSnapshot, () => true);

  return {
    settings: currentSettings,
    isLoading: currentIsLoading,
    updateSettings,
  };
}
