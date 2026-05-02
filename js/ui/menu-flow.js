import { mountMenuCharacterPreview } from './menu-character-viewer.js';

const MENU_ASSETS = {
  home: '/assets/ui/menu/capa.png',
  select: '/assets/ui/menu/capa0.png',
  create: '/assets/ui/menu/capa2.png',
  logo: '/assets/ui/menu/logo.png',
};

const CHARACTERS_KEY = 'one-rpg-characters-v1';
const SELECTED_CHARACTER_KEY = 'one-rpg-selected-character-v1';
const MAX_CHARACTERS = 3;

export const CHARACTER_TYPES = [
  {
    id: 'mage',
    label: 'Mago',
    image: '/assets/characters/mage.png',
    summary: 'Arcano equilibrado',
  },
  {
    id: 'barbarian',
    label: 'Barbaro',
    image: '/assets/characters/barbarian.png',
    summary: 'Forca bruta',
  },
  {
    id: 'knight',
    label: 'Cavaleiro',
    image: '/assets/characters/knight.png',
    summary: 'Defesa firme',
  },
  {
    id: 'ranger',
    label: 'Patrulheiro',
    image: '/assets/characters/ranger.png',
    summary: 'Ataque a distancia',
  },
  {
    id: 'rogue',
    label: 'Ladino',
    image: '/assets/characters/rogue.png',
    summary: 'Agil e preciso',
  },
];

const COLOR_OPTIONS = [
  '#d39b32',
  '#5f8f54',
  '#b94735',
  '#9a7a32',
  '#c9bea5',
  '#6f6342',
];

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

function getCharacterType(typeId) {
  return CHARACTER_TYPES.find((type) => type.id === typeId) || CHARACTER_TYPES[0];
}

function normalizeColor(color) {
  return COLOR_OPTIONS.includes(color) ? color : COLOR_OPTIONS[0];
}

function normalizeCharacter(character, index = 0) {
  const type = getCharacterType(character?.type);
  const name = typeof character?.name === 'string' && character.name.trim()
    ? character.name.trim().slice(0, 24)
    : `${type.label} ${index + 1}`;

  return {
    id: typeof character?.id === 'string' && character.id
      ? character.id
      : `character-${Date.now()}-${index}`,
    name,
    type: type.id,
    typeLabel: type.label,
    color: normalizeColor(character?.color),
    image: type.image,
    createdAt: Number.isFinite(character?.createdAt) ? character.createdAt : Date.now(),
  };
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

function colorButton(color, activeColor) {
  const active = color === activeColor ? ' is-selected' : '';
  return `
    <button class="menu-color-button${active}" type="button" data-menu-action="choose-color" data-color="${escapeHtml(color)}" style="--swatch:${escapeHtml(color)}">
      <span></span>
    </button>
  `;
}

function characterRow(character, selectedId) {
  const active = character.id === selectedId ? ' is-selected' : '';
  return `
    <button class="menu-character-row${active}" type="button" data-menu-action="select-character" data-character-id="${escapeHtml(character.id)}">
      <img src="${escapeHtml(character.image)}" alt="" class="menu-character-thumb">
      <span class="menu-character-copy">
        <strong>${escapeHtml(character.name)}</strong>
        <small>${escapeHtml(character.typeLabel)}</small>
      </span>
      <span class="menu-character-color" style="--character-color:${escapeHtml(character.color)}"></span>
    </button>
  `;
}

export function createMenuFlow({ state, actions, root = null } = {}) {
  const menuRoot = root || document.getElementById('menu-root') || document.createElement('div');
  if (!menuRoot.id) menuRoot.id = 'menu-root';
  if (!menuRoot.parentElement) document.body.append(menuRoot);

  let characters = loadCharacters();
  let selectedCharacterId = getSelectedCharacterId() || characters[0]?.id || null;
  let activeTypeId = CHARACTER_TYPES[0].id;
  let activeColor = COLOR_OPTIONS[0];
  let nameDraft = '';
  let activeCharacterPreview = null;

  function selectedCharacter() {
    return characters.find((character) => character.id === selectedCharacterId) || characters[0] || null;
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
        <main class="menu-create-stage" style="--character-color:${escapeHtml(activeColor)}">
          <div class="menu-character-nameplate menu-glass">
            <strong>${escapeHtml(activeType.label)}</strong>
            <span>${escapeHtml(activeType.summary)}</span>
          </div>
          <div class="menu-character-preview" data-menu-character-preview aria-label="${escapeHtml(activeType.label)}"></div>
          <form class="menu-create-form" data-character-form>
            <input class="menu-name-input" name="characterName" value="${escapeHtml(nameDraft)}" maxlength="24" autocomplete="off" placeholder="Nome do personagem">
            <button class="menu-primary-button" type="submit" data-menu-action="create-and-play">Jogar</button>
          </form>
        </main>
        <aside class="menu-panel menu-glass">
          <div class="menu-panel-heading">
            <span>Paleta</span>
            <strong>Cor</strong>
          </div>
          <div class="menu-color-list">
            ${COLOR_OPTIONS.map((color) => colorButton(color, activeColor)).join('')}
          </div>
        </aside>
      </section>
    `;
    mountCharacterPreview({ type: activeType.id, image: activeType.image });
  }

  function applyCharacter(character) {
    if (!state?.game?.player) return;

    const normalized = normalizeCharacter(character);
    state.game.player.name = normalized.name;
    state.game.player.characterId = normalized.id;
    state.game.player.characterType = normalized.type;
    state.game.player.characterColor = normalized.color;
    state.game.player.characterPortrait = normalized.image;
    state.game.player.characterLabel = normalized.typeLabel;
    state.game.selectedCharacter = {
      id: normalized.id,
      name: normalized.name,
      type: normalized.type,
      color: normalized.color,
    };
    state.game.banner = {
      title: normalized.name,
      subtitle: 'Entrando no mundo aberto.',
      until: performance.now() + 1400,
      cardKey: 'player',
      accent: normalized.color,
    };
    actions?.setEvent?.(`Entrou no mundo com ${normalized.name}.`);
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
    const typedName = input?.value?.trim() || nameDraft.trim();
    const character = normalizeCharacter({
      id: createCharacterId(),
      name: typedName || `${activeType.label} ${characters.length + 1}`,
      type: activeType.id,
      color: activeColor,
      createdAt: Date.now(),
    }, characters.length);

    characters = [...characters, character].slice(0, MAX_CHARACTERS);
    selectedCharacterId = character.id;
    saveCharacters(characters);
    playCharacter(character);
  }

  menuRoot.addEventListener('click', (event) => {
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

    if (action === 'play-selected') {
      const current = selectedCharacter();
      if (current) playCharacter(current);
      return;
    }

    if (action === 'choose-type') {
      nameDraft = menuRoot.querySelector('[name="characterName"]')?.value || nameDraft;
      activeTypeId = control.dataset.typeId || activeTypeId;
      renderCreate();
      return;
    }

    if (action === 'choose-color') {
      nameDraft = menuRoot.querySelector('[name="characterName"]')?.value || nameDraft;
      activeColor = normalizeColor(control.dataset.color);
      renderCreate();
    }
  });

  menuRoot.addEventListener('input', (event) => {
    if (event.target?.name === 'characterName') {
      nameDraft = event.target.value;
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
  };
}
