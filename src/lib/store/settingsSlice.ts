import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  DEFAULT_BACKGROUND_SETTINGS,
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  type AppSettings,
} from '../data';
import { readAppSettings } from '../firebaseSync';
import type { AppDispatch } from './store';

export type SettingsState = {
  settings: AppSettings;
  isLoading: boolean;
};

const initialState: SettingsState = {
  settings: DEFAULT_SETTINGS,
  isLoading: true,
};

let hasStartedLoad = false;

export const loadSettings = createAsyncThunk('settings/load', async () => {
  const syncedSettings = await readAppSettings();
  // Pre-existing accounts synced before pomodoro settings existed won't have
  // that field — fill in defaults rather than crash or silently drop the
  // rest of the settings.
  return syncedSettings
    ? {
        ...DEFAULT_SETTINGS,
        ...syncedSettings,
        pomodoro: { ...DEFAULT_POMODORO_SETTINGS, ...syncedSettings.pomodoro },
        theme: { ...DEFAULT_THEME_SETTINGS, ...syncedSettings.theme },
        background: { ...DEFAULT_BACKGROUND_SETTINGS, ...syncedSettings.background },
      }
    : DEFAULT_SETTINGS;
});

export function ensureSettingsLoaded(dispatch: AppDispatch) {
  if (hasStartedLoad) return;
  hasStartedLoad = true;
  dispatch(loadSettings());
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (state, action: PayloadAction<AppSettings>) => {
      state.settings = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadSettings.fulfilled, (state, action) => {
      state.settings = action.payload;
      state.isLoading = false;
    });
  },
});

export const { setSettings } = settingsSlice.actions;
export default settingsSlice.reducer;
