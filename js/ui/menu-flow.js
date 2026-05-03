import { mountMenuCharacterPreview } from './menu-character-viewer.js';
import { playOverworldMusic, stopOverworldMusic } from '../game/audio.js';
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

export { CHARACTER_TYPES };

const MENU_ASSETS = {
  home: '/assets/ui/menu/capa.png',
  select: '/assets/ui/menu/capa0.png',
  create: '/assets/ui/menu/capa2.png',
  logo: '/assets/ui/menu/logo.png',
};

const CHARACTERS_KEY = 'one-rpg-characters-v1';
const SELECTED_CHARACTER_KEY = 'one-rpg-selected-character-v1';
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

function characterRow(character, selectedId) {
  const active = character.id === selectedId ? ' is-selected' : '';
  return `
    <div class="menu-character-row${active}" data-menu-action="select-character" data-character-id="${escapeHtml(character.id)}">
      <img src="${escapeHtml(character.image)}" alt="" class="menu-character-thumb">
      <span class="menu-character-copy">
        <strong>${escapeHtml(character.name)}</strong>
        <small>${escapeHtml(character.typeLabel)}</small>
      </span>
      <span class="menu-character-color" style="--character-color:${escapeHtml(character.color)}"></span>
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

  let characters = loadCharacters();
  let selectedCharacterId = getSelectedCharacterId() || characters[0]?.id || null;
  let activeTypeId = CHARACTER_TYPES[0].id;
  const paletteDraftByType = {};
  const activePaletteSlotByType = {};
  let nameDraft = '';
  let activeCharacterPreview = null;

  function selectedCharacter() {
    return characters.find((character) => character.id === selectedCharacterId) || characters[0] || null;
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
    menuRoot.style.backgroundImage = `url("${image}")`;
  }

  function disposeCharacterPreview() {
    activeCharacterPreview?.dispose();
    activeCharacterPreview = null;
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
    menuRoot.hidden = false;
    menuRoot.className = `menu-root menu-root--${screenName}`;
    document.body.classList.add('menu-open');
    setBackground(image);
  }

  function hideRoot() {
    disposeCharacterPreview();
    menuRoot.hidden = true;
    menuRoot.className = 'menu-root';
    document.body.classList.remove('menu-open');
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
            <button class="menu-primary-button" type="submit" data-menu-action="create-and-play">Jogar</button>
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

  function playCharacter(character) {
    const normalized = normalizeCharacter(character);
    setSelectedCharacterId(normalized.id);
    applyCharacter(normalized);
    hideRoot();
  }

  function createAndPlay() {
    if (characters.length >= MAX_CHARACTERS) return;

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
    playCharacter(character);
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
      characters = loadCharacters();
      selectedCharacterId = getSelectedCharacterId() || characters[0]?.id || null;
      if (characters.length > 0) renderSelect();
      else renderCreate();
      return;
    }

    if (action === 'select-character') {
      selectedCharacterId = control.dataset.characterId;
      renderSelect();
      return;
    }

    if (action === 'show-create') {
      renderCreate();
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

      if (window.confirm(`Tem certeza que deseja excluir o personagem "${charToDelete.name}"?`)) {
        characters = characters.filter((c) => c.id !== charId);
        saveCharacters(characters);
        if (selectedCharacterId === charId) {
          selectedCharacterId = characters[0]?.id || null;
          setSelectedCharacterId(selectedCharacterId);
        }
        renderSelect();
      }
    }
  });

  menuRoot.addEventListener('pointerover', (event) => {
    const paletteSlot = event.target.closest('[data-palette-slot-id]');
    if (!paletteSlot || !menuRoot.contains(paletteSlot)) return;
    if (paletteSlot.contains(event.relatedTarget)) return;

    flashPaletteSlot(paletteSlot.dataset.paletteSlotId);
  });

  menuRoot.addEventListener('focusin', (event) => {
    const paletteSlot = event.target.closest?.('[data-palette-slot-id]');
    if (!paletteSlot || !menuRoot.contains(paletteSlot)) return;

    flashPaletteSlot(paletteSlot.dataset.paletteSlotId);
  });

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
  });

  menuRoot.addEventListener('submit', (event) => {
    if (!event.target.matches('[data-character-form]')) return;
    event.preventDefault();
    createAndPlay();
  });

  return {
    show: renderHome,
    showCharacterSelect: renderSelect,
    showCharacterCreate: renderCreate,
    flashPaletteSlot,
  };
}
