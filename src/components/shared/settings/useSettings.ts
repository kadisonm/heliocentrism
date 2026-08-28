'use client';

import { useCallback } from 'react';
import { store } from '../../../lib/store/store';
import { useAppDispatch, useAppSelector } from '../../../lib/store/hooks';
import { setSettings } from '../../../lib/store/settingsSlice';
import type { AppSettings } from '../../../lib/data';

// Thin wrapper over the settings Redux slice (src/lib/store/settingsSlice.ts)
// — kept at the same call signature as before the Redux migration.
// getSettingsSnapshot stays a plain function (not a hook) for non-React
// callers like usePomodoroTimer.ts's countdown logic.
export function getSettingsSnapshot(): AppSettings {
  return store.getState().settings.settings;
}

export function useSettings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((state) => state.settings.settings);
  const isLoading = useAppSelector((state) => state.settings.isLoading);

  const updateSettings = useCallback(
    (next: AppSettings) => {
      dispatch(setSettings(next));
    },
    [dispatch]
  );

  return { settings, isLoading, updateSettings };
}
