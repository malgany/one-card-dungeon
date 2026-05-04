import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OVERWORLD_MUSIC_VOLUME_KEY = 'one-rpg-overworld-music-volume-v1';

describe('audio preferences', () => {
  const originalAudio = globalThis.Audio;
  const originalUserAgent = window.navigator.userAgent;

  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    globalThis.Audio = originalAudio;
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Audio = originalAudio;
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
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

  it('pauses overworld music when volume reaches zero', async () => {
    const instances = [];
    globalThis.Audio = class FakeAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.preload = '';
        this.volume = 1;
        this.paused = true;
        this.play = vi.fn(() => {
          this.paused = false;
          return Promise.resolve();
        });
        this.pause = vi.fn(() => {
          this.paused = true;
        });
        instances.push(this);
      }
    };
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Chrome',
      configurable: true,
    });

    const audioModule = await import('../../js/game/audio.js');
    audioModule.playOverworldMusic();
    expect(instances).toHaveLength(1);
    expect(instances[0].play).toHaveBeenCalledTimes(1);
    expect(instances[0].paused).toBe(false);

    audioModule.setOverworldMusicVolume(0);
    expect(instances[0].volume).toBe(0);
    expect(instances[0].pause).toHaveBeenCalledTimes(1);
    expect(instances[0].paused).toBe(true);

    audioModule.playOverworldMusic();
    expect(instances[0].play).toHaveBeenCalledTimes(1);

    audioModule.setOverworldMusicVolume(0.35);
    audioModule.playOverworldMusic();
    expect(instances[0].volume).toBe(0.35);
    expect(instances[0].play).toHaveBeenCalledTimes(2);
    expect(instances[0].paused).toBe(false);
  });
});
