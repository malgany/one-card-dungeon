import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OVERWORLD_MUSIC_VOLUME_KEY = 'one-rpg-overworld-music-volume-v1';

describe('audio preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists overworld music volume in localStorage and restores it on reload', async () => {
    const audioModule = await import('../../js/game/audio.js');

    expect(audioModule.getOverworldMusicVolume()).toBe(0.5);

    audioModule.setOverworldMusicVolume(0.25);
    expect(localStorage.getItem(OVERWORLD_MUSIC_VOLUME_KEY)).toBe('0.25');

    vi.resetModules();
    const reloadedAudioModule = await import('../../js/game/audio.js');

    expect(reloadedAudioModule.getOverworldMusicVolume()).toBe(0.25);
  });

  it('clamps invalid stored values back to the default volume', async () => {
    localStorage.setItem(OVERWORLD_MUSIC_VOLUME_KEY, 'not-a-number');

    const audioModule = await import('../../js/game/audio.js');

    expect(audioModule.getOverworldMusicVolume()).toBe(0.5);
  });
});
