'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_ROUTINE_RESET_TIMES,
  DEFAULT_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  type AppSettings,
} from '../../../lib/data';
import { readAppSettings, writeAppSettings } from '../../../lib/firebaseSync';

// Module-level singleton, mirroring src/components/widgets/routines/useRoutineTasks.ts
// — every component that calls useSettings() shares this same in-memory
// copy, and getSettingsSnapshot() lets non-React code (the reset-check timer
// in useRoutineTasks.ts) read the current value synchronously outside of a
// hook.
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
    // Pre-existing accounts synced before pomodoro settings (or routine
    // reset times) existed won't have those fields — fill in defaults
    // rather than crash or silently drop the rest of the settings.
    settings = syncedSettings
      ? {
          ...DEFAULT_SETTINGS,
          ...syncedSettings,
          routineResetTimes: {
            ...DEFAULT_ROUTINE_RESET_TIMES,
            ...syncedSettings.routineResetTimes,
          },
          pomodoro: { ...DEFAULT_POMODORO_SETTINGS, ...syncedSettings.pomodoro },
          theme: { ...DEFAULT_THEME_SETTINGS, ...syncedSettings.theme },
        }
      : DEFAULT_SETTINGS;
    isLoading = false;
    notify();
  })();
}

// Pomodoro's minute inputs (and any other free-typed settings field) call
// updateSettings on every keystroke — without debouncing, each digit typed
// would fire its own full Firestore round-trip. The in-memory copy still
// updates and notifies synchronously above, so typing itself stays instant;
// only the network write is delayed until input settles.
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
