const OVERWORLD_MUSIC_SRC = '/assets/audio/verden-i.mp3';
const OVERWORLD_MUSIC_VOLUME = 0.5;

let overworldMusic = null;
let overworldMusicVolume = OVERWORLD_MUSIC_VOLUME;

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

export function getOverworldMusicVolume() {
  return overworldMusicVolume;
}

export function setOverworldMusicVolume(volume) {
  const normalized = Math.min(1, Math.max(0, Number(volume) || 0));
  overworldMusicVolume = normalized;
  if (overworldMusic) overworldMusic.volume = normalized;
  return overworldMusicVolume;
}

export function playOverworldMusic() {
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
  } catch {
    // Ignore media teardown errors from partially initialized audio elements.
  }
}
