'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, type AppSettings } from '../../lib/data';
import { readAppSettings, writeAppSettings } from '../../lib/firebaseSync';

// Module-level singleton, mirroring src/components/tasks/useTodos.ts — every
// component that calls useSettings() shares this same in-memory copy, and
// getSettingsSnapshot() lets non-React code (the reset-check timer in
// useTodos.ts) read the current value synchronously outside of a hook.
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
    settings = syncedSettings ?? DEFAULT_SETTINGS;
    isLoading = false;
    notify();
  })();
}

function updateSettings(next: AppSettings) {
  settings = next;
  notify();
  writeAppSettings(settings);
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
