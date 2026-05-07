import { mountMenuCharacterPreview } from './menu-character-viewer.js';
import { playOverworldMusic, stopOverworldMusic } from '../game/audio.js';
import {
  CHARACTERS_KEY,
  SELECTED_CHARACTER_KEY,
  applyCharacterProgressToPlayer,
} from '../game/character-progress.js';
import {
  CHARACTER_TYPES,
  characterAccentColor,
  createPaletteDraft,
  getPaletteSlotControls,
  getPaletteSlotGroups,
  getPaletteSlotsForControl,
  getCharacterType,
  normalizeCharacterRecord,
  normalizeHexColor,
  sanitizeCharacterName,
  serializePaletteDraft,
} from '../config/character-palettes.js';
import { NURSERY_INTRO_MAP_ID } from '../config/cutscenes/nursery-intro.js';

function versionedAssetUrl(path) {
  return `${path}?v=${INTRO_ASSET_VERSION}`;
}

const MENU_ASSETS = {
  home: '/assets/ui/menu/capa.png',
  select: '/assets/ui/menu/capa0.png',
  create: '/assets/ui/menu/capa2.png',
  logo: '/assets/ui/menu/logo.png',
};

const INTRO_ASSET_VERSION = '2026-05-06-webp-q90-v1';
const INTRO_SCENE_BASE = '/assets/cenas-inicio/';
const INTRO_SCENE_DURATION = 4500;
const INTRO_END_BLACKOUT_DURATION = 2000;
const INTRO_TRANSITION_DURATION = 560;
const INTRO_SOUND_BASE = `${INTRO_SCENE_BASE}sounds/`;
const INTRO_SOUND_VOLUME = 0.82;
const INTRO_MUSIC_VOLUME = 0.28;
const INTRO_MUSIC_SOURCE = versionedAssetUrl(`${INTRO_SOUND_BASE}${encodeURI('Black Vault Pulse.mp3')}`);
const INTRO_SOUND_SOURCES = {
  scene12: versionedAssetUrl(`${INTRO_SOUND_BASE}${encodeURI('1&2.mp3')}`),
  scene3: versionedAssetUrl(`${INTRO_SOUND_BASE}${encodeURI('3.mp3')}`),
  scene4: versionedAssetUrl(`${INTRO_SOUND_BASE}${encodeURI('4.mp3')}`),
  scene5: versionedAssetUrl(`${INTRO_SOUND_BASE}${encodeURI('5.mp3')}`),
  scene78: versionedAssetUrl(`${INTRO_SOUND_BASE}${encodeURI('7&8.mp3')}`),
};
const INTRO_SOUND_BY_SCENE = [
  'scene12',
  'scene12',
  'scene3',
  'scene4',
  'scene5',
  null,
  'scene78',
  'scene78',
];
const INTRO_CAMERA_PATHS = [
  { startX: -18, startY: 7, endX: 16, endY: -7, focusX: '50%', focusY: '52%' },
  { startX: 14, startY: -8, endX: -16, endY: 8, focusX: '48%', focusY: '54%' },
  { startX: -12, startY: -5, endX: 18, endY: 5, focusX: '52%', focusY: '50%' },
  { startX: 18, startY: 6, endX: -14, endY: -6, focusX: '50%', focusY: '52%' },
  { startX: -16, startY: 8, endX: 12, endY: -8, focusX: '51%', focusY: '51%' },
  { startX: 10, startY: -7, endX: -18, endY: 7, focusX: '49%', focusY: '53%' },
  { startX: -14, startY: 5, endX: 18, endY: -5, focusX: '50%', focusY: '50%' },
  { startX: 16, startY: -6, endX: -12, endY: 6, focusX: '52%', focusY: '51%' },
];
const INTRO_SCENES = INTRO_CAMERA_PATHS.map((path, index) => {
  const filename = `scene-${String(index + 1).padStart(2, '0')}.webp`;
  return {
    ...path,
    image: versionedAssetUrl(`${INTRO_SCENE_BASE}${encodeURI(filename)}`),
    soundKey: INTRO_SOUND_BY_SCENE[index],
  };
});

const MAX_CHARACTERS = 3;
const CHARACTER_NAME_MAX_LENGTH = 30;
const CHARACTER_NAME_PATTERN = '[A-Za-z0-9À-ÖØ-öø-ÿ]{1,30}';

function storageAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function readStorage(key, fallback) {
  if (!storageAvailable()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (!storageAvailable()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The menu still works for the current session if storage is unavailable.
  }
}

function writeStorageText(key, value) {
  if (!storageAvailable()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The menu still works for the current session if storage is unavailable.
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeCharacter(character, index = 0) {
  return normalizeCharacterRecord(character, index);
}

function createCharacterId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `character-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadCharacters() {
  const loaded = readStorage(CHARACTERS_KEY, []);
  if (!Array.isArray(loaded)) return [];

  return loaded
    .slice(0, MAX_CHARACTERS)
    .map((character, index) => normalizeCharacter(character, index));
}

function saveCharacters(characters) {
  writeStorage(CHARACTERS_KEY, characters.slice(0, MAX_CHARACTERS));
}

function setSelectedCharacterId(id) {
  writeStorageText(SELECTED_CHARACTER_KEY, id);
}

function getSelectedCharacterId() {
  if (!storageAvailable()) return null;
  try {
    return window.localStorage.getItem(SELECTED_CHARACTER_KEY);
  } catch {
    return null;
  }
}

function typeButton(type, activeTypeId) {
  const active = type.id === activeTypeId ? ' is-selected' : '';
  return `
    <button class="menu-type-button${active}" type="button" data-menu-action="choose-type" data-type-id="${escapeHtml(type.id)}">
      <img src="${escapeHtml(type.image)}" alt="" class="menu-type-thumb">
      <span>
        <strong>${escapeHtml(type.label)}</strong>
        <small>${escapeHtml(type.summary)}</small>
      </span>
    </button>
  `;
}

function paletteSlotControl(slotControl, color, activeSlotId, index) {
  const slotGroup = slotControl.slots || slotControl;
  const label = slotControl.label || null;
  const controlSlotId = slotGroup[0];
  const active = controlSlotId === activeSlotId ? ' is-selected' : '';
  const safeLabel = label ? escapeHtml(label.toUpperCase()) : '';

  if (label) {
    return `
      <div class="menu-palette-row${active}" data-palette-slot-id="${escapeHtml(controlSlotId)}" data-palette-slot-ids="${escapeHtml(slotGroup.join(','))}" style="--swatch:${escapeHtml(color)}">
        <span class="menu-palette-row-label">${safeLabel}</span>
        <label class="menu-palette-row-swatch" title="${safeLabel}">
          <input class="menu-palette-color-input" type="color" value="${escapeHtml(color.toLowerCase())}" data-palette-color-input data-slot-id="${escapeHtml(controlSlotId)}" aria-label="${safeLabel}">
        </label>
        <input class="menu-palette-row-hex" data-palette-inline-hex-input data-slot-id="${escapeHtml(controlSlotId)}" value="${escapeHtml(color)}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex ${safeLabel}">
      </div>
    `;
  }

  return `
    <label class="menu-palette-slot${active}" data-palette-slot-id="${escapeHtml(controlSlotId)}" data-palette-slot-ids="${escapeHtml(slotGroup.join(','))}" style="--swatch:${escapeHtml(color)}" title="Bloco ${index + 1}">
      <input class="menu-palette-color-input" type="color" value="${escapeHtml(color.toLowerCase())}" data-palette-color-input data-slot-id="${escapeHtml(controlSlotId)}" aria-label="Cor do bloco ${index + 1}">
    </label>
  `;
}

function characterClothingColors(character) {
  const fallback = normalizeHexColor(character.color) || '#ffffff';
  const draft = createPaletteDraft(character.type, character.palette);
  const controls = getPaletteSlotControls(character.type);

  const colorForControl = (label, fallbackColor) => {
    const control = controls.find((candidate) => candidate.label === label);
    const slotId = control?.slots?.[0];
    return normalizeHexColor(slotId ? draft[slotId] : null) || fallbackColor;
  };

  const primary = colorForControl('Roupas 1', fallback);
  const secondary = colorForControl('Roupas 2', primary);

  return { primary, secondary };
}

function characterRow(character, selectedId) {
  const active = character.id === selectedId ? ' is-selected' : '';
  const clothingColors = characterClothingColors(character);
  const colorStyle = [
    `--character-color:${escapeHtml(character.color)}`,
    `--character-primary-color:${escapeHtml(clothingColors.primary)}`,
    `--character-secondary-color:${escapeHtml(clothingColors.secondary)}`,
  ].join('; ');

  return `
    <div class="menu-character-row${active}" data-menu-action="select-character" data-character-id="${escapeHtml(character.id)}">
      <img src="${escapeHtml(character.image)}" alt="" class="menu-character-thumb">
      <span class="menu-character-copy">
        <strong>${escapeHtml(character.name)}</strong>
        <small>${escapeHtml(character.typeLabel)}</small>
      </span>
      <span class="menu-character-color" title="Roupa 1 em cima, Roupa 2 embaixo" style="${colorStyle}"></span>
      <button class="menu-delete-button" type="button" data-menu-action="delete-character" data-character-id="${escapeHtml(character.id)}" title="Excluir personagem">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
      </button>
    </div>
  `;
}

export function createMenuFlow({ state, actions, root = null } = {}) {
  const menuRoot = root || document.getElementById('menu-root') || document.createElement('div');
  if (!menuRoot.id) menuRoot.id = 'menu-root';
  if (!menuRoot.parentElement) document.body.append(menuRoot);

  const eventController = new AbortController();
  const eventOptions = { signal: eventController.signal };
  let characters = loadCharacters();
  let selectedCharacterId = getSelectedCharacterId() || characters[0]?.id || null;
  let activeTypeId = CHARACTER_TYPES[0].id;
  const paletteDraftByType = {};
  const activePaletteSlotByType = {};
  let nameDraft = '';
  let activeCharacterPreview = null;
  let createReturnScreen = 'home';
  let introTimer = null;
  let introTransitionTimer = null;
  let introAnimationFrame = null;
  let introAfterFinish = null;
  let introSceneIndex = 0;
  let introActiveSlot = 0;
  let introStartedAt = 0;
  let introFinishing = false;
  let introSlots = [];
  let introPointer = { x: 0, y: 0 };
  let introSoundByKey = new Map();
  let activeIntroSoundKey = null;
  let introMusic = null;
  let menuDialog = null;

  function selectedCharacter() {
    return characters.find((character) => character.id === selectedCharacterId) || characters[0] || null;
  }

  function closeMenuDialog() {
    menuDialog = null;
    menuRoot.querySelector('[data-menu-dialog]')?.remove();
  }

  function renderMenuDialog() {
    menuRoot.querySelector('[data-menu-dialog]')?.remove();
    if (!menuDialog) return;

    menuRoot.insertAdjacentHTML('beforeend', `
      <div class="menu-dialog-backdrop" data-menu-dialog role="presentation">
        <section class="menu-dialog menu-glass" role="dialog" aria-modal="true" aria-labelledby="menu-dialog-title" aria-describedby="menu-dialog-message">
          <div class="menu-dialog-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
          </div>
          <div class="menu-dialog-copy">
            <strong id="menu-dialog-title">${escapeHtml(menuDialog.title)}</strong>
            <p id="menu-dialog-message">${escapeHtml(menuDialog.message)}</p>
          </div>
          <div class="menu-dialog-actions">
            <button class="menu-secondary-button" type="button" data-menu-action="dialog-cancel">${escapeHtml(menuDialog.cancelLabel || 'Cancelar')}</button>
            <button class="menu-danger-button" type="button" data-menu-action="dialog-confirm">${escapeHtml(menuDialog.confirmLabel || 'Excluir')}</button>
          </div>
        </section>
      </div>
    `);

    menuRoot.querySelector('[data-menu-action="dialog-cancel"]')?.focus();
  }

  function requestDeleteCharacter(character) {
    menuDialog = {
      type: 'delete-character',
      characterId: character.id,
      title: 'Excluir personagem',
      message: `Tem certeza que deseja excluir "${character.name}"? Essa acao nao pode ser desfeita.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
    };
    renderMenuDialog();
  }

  function confirmMenuDialog() {
    if (!menuDialog) return;

    if (menuDialog.type === 'delete-character') {
      const charId = menuDialog.characterId;
      characters = characters.filter((c) => c.id !== charId);
      saveCharacters(characters);
      if (selectedCharacterId === charId) {
        selectedCharacterId = characters[0]?.id || null;
        setSelectedCharacterId(selectedCharacterId);
      }
      menuDialog = null;
      renderSelect();
    }
  }

  function ensurePaletteDraft(typeId) {
    if (!paletteDraftByType[typeId]) {
      paletteDraftByType[typeId] = createPaletteDraft(typeId);
    }

    return paletteDraftByType[typeId];
  }

  function activePaletteSlotId(typeId) {
    const controlSlots = getPaletteSlotGroups(typeId).map((group) => group[0]);
    if (!activePaletteSlotByType[typeId] || !controlSlots.includes(activePaletteSlotByType[typeId])) {
      activePaletteSlotByType[typeId] = controlSlots[0];
    }

    return activePaletteSlotByType[typeId];
  }

  function activePalette(typeId) {
    return serializePaletteDraft(typeId, ensurePaletteDraft(typeId));
  }

  function activeAccentColor(typeId) {
    return characterAccentColor(typeId, activePalette(typeId));
  }

  function syncActivePaletteSlotUi() {
    const activeSlotId = activePaletteSlotId(activeTypeId);
    const draft = ensurePaletteDraft(activeTypeId);

    menuRoot.querySelectorAll('[data-palette-slot-id]').forEach((slotControl) => {
      slotControl.classList.toggle('is-selected', slotControl.dataset.paletteSlotId === activeSlotId);
    });

    const hexInput = menuRoot.querySelector('[data-palette-hex-input]');
    if (hexInput) {
      hexInput.value = draft[activeSlotId] || '';
      hexInput.dataset.slotId = activeSlotId;
      hexInput.classList.remove('is-invalid');
    }

    const inlineHexInput = menuRoot.querySelector(`[data-palette-inline-hex-input][data-slot-id="${activeSlotId}"]`);
    if (inlineHexInput) {
      inlineHexInput.value = draft[activeSlotId] || '';
      inlineHexInput.classList.remove('is-invalid');
    }
  }

  function syncPalettePreview() {
    const palette = activePalette(activeTypeId);
    const accent = activeAccentColor(activeTypeId);

    menuRoot.querySelector('.menu-create-stage')?.style.setProperty('--character-color', accent);
    menuRoot.querySelector('.menu-character-nameplate')?.style.setProperty('--character-color', accent);
    activeCharacterPreview?.updatePalette?.(palette);
  }

  function setPaletteSlotColor(slotId, value) {
    const color = normalizeHexColor(value);
    if (!color) return false;

    const draft = ensurePaletteDraft(activeTypeId);
    const slotIds = getPaletteSlotsForControl(activeTypeId, slotId);
    const controlSlotId = slotIds[0] || slotId;
    for (const groupedSlotId of slotIds) {
      draft[groupedSlotId] = color;
    }
    activePaletteSlotByType[activeTypeId] = controlSlotId;

    const slotControl = menuRoot.querySelector(`[data-palette-slot-id="${controlSlotId}"]`);
    slotControl?.style.setProperty('--swatch', color);
    slotControl?.querySelector('[data-palette-color-input]')?.setAttribute('value', color.toLowerCase());

    const colorInput = menuRoot.querySelector(`[data-palette-color-input][data-slot-id="${controlSlotId}"]`);
    if (colorInput) colorInput.value = color.toLowerCase();

    const hexInput = menuRoot.querySelector('[data-palette-hex-input]');
    if (hexInput) {
      hexInput.value = color;
      hexInput.classList.remove('is-invalid');
      hexInput.dataset.slotId = controlSlotId;
    }

    const inlineHexInput = menuRoot.querySelector(`[data-palette-inline-hex-input][data-slot-id="${controlSlotId}"]`);
    if (inlineHexInput) {
      inlineHexInput.value = color;
      inlineHexInput.classList.remove('is-invalid');
    }

    syncActivePaletteSlotUi();
    syncPalettePreview();
    return true;
  }

  function resetActivePalette() {
    paletteDraftByType[activeTypeId] = createPaletteDraft(activeTypeId);
    activePaletteSlotByType[activeTypeId] = getPaletteSlotGroups(activeTypeId)[0]?.[0];
    renderCreate();
  }

  function syncNameInput(input) {
    if (!input) return '';

    const sanitized = sanitizeCharacterName(input.value, CHARACTER_NAME_MAX_LENGTH);
    if (input.value !== sanitized) input.value = sanitized;
    nameDraft = sanitized;
    input.classList.toggle('is-invalid', sanitized.length === 0);
    input.setCustomValidity(sanitized ? '' : 'Informe um nome com letras e números, sem espaços.');
    return sanitized;
  }

  function flashPaletteSlot(slotId) {
    activeCharacterPreview?.flashPaletteSlot?.(getPaletteSlotsForControl(activeTypeId, slotId));
  }

  function setBackground(image) {
    menuRoot.style.backgroundImage = image ? `url("${image}")` : 'none';
  }

  function disposeCharacterPreview() {
    activeCharacterPreview?.dispose();
    activeCharacterPreview = null;
  }

  function canUseIntroSound() {
    return typeof Audio !== 'undefined' && (
      typeof navigator === 'undefined' ||
      !navigator.userAgent?.includes('jsdom')
    );
  }

  function getIntroSound(soundKey) {
    if (!soundKey || !canUseIntroSound()) return null;

    const source = INTRO_SOUND_SOURCES[soundKey];
    if (!source) return null;

    if (!introSoundByKey.has(soundKey)) {
      const audio = new Audio(source);
      audio.preload = 'auto';
      audio.loop = false;
      audio.volume = INTRO_SOUND_VOLUME;
      introSoundByKey.set(soundKey, audio);
    }

    return introSoundByKey.get(soundKey);
  }

  function preloadIntroSounds() {
    for (const soundKey of new Set(INTRO_SOUND_BY_SCENE.filter(Boolean))) {
      const audio = getIntroSound(soundKey);
      try {
        audio?.load?.();
      } catch {
        // The intro should continue silently if a browser refuses media preloading.
      }
    }
  }

  function getIntroMusic() {
    if (!canUseIntroSound()) return null;

    if (!introMusic) {
      introMusic = new Audio(INTRO_MUSIC_SOURCE);
      introMusic.preload = 'auto';
      introMusic.loop = false;
      introMusic.volume = INTRO_MUSIC_VOLUME;
    }

    return introMusic;
  }

  function playIntroMusic() {
    const audio = getIntroMusic();
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.volume = INTRO_MUSIC_VOLUME;
      audio.play()?.catch(() => {
        // Browsers may block playback; scene audio and visuals should continue.
      });
    } catch {
      // Ignore media playback errors; the intro can run silently.
    }
  }

  function stopIntroMusic() {
    const audio = introMusic;
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Ignore teardown errors from partially initialized audio elements.
    }

    introMusic = null;
  }

  function stopIntroSound(soundKey = activeIntroSoundKey) {
    if (!soundKey) return;

    const audio = introSoundByKey.get(soundKey);
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Ignore teardown errors from partially initialized audio elements.
    }

    if (activeIntroSoundKey === soundKey) activeIntroSoundKey = null;
  }

  function stopAllIntroSounds() {
    for (const soundKey of introSoundByKey.keys()) {
      stopIntroSound(soundKey);
    }
    activeIntroSoundKey = null;
  }

  function syncIntroSoundForScene(sceneIndex) {
    const nextSoundKey = INTRO_SCENES[sceneIndex]?.soundKey || null;
    if (nextSoundKey === activeIntroSoundKey) return;

    stopIntroSound();
    if (!nextSoundKey) return;

    const audio = getIntroSound(nextSoundKey);
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.volume = INTRO_SOUND_VOLUME;
      activeIntroSoundKey = nextSoundKey;
      audio.play()?.catch(() => {
        if (activeIntroSoundKey === nextSoundKey) activeIntroSoundKey = null;
      });
    } catch {
      activeIntroSoundKey = null;
    }
  }

  function clearIntroState({ keepCallback = false } = {}) {
    stopIntroMusic();
    stopAllIntroSounds();
    if (introTimer) window.clearTimeout(introTimer);
    if (introTransitionTimer) window.clearTimeout(introTransitionTimer);
    if (introAnimationFrame) window.cancelAnimationFrame(introAnimationFrame);

    introTimer = null;
    introTransitionTimer = null;
    introAnimationFrame = null;
    introSceneIndex = 0;
    introActiveSlot = 0;
    introStartedAt = 0;
    introFinishing = false;
    introSlots = [];
    introPointer = { x: 0, y: 0 };
    introSoundByKey = new Map();
    if (!keepCallback) introAfterFinish = null;
  }

  function mountCharacterPreview(character) {
    const target = menuRoot.querySelector('[data-menu-character-preview]');
    if (!target || !character) return;

    activeCharacterPreview = mountMenuCharacterPreview(target, {
      typeId: character.type,
      fallbackImage: character.image,
      palette: character.palette,
    });
  }

  function showRoot(screenName, image) {
    if (screenName !== 'intro') clearIntroState();
    menuRoot.hidden = false;
    menuRoot.className = `menu-root menu-root--${screenName}`;
    document.body.classList.add('menu-open');
    setBackground(image);
  }

  function hideRoot() {
    clearIntroState();
    disposeCharacterPreview();
    menuRoot.hidden = true;
    menuRoot.className = 'menu-root';
    document.body.classList.remove('menu-open');
  }

  function preloadIntroScenes() {
    if (typeof Image === 'undefined') return;

    for (const scene of INTRO_SCENES) {
      const image = new Image();
      image.decoding = 'async';
      image.src = scene.image;
    }
  }

  function setIntroSlotScene(slot, scene, index) {
    if (!slot || !scene) return;

    slot.dataset.sceneIndex = String(index);
    slot.setAttribute('aria-label', `Cena ${index + 1} de ${INTRO_SCENES.length}`);
    slot.style.setProperty('--intro-image', `url("${scene.image}")`);
    slot.style.setProperty('--intro-focus-x', scene.focusX);
    slot.style.setProperty('--intro-focus-y', scene.focusY);
  }

  function setIntroLayerOffsets(slot, scene, elapsed) {
    if (!slot || !scene) return;

    const rawProgress = Math.max(0, Math.min(1, elapsed / INTRO_SCENE_DURATION));
    const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
    const cameraX = scene.startX + (scene.endX - scene.startX) * progress;
    const cameraY = scene.startY + (scene.endY - scene.startY) * progress;
    const pointerX = introPointer.x * 18;
    const pointerY = introPointer.y * 14;

    slot.style.setProperty('--intro-back-x', `${(-cameraX * 0.22 + pointerX * 0.12).toFixed(2)}px`);
    slot.style.setProperty('--intro-back-y', `${(-cameraY * 0.18 + pointerY * 0.1).toFixed(2)}px`);
    slot.style.setProperty('--intro-mid-x', `${(cameraX * 0.48 + pointerX * 0.28).toFixed(2)}px`);
    slot.style.setProperty('--intro-mid-y', `${(cameraY * 0.36 + pointerY * 0.24).toFixed(2)}px`);
    slot.style.setProperty('--intro-front-x', `${(cameraX * 0.86 + pointerX * 0.52).toFixed(2)}px`);
    slot.style.setProperty('--intro-front-y', `${(cameraY * 0.7 + pointerY * 0.44).toFixed(2)}px`);
  }

  function updateIntroProgress(index) {
    menuRoot.querySelectorAll('[data-intro-progress-dot]').forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === index);
    });
  }

  function runIntroCamera(now) {
    if (!menuRoot.classList.contains('menu-root--intro') || introSlots.length === 0) {
      introAnimationFrame = null;
      return;
    }

    const slot = introSlots[introActiveSlot];
    const scene = INTRO_SCENES[introSceneIndex];
    setIntroLayerOffsets(slot, scene, now - introStartedAt);
    introAnimationFrame = window.requestAnimationFrame(runIntroCamera);
  }

  function showIntroBlackout() {
    menuRoot.innerHTML = '<section class="menu-intro-blackout" aria-hidden="true"></section>';
  }

  function finishIntro({ withBlackout = false } = {}) {
    if (introFinishing) return;

    introFinishing = true;
    const afterFinish = introAfterFinish;

    if (withBlackout) {
      clearIntroState({ keepCallback: true });
      introFinishing = true;
      introAfterFinish = afterFinish;
      showIntroBlackout();
      introTimer = window.setTimeout(() => {
        const callback = introAfterFinish;
        clearIntroState();
        if (typeof callback === 'function') callback();
      }, INTRO_END_BLACKOUT_DURATION);
      return;
    }

    clearIntroState();
    if (typeof afterFinish === 'function') afterFinish();
  }

  function showNextIntroScene() {
    if (introFinishing) return;

    if (introSceneIndex >= INTRO_SCENES.length - 1) {
      finishIntro({ withBlackout: true });
      return;
    }

    if (introTransitionTimer) window.clearTimeout(introTransitionTimer);

    const previousSlot = introSlots[introActiveSlot];
    introSceneIndex += 1;
    introActiveSlot = introActiveSlot === 0 ? 1 : 0;

    const nextSlot = introSlots[introActiveSlot];
    setIntroSlotScene(nextSlot, INTRO_SCENES[introSceneIndex], introSceneIndex);
    setIntroLayerOffsets(nextSlot, INTRO_SCENES[introSceneIndex], 0);

    nextSlot?.classList.remove('is-leaving');
    nextSlot?.classList.add('is-active');
    previousSlot?.classList.remove('is-active');
    previousSlot?.classList.add('is-leaving');
    introTransitionTimer = window.setTimeout(() => {
      previousSlot?.classList.remove('is-leaving');
    }, INTRO_TRANSITION_DURATION);

    introStartedAt = performance.now();
    updateIntroProgress(introSceneIndex);
    syncIntroSoundForScene(introSceneIndex);
    introTimer = window.setTimeout(showNextIntroScene, INTRO_SCENE_DURATION);
  }

  function continueStartFlow() {
    characters = loadCharacters();
    selectedCharacterId = getSelectedCharacterId() || characters[0]?.id || null;
    if (characters.length > 0) renderSelect();
    else {
      createReturnScreen = 'home';
      renderCreate();
    }
  }

  function startFlow() {
    characters = loadCharacters();
    selectedCharacterId = getSelectedCharacterId() || characters[0]?.id || null;

    if (characters.length > 0) {
      renderSelect();
      return;
    }

    createReturnScreen = 'home';
    renderCreate();
  }

  function renderIntro(afterFinish = continueStartFlow) {
    disposeCharacterPreview();
    stopOverworldMusic();
    clearIntroState();
    introAfterFinish = afterFinish;
    showRoot('intro', null);
    menuRoot.innerHTML = `
      <section class="menu-intro-screen" aria-label="Introducao">
        <div class="menu-intro-stage" aria-live="off">
          <figure class="menu-intro-scene is-active" data-intro-scene>
            <div class="menu-intro-layer menu-intro-layer--back"></div>
            <div class="menu-intro-layer menu-intro-layer--middle"></div>
            <div class="menu-intro-layer menu-intro-layer--front"></div>
          </figure>
          <figure class="menu-intro-scene" data-intro-scene>
            <div class="menu-intro-layer menu-intro-layer--back"></div>
            <div class="menu-intro-layer menu-intro-layer--middle"></div>
            <div class="menu-intro-layer menu-intro-layer--front"></div>
          </figure>
        </div>
        <div class="menu-intro-shimmer" aria-hidden="true"></div>
        <div class="menu-intro-controls">
          <button class="menu-secondary-button menu-intro-skip" type="button" data-menu-action="skip-intro">Pular</button>
        </div>
        <div class="menu-intro-progress" aria-hidden="true">
          ${INTRO_SCENES.map((_, index) => `<span class="menu-intro-progress-dot${index === 0 ? ' is-active' : ''}" data-intro-progress-dot></span>`).join('')}
        </div>
      </section>
    `;

    introSlots = Array.from(menuRoot.querySelectorAll('[data-intro-scene]'));
    introSceneIndex = 0;
    introActiveSlot = 0;
    introStartedAt = performance.now();
    preloadIntroScenes();
    preloadIntroSounds();
    playIntroMusic();
    setIntroSlotScene(introSlots[0], INTRO_SCENES[0], 0);
    setIntroLayerOffsets(introSlots[0], INTRO_SCENES[0], 0);
    syncIntroSoundForScene(0);
    introAnimationFrame = window.requestAnimationFrame(runIntroCamera);
    introTimer = window.setTimeout(showNextIntroScene, INTRO_SCENE_DURATION);
  }

  function renderHome() {
    disposeCharacterPreview();
    stopOverworldMusic();
    showRoot('home', MENU_ASSETS.home);
    menuRoot.innerHTML = `
      <section class="menu-home-panel menu-glass" aria-label="Menu principal">
        <img class="menu-logo" src="${MENU_ASSETS.logo}" alt="Logo do jogo">
        <button class="menu-primary-button" type="button" data-menu-action="start-flow">Jogar</button>
      </section>
    `;
  }

  function renderSelect() {
    disposeCharacterPreview();
    characters = loadCharacters();
    if (characters.length === 0) {
      renderCreate();
      return;
    }

    if (!characters.some((character) => character.id === selectedCharacterId)) {
      selectedCharacterId = characters[0].id;
    }

    const current = selectedCharacter();
    const createDisabled = characters.length >= MAX_CHARACTERS ? ' disabled' : '';

    showRoot('select', MENU_ASSETS.select);
    menuRoot.innerHTML = `
      <section class="menu-screen menu-screen--select">
        <aside class="menu-panel menu-glass">
          <div class="menu-panel-heading">
            <span>Meus personagens</span>
            <strong>${characters.length}/${MAX_CHARACTERS}</strong>
          </div>
          <div class="menu-character-list">
            ${characters.map((character) => characterRow(character, current.id)).join('')}
          </div>
          <div class="menu-actions">
            <button class="menu-secondary-button" type="button" data-menu-action="show-create"${createDisabled}>Criar novo personagem</button>
            <button class="menu-primary-button" type="button" data-menu-action="play-selected">Jogar</button>
          </div>
        </aside>
        <main class="menu-character-stage" style="--character-color:${escapeHtml(current.color)}">
          <div class="menu-character-nameplate menu-glass">
            <strong>${escapeHtml(current.name)}</strong>
            <span>${escapeHtml(current.typeLabel)}</span>
          </div>
          <div class="menu-character-preview" data-menu-character-preview aria-label="${escapeHtml(current.typeLabel)}"></div>
        </main>
      </section>
    `;
    mountCharacterPreview(current);
  }

  function renderCreate() {
    disposeCharacterPreview();
    const activeType = getCharacterType(activeTypeId);
    nameDraft = sanitizeCharacterName(nameDraft, CHARACTER_NAME_MAX_LENGTH);
    const paletteDraft = ensurePaletteDraft(activeType.id);
    const paletteControls = getPaletteSlotControls(activeType.id);
    const hasNamedPaletteControls = paletteControls.some((control) => control.label);
    const selectedSlotId = activePaletteSlotId(activeType.id);
    const selectedColor = paletteDraft[selectedSlotId];
    const palette = serializePaletteDraft(activeType.id, paletteDraft);
    const accentColor = characterAccentColor(activeType.id, palette);
    showRoot('create', MENU_ASSETS.create);
    menuRoot.innerHTML = `
      <section class="menu-screen menu-screen--create">
        <aside class="menu-panel menu-glass">
          <div class="menu-panel-heading">
            <span>Tipo</span>
            <strong>${escapeHtml(activeType.label)}</strong>
          </div>
          <div class="menu-type-list">
            ${CHARACTER_TYPES.map((type) => typeButton(type, activeType.id)).join('')}
          </div>
        </aside>
        <main class="menu-create-stage" style="--character-color:${escapeHtml(accentColor)}">
          <div class="menu-character-nameplate menu-glass">
            <strong>${escapeHtml(activeType.label)}</strong>
            <span>${escapeHtml(activeType.summary)}</span>
          </div>
          <div class="menu-character-preview" data-menu-character-preview aria-label="${escapeHtml(activeType.label)}"></div>
          <form class="menu-create-form" data-character-form>
            <input class="menu-name-input" name="characterName" value="${escapeHtml(nameDraft)}" maxlength="${CHARACTER_NAME_MAX_LENGTH}" pattern="${CHARACTER_NAME_PATTERN}" required autocomplete="off" spellcheck="false" placeholder="Nome do personagem" title="Use apenas letras e números, sem espaços.">
            <div class="menu-create-actions">
              <button class="menu-secondary-button" type="button" data-menu-action="back-from-create">Voltar</button>
              <button class="menu-primary-button" type="submit" data-menu-action="create-and-play">Jogar</button>
            </div>
          </form>
        </main>
        <aside class="menu-panel menu-glass">
          <div class="menu-panel-heading">
            <span>Paleta</span>
            <span class="menu-panel-heading-tools">
              <strong>Cor</strong>
              <button class="menu-icon-button" type="button" data-menu-action="reset-palette" title="Restaurar cores padrão" aria-label="Restaurar cores padrão">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 3v6h6"></path></svg>
              </button>
            </span>
          </div>
          <div class="menu-palette-list${hasNamedPaletteControls ? ' menu-palette-list--named' : ''}">
            ${paletteControls.map((control, index) => paletteSlotControl(control, paletteDraft[control.slots[0]], selectedSlotId, index)).join('')}
          </div>
          ${hasNamedPaletteControls ? '' : `<label class="menu-palette-code">
            <span>HEX</span>
            <input class="menu-hex-input" data-palette-hex-input data-slot-id="${escapeHtml(selectedSlotId)}" value="${escapeHtml(selectedColor)}" maxlength="7" spellcheck="false" autocomplete="off">
          </label>`}
        </aside>
      </section>
    `;
    mountCharacterPreview({ type: activeType.id, image: activeType.image, palette });
    const nameInput = menuRoot.querySelector('[name="characterName"]');
    if (nameInput && !nameDraft) {
      nameInput.setCustomValidity('Informe um nome com letras e números, sem espaços.');
    }
  }

  function applyCharacter(character) {
    if (!state?.game?.player) return;

    const normalized = normalizeCharacter(character);
    state.game.player.name = normalized.name;
    state.game.player.characterId = normalized.id;
    state.game.player.characterType = normalized.type;
    state.game.player.characterColor = normalized.color;
    state.game.player.characterPalette = normalized.palette;
    state.game.player.characterPortrait = normalized.image;
    state.game.player.characterLabel = normalized.typeLabel;
    applyCharacterProgressToPlayer(state.game.player, normalized.progress);
    state.game.apRemaining = Math.min(state.game.player.apMax, state.game.apRemaining ?? state.game.player.apMax);
    state.game.speedRemaining = Math.min(state.game.player.speedBase, state.game.speedRemaining ?? state.game.player.speedBase);
    state.game.selectedCharacter = {
      id: normalized.id,
      name: normalized.name,
      type: normalized.type,
      color: normalized.color,
      palette: normalized.palette,
    };
    state.game.banner = {
      title: normalized.name,
      subtitle: 'Entrando no mundo aberto.',
      until: performance.now() + 1400,
      cardKey: 'player',
      accent: normalized.color,
    };
    actions?.setEvent?.(`Entrou no mundo com ${normalized.name}.`);
    playOverworldMusic();
  }

  function playCharacter(character, options = {}) {
    const normalized = normalizeCharacter(character);
    setSelectedCharacterId(normalized.id);
    if (options.startNurseryIntro) {
      actions?.startOverworldAtMap?.(NURSERY_INTRO_MAP_ID);
    }
    applyCharacter(normalized);
    if (options.startNurseryIntro) {
      actions?.startNurseryCutscene?.();
    }
    hideRoot();
  }

  function renderDebugEntry() {
    characters = loadCharacters();
    if (characters.length > 0) {
      selectedCharacterId = characters[0].id;
      playCharacter(characters[0], {
        startNurseryIntro: state.debugSettings?.initialDialogue === true,
      });
      return;
    }

    createReturnScreen = 'home';
    renderCreate();
  }

  function createAndPlay() {
    if (characters.length >= MAX_CHARACTERS) return;
    const shouldPlayIntro = characters.length === 0;

    const activeType = getCharacterType(activeTypeId);
    const input = menuRoot.querySelector('[name="characterName"]');
    const typedName = syncNameInput(input);
    if (!typedName) {
      input?.focus();
      input?.reportValidity?.();
      return;
    }

    const character = normalizeCharacter({
      id: createCharacterId(),
      name: typedName,
      type: activeType.id,
      color: activeAccentColor(activeType.id),
      palette: activePalette(activeType.id),
      createdAt: Date.now(),
    }, characters.length);

    characters = [...characters, character].slice(0, MAX_CHARACTERS);
    selectedCharacterId = character.id;
    saveCharacters(characters);

    if (shouldPlayIntro) {
      renderIntro(() => playCharacter(character, { startNurseryIntro: true }));
      return;
    }

    playCharacter(character, { startNurseryIntro: true });
  }

  menuRoot.addEventListener('click', (event) => {
    const paletteSlot = event.target.closest('[data-palette-slot-id]');
    if (paletteSlot && menuRoot.contains(paletteSlot)) {
      activePaletteSlotByType[activeTypeId] = paletteSlot.dataset.paletteSlotId;
      syncActivePaletteSlotUi();
    }

    const control = event.target.closest('[data-menu-action]');
    if (!control || !menuRoot.contains(control)) return;

    const action = control.dataset.menuAction;
    if (action === 'start-flow') {
      startFlow();
      return;
    }

    if (action === 'skip-intro') {
      finishIntro();
      return;
    }

    if (action === 'select-character') {
      selectedCharacterId = control.dataset.characterId;
      renderSelect();
      return;
    }

    if (action === 'show-create') {
      createReturnScreen = 'select';
      renderCreate();
      return;
    }

    if (action === 'back-from-create') {
      syncNameInput(menuRoot.querySelector('[name="characterName"]'));
      characters = loadCharacters();
      if (createReturnScreen === 'select' && characters.length > 0) renderSelect();
      else renderHome();
      return;
    }

    if (action === 'reset-palette') {
      syncNameInput(menuRoot.querySelector('[name="characterName"]'));
      resetActivePalette();
      return;
    }

    if (action === 'play-selected') {
      const current = selectedCharacter();
      if (current) playCharacter(current);
      return;
    }

    if (action === 'choose-type') {
      syncNameInput(menuRoot.querySelector('[name="characterName"]'));
      activeTypeId = control.dataset.typeId || activeTypeId;
      renderCreate();
      return;
    }

    if (action === 'delete-character') {
      const charId = control.dataset.characterId;
      const charToDelete = characters.find((c) => c.id === charId);
      if (!charToDelete) return;

      requestDeleteCharacter(charToDelete);
      return;
    }

    if (action === 'dialog-cancel') {
      closeMenuDialog();
      return;
    }

    if (action === 'dialog-confirm') {
      confirmMenuDialog();
    }
  }, eventOptions);

  menuRoot.addEventListener('keydown', (event) => {
    if (!menuDialog || event.key !== 'Escape') return;
    event.preventDefault();
    closeMenuDialog();
  }, eventOptions);

  menuRoot.addEventListener('pointerover', (event) => {
    const paletteSlot = event.target.closest('[data-palette-slot-id]');
    if (!paletteSlot || !menuRoot.contains(paletteSlot)) return;
    if (paletteSlot.contains(event.relatedTarget)) return;

    flashPaletteSlot(paletteSlot.dataset.paletteSlotId);
  }, eventOptions);

  menuRoot.addEventListener('pointermove', (event) => {
    if (!menuRoot.classList.contains('menu-root--intro')) return;

    const rect = menuRoot.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    introPointer = {
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5,
    };
  }, eventOptions);

  menuRoot.addEventListener('focusin', (event) => {
    const paletteSlot = event.target.closest?.('[data-palette-slot-id]');
    if (!paletteSlot || !menuRoot.contains(paletteSlot)) return;

    flashPaletteSlot(paletteSlot.dataset.paletteSlotId);
  }, eventOptions);

  menuRoot.addEventListener('input', (event) => {
    if (event.target?.matches?.('[data-palette-color-input]')) {
      setPaletteSlotColor(event.target.dataset.slotId, event.target.value);
      return;
    }

    if (event.target?.matches?.('[data-palette-hex-input], [data-palette-inline-hex-input]')) {
      const slotId = event.target.dataset.slotId || activePaletteSlotId(activeTypeId);
      const normalized = normalizeHexColor(event.target.value);

      if (!normalized) {
        event.target.classList.add('is-invalid');
        return;
      }

      setPaletteSlotColor(slotId, normalized);
      return;
    }

    if (event.target?.name === 'characterName') {
      syncNameInput(event.target);
    }
  }, eventOptions);

  menuRoot.addEventListener('submit', (event) => {
    if (!event.target.matches('[data-character-form]')) return;
    event.preventDefault();
    createAndPlay();
  }, eventOptions);

  return {
    show: renderHome,
    showDebugEntry: renderDebugEntry,
    showCharacterSelect: renderSelect,
    showCharacterCreate: renderCreate,
    flashPaletteSlot,
    dispose() {
      eventController.abort();
      clearIntroState();
      disposeCharacterPreview();
    },
  };
}
