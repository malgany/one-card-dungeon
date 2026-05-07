import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEBUG_SETTINGS_KEY,
  normalizeDebugSettings,
  readDebugSettings,
  writeDebugSettings,
} from '../../js/config/debug-settings.js';

describe('debug settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults the initial dialogue override to off', () => {
    expect(normalizeDebugSettings()).toEqual({ initialDialogue: false });
    expect(readDebugSettings()).toEqual({ initialDialogue: false });
  });

  it('persists the initial dialogue override for reloads', () => {
    expect(writeDebugSettings({ initialDialogue: true })).toEqual({ initialDialogue: true });
    expect(localStorage.getItem(DEBUG_SETTINGS_KEY)).toBe('{"initialDialogue":true}');
    expect(readDebugSettings()).toEqual({ initialDialogue: true });
  });
});
