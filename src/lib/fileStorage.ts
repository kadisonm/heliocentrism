// Firestore config storage only
const STORAGE_KEY_PREFIX = 'firestore_config_';

// Store settings to localStorage
export function saveSetting<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving setting:', error);
  }
}

// Load settings from localStorage
export function loadSetting<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`);
    return stored ? (JSON.parse(stored) as T) : defaultValue;
  } catch (error) {
    console.error('Error loading setting:', error);
    return defaultValue;
  }
}

// Clear a specific setting
export function clearSetting(key: string): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
  } catch (error) {
    console.error('Error clearing setting:', error);
  }
}
