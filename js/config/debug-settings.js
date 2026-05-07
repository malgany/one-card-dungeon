export const DEBUG_SETTINGS_KEY = 'one-rpg-debug-settings-v1';

export const DEFAULT_DEBUG_SETTINGS = Object.freeze({
  initialDialogue: false,
});

function storageAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function normalizeDebugSettings(settings = {}) {
  return {
    ...DEFAULT_DEBUG_SETTINGS,
    initialDialogue: settings?.initialDialogue === true,
  };
}

export function readDebugSettings() {
  if (!storageAvailable()) return normalizeDebugSettings();

  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEBUG_SETTINGS_KEY) || '{}');
    return normalizeDebugSettings(parsed);
  } catch {
    return normalizeDebugSettings();
  }
}

export function writeDebugSettings(settings) {
  const normalized = normalizeDebugSettings(settings);
  if (!storageAvailable()) return normalized;

  try {
    window.localStorage.setItem(DEBUG_SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Debug settings are non-critical; keep the in-memory value if storage is blocked.
  }

  return normalized;
}
