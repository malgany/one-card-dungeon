import { publicAssetUrl } from '../config/public-paths.js';

const OVERWORLD_MUSIC_SRC = publicAssetUrl('assets/audio/verden-i.mp3');
const COMBAT_MUSIC_SRC = encodeURI(publicAssetUrl('assets/audio/Skyblade Ocarina.mp3'));
const OVERWORLD_MUSIC_VOLUME = 0.5;
const OVERWORLD_MUSIC_VOLUME_KEY = 'one-rpg-overworld-music-volume-v1';

let overworldMusic = null;
let combatMusic = null;
let overworldMusicVolume = readStoredOverworldMusicVolume();

function storageAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function readStoredOverworldMusicVolume() {
  if (!storageAvailable()) return OVERWORLD_MUSIC_VOLUME;

  try {
    const raw = window.localStorage.getItem(OVERWORLD_MUSIC_VOLUME_KEY);
    if (raw === null) return OVERWORLD_MUSIC_VOLUME;
    const storedVolume = Number(raw);
    if (!Number.isFinite(storedVolume)) return OVERWORLD_MUSIC_VOLUME;
    return Math.min(1, Math.max(0, storedVolume));
  } catch {
    return OVERWORLD_MUSIC_VOLUME;
  }
}

function storeOverworldMusicVolume(volume) {
  if (!storageAvailable()) return;

  try {
    window.localStorage.setItem(OVERWORLD_MUSIC_VOLUME_KEY, String(volume));
  } catch {
    // Volume preference should fail silently if the browser blocks storage.
  }
}

function canUseMediaPlayback() {
  return typeof Audio !== 'undefined' && (
    typeof navigator === 'undefined' ||
    !navigator.userAgent?.includes('jsdom')
  );
}

function getOverworldMusic() {
  if (!canUseMediaPlayback()) return null;

  if (!overworldMusic) {
    overworldMusic = new Audio(OVERWORLD_MUSIC_SRC);
    overworldMusic.loop = true;
    overworldMusic.preload = 'auto';
    overworldMusic.volume = overworldMusicVolume;
  }

  return overworldMusic;
}

function getCombatMusic() {
  if (!canUseMediaPlayback()) return null;

  if (!combatMusic) {
    combatMusic = new Audio(COMBAT_MUSIC_SRC);
    combatMusic.loop = true;
    combatMusic.preload = 'auto';
    combatMusic.volume = overworldMusicVolume;
  }

  return combatMusic;
}

export function getOverworldMusicVolume() {
  return overworldMusicVolume;
}

export function setOverworldMusicVolume(volume) {
  const normalized = Math.min(1, Math.max(0, Number(volume) || 0));
  overworldMusicVolume = normalized;
  storeOverworldMusicVolume(normalized);
  if (overworldMusic) {
    overworldMusic.volume = normalized;
  }
  if (combatMusic) {
    combatMusic.volume = normalized;
  }
  if (normalized === 0) {
    stopOverworldMusic();
    stopCombatMusic();
  }
  return overworldMusicVolume;
}

export function playOverworldMusic() {
  stopCombatMusic();
  if (overworldMusicVolume === 0) return;

  const audio = getOverworldMusic();
  if (!audio || !audio.paused) return;

  try {
    audio.play()?.catch(() => {
      // Browsers may block playback outside a user gesture; gameplay can continue silently.
    });
  } catch {
    // Gameplay should not fail if the browser refuses media playback.
  }
}

export function stopOverworldMusic() {
  const audio = overworldMusic;
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // Ignore media teardown errors from partially initialized audio elements.
  }
}

export function playCombatMusic() {
  stopOverworldMusic();
  if (overworldMusicVolume === 0) return;

  const audio = getCombatMusic();
  if (!audio || !audio.paused) return;

  try {
    audio.volume = overworldMusicVolume;
    audio.play()?.catch(() => {
      // Browsers may block playback outside a user gesture; gameplay can continue silently.
    });
  } catch {
    // Gameplay should not fail if the browser refuses media playback.
  }
}

export function stopCombatMusic() {
  const audio = combatMusic;
  if (!audio) return;

  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // Ignore media teardown errors from partially initialized audio elements.
  }
}
