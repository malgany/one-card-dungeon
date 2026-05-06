import {
  ATTACK_PATTERNS,
  ACTION_RULES,
  BOARD_SIZE,
  CHARACTERISTIC_DEFINITIONS,
  DEBUG_CONFIG,
  GAME_MODES,
  LEVELS,
  PHASES,
  STAT_META,
  WORLD_MAPS,
  WORLD_OBJECT_TYPES,
  XP_RULES,
} from '../config/game-data.js';
import { levelWallsSet, posKey, samePos } from '../game/board-logic.js';
import { ensureOverworldMapState } from '../game/game-factories.js';
import {
  getCurrentWorldBounds,
  getCurrentWorldMap,
  getCurrentWorldMapState,
  getCurrentWorldObjects,
} from '../game/world-state.js';
import { MODEL_LIBRARY } from '../config/world/model-library.js';
import { TEXTURE_LIBRARY } from '../config/world/texture-library.js';
import {
  DEFAULT_MAP_COLOR_MODELS,
  DEFAULT_MAP_COLOR_VALUES,
  getMapColorValuesForMap,
  normalizeMapColorValues,
} from '../config/map-colors.js';
import { createDrawPrimitives } from './draw-primitives.js';
import { createThreeBoardView, HERO_DEBUG_ANIMATION_OPTIONS } from './three-board-view.js';

const UI_THEME = {
  bg0: '#070807',
  bg1: '#0d0f0b',
  bg2: '#14150f',
  surface0: '#171912',
  surface1: '#202219',
  surface2: '#29291f',
  border0: '#4a4638',
  border1: '#6f6342',
  accent: '#d39b32',
  accentDark: '#8f6724',
  success: '#5f8f54',
  successDark: '#3f6f45',
  danger: '#b94735',
  dangerDark: '#7b2d23',
  text: '#f2ead7',
  textMuted: '#c9bea5',
  textDim: '#8f8773',
  overlay: 'rgba(7,8,7,0.94)',
};
const SPELL_ELEMENT_META = {
  neutral: { label: 'Neutro', color: UI_THEME.accent },
  earth: { label: 'Terra', color: '#9b6a3f' },
  fire: { label: 'Fogo', color: '#d9572b' },
  air: { label: 'Ar', color: '#6cab4f' },
  water: { label: 'Água', color: '#3b8fd9' },
};
const TEXTURE_OUTSIDE_BOARD_MULTIPLIER = 2;
const DEBUG_PANEL_MARGIN = 12;
const DEBUG_PANEL_MINIMIZED_Y = 12;
const DEBUG_PANEL_OPEN_TAB_OVERHANG = 28;
const DEBUG_CUBE_HEIGHT = 0.62;
const DEBUG_COLOR_FIELDS = [
  { key: 'water1', group: 'Água', label: 'Água 1', description: 'cor principal', codeUse: 'waterMaterial.color e scene.background, água base e fundo do mapa' },
  { key: 'water2', group: 'Água', label: 'Água 2', description: 'faixa grossa', codeUse: 'waterDarkBandMaterial.color, contorno azul mais escuro na superfície' },
  { key: 'water3', group: 'Água', label: 'Água 3', description: 'faixa perto da borda', codeUse: 'waterLightBandMaterial.color, contorno claro junto ao barranco' },
  { key: 'top1', group: 'Cor do topo', label: 'Cor 1', description: 'base', codeUse: 'paintProceduralGrassTexture, preenchimento principal do topo do chao/cubo' },
  { key: 'top2', group: 'Cor do topo', label: 'Cor 2', description: 'manchas claras', codeUse: 'paintProceduralGrassTexture, manchas grandes claras do topo' },
  { key: 'top3', group: 'Cor do topo', label: 'Cor 3', description: 'manchas escuras', codeUse: 'paintProceduralGrassTexture, manchas grandes escuras do topo' },
  { key: 'top4', group: 'Cor do topo', label: 'Cor 4', description: 'detalhes claros', codeUse: 'paintProceduralGrassTexture, pontinhos e raminhos claros do topo' },
  { key: 'top5', group: 'Cor do topo', label: 'Cor 5', description: 'detalhes escuros', codeUse: 'paintProceduralGrassTexture, pontinhos escuros do topo' },
  { key: 'side1', group: 'Cor da lateral', label: 'Cor 1', description: 'base', codeUse: 'paintProceduralDirtSideTexture, preenchimento principal da lateral de terra' },
  { key: 'side2', group: 'Cor da lateral', label: 'Cor 2', description: 'blocos medios', codeUse: 'paintProceduralDirtSideTexture, blocos medios da lateral' },
  { key: 'side3', group: 'Cor da lateral', label: 'Cor 3', description: 'blocos escuros', codeUse: 'paintProceduralDirtSideTexture, blocos escuros da lateral' },
  { key: 'side4', group: 'Cor da lateral', label: 'Cor 4', description: 'blocos claros', codeUse: 'paintProceduralDirtSideTexture, blocos claros da lateral' },
  { key: 'side5', group: 'Cor da lateral', label: 'Cor 5', description: 'pontos escuros', codeUse: 'paintProceduralDirtSideTexture, pontos pequenos escuros da lateral' },
];
const DEBUG_COLOR_DEFAULTS = DEFAULT_MAP_COLOR_VALUES;
const DEBUG_COLOR_MODEL_STORAGE_KEY = 'one-rpg-debug-color-models';
const DEBUG_HERO_NUMBER_FIELDS = [
  { key: 'level', label: 'Nivel', min: 1 },
  { key: 'health', label: 'Vida atual', min: 0 },
  { key: 'maxHealth', label: 'Vida max', min: 1 },
  { key: 'apMax', label: 'Acao max', min: 0 },
  { key: 'apRemaining', label: 'Acao atual', min: 0 },
  { key: 'speedBase', label: 'Mov. base', min: 0 },
  { key: 'speedRemaining', label: 'Mov. atual', min: 0 },
  { key: 'defenseBase', label: 'Defesa', min: 0 },
  { key: 'rangeBase', label: 'Alcance', min: 1 },
  { key: 'characteristicPoints', label: 'Pontos livres', min: 0 },
  ...Object.values(CHARACTERISTIC_DEFINITIONS).map((definition) => ({
    key: `characteristic:${definition.key}`,
    label: definition.label,
    min: 0,
  })),
];

export function getAnimationEndTime(anim) {
  const startTime = Number.isFinite(anim.startTime) ? anim.startTime : 0;

  if (anim.type === 'movement') {
    if (Number.isFinite(anim.totalDuration)) {
      return startTime + Math.max(0, anim.totalDuration);
    }

    const pathSteps = Math.max(0, (anim.path?.length || 1) - 1);
    const durationPerTile = Number.isFinite(anim.durationPerTile) ? anim.durationPerTile : 0;
    return startTime + pathSteps * durationPerTile;
  }

  if (
    anim.type === 'floatingText' ||
    anim.type === 'bumpAttack' ||
    anim.type === 'damageShake' ||
    anim.type === 'modelAction'
  ) {
    return startTime + Math.max(0, anim.duration || 0);
  }

  return startTime;
}

function isAnimationActive(anim, now) {
  return now < getAnimationEndTime(anim);
}

export function createRenderer({ canvas, ctx, cardImages, state, actions, layout, onExitToMainMenu = null }) {
  const draw = createDrawPrimitives({ ctx, state, cardImages });
  const threeBoard = createThreeBoardView({ state });
  let renderFrameId = null;
  let disposed = false;
  const debugHeroOverlay = document.createElement('div');
  const debugHeroTitle = document.createElement('strong');
  const debugHeroHelp = document.createElement('p');
  const debugHeroField = document.createElement('label');
  const debugHeroFieldLabel = document.createElement('span');
  const debugHeroSelect = document.createElement('select');
  const debugHeroStatus = document.createElement('p');
  const debugHeroConfigTitle = document.createElement('strong');
  const debugHeroConfigGrid = document.createElement('div');
  const debugHeroApplyButton = document.createElement('button');
  const debugHeroInputs = new Map();
  const debugColorInputs = new Map();
  const debugColorHexInputs = new Map();

  debugHeroOverlay.className = 'debug-hero-overlay';
  debugHeroOverlay.hidden = true;
  debugHeroTitle.className = 'debug-hero-title';
  debugHeroTitle.textContent = 'Hero';
  debugHeroHelp.className = 'debug-hero-help';
  debugHeroHelp.textContent = 'Idle, walk e run ficam em loop. Ataques, mortes e acoes tocam 1x e param no fim.';
  debugHeroField.className = 'debug-hero-field';
  debugHeroFieldLabel.textContent = 'Animacao';
  debugHeroSelect.className = 'debug-hero-select';
  debugHeroSelect.setAttribute('aria-label', 'Animacao do Hero');
  debugHeroStatus.className = 'debug-hero-status';
  debugHeroConfigTitle.className = 'debug-hero-section-title';
  debugHeroConfigTitle.textContent = 'Configuracao';
  debugHeroConfigGrid.className = 'debug-hero-config-grid';
  debugHeroApplyButton.className = 'debug-hero-apply';
  debugHeroApplyButton.type = 'button';
  debugHeroApplyButton.textContent = 'Aplicar hero';

  DEBUG_HERO_NUMBER_FIELDS.forEach((field) => {
    const label = document.createElement('label');
    const labelText = document.createElement('span');
    const input = document.createElement('input');
    label.className = 'debug-hero-config-field';
    labelText.textContent = field.label;
    input.type = 'number';
    input.inputMode = 'numeric';
    input.step = '1';
    input.min = String(field.min);
    input.dataset.heroField = field.key;
    input.setAttribute('aria-label', field.label);
    label.append(labelText, input);
    debugHeroConfigGrid.append(label);
    debugHeroInputs.set(field.key, input);
  });

  debugHeroField.append(debugHeroFieldLabel, debugHeroSelect);
  debugHeroOverlay.append(
    debugHeroTitle,
    debugHeroHelp,
    debugHeroField,
    debugHeroStatus,
    debugHeroConfigTitle,
    debugHeroConfigGrid,
    debugHeroApplyButton,
  );
  document.body.append(debugHeroOverlay);

  DEBUG_COLOR_FIELDS.forEach((field) => {
    const input = document.createElement('input');
    input.type = 'color';
    input.setAttribute('aria-label', `${field.group} ${field.label}`);
    input.style.position = 'fixed';
    input.style.display = 'none';
    input.style.zIndex = '40';
    input.style.width = '24px';
    input.style.height = '24px';
    input.style.padding = '0';
    input.style.border = '0';
    input.style.opacity = '0.01';
    input.style.cursor = 'pointer';
    input.addEventListener('input', () => {
      const debugColors = ensureDebugColors();
      debugColors.values[field.key] = normalizeDebugHexColor(input.value, debugColors.values[field.key]);
    });
    debugColorInputs.set(field.key, input);
    document.body.append(input);

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.inputMode = 'text';
    hexInput.spellcheck = false;
    hexInput.maxLength = 7;
    hexInput.setAttribute('aria-label', `Hex ${field.group} ${field.label}`);
    hexInput.style.position = 'fixed';
    hexInput.style.display = 'none';
    hexInput.style.zIndex = '41';
    hexInput.style.boxSizing = 'border-box';
    hexInput.style.height = '22px';
    hexInput.style.padding = '0 6px';
    hexInput.style.border = '1px solid rgba(111,99,66,0.7)';
    hexInput.style.borderRadius = '4px';
    hexInput.style.background = 'rgba(13,15,11,0.86)';
    hexInput.style.color = '#d39b32';
    hexInput.style.font = '900 11px Inter, sans-serif';
    hexInput.style.textAlign = 'right';
    hexInput.style.textTransform = 'uppercase';
    hexInput.style.outline = 'none';
    hexInput.addEventListener('input', () => {
      const parsed = parseDebugHexInput(hexInput.value);
      if (!parsed) return;
      const debugColors = ensureDebugColors();
      debugColors.values[field.key] = parsed;
    });
    hexInput.addEventListener('focus', () => {
      requestAnimationFrame(() => hexInput.select());
    });
    hexInput.addEventListener('pointerup', (event) => {
      event.preventDefault();
      hexInput.select();
    });
    hexInput.addEventListener('blur', () => {
      const debugColors = ensureDebugColors();
      hexInput.value = debugColors.values[field.key].toUpperCase();
    });
    hexInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') hexInput.blur();
    });
    debugColorHexInputs.set(field.key, hexInput);
    document.body.append(hexInput);
  });

  const autoHeroOption = document.createElement('option');
  autoHeroOption.value = 'auto';
  autoHeroOption.textContent = 'Auto (jogo)';
  debugHeroSelect.append(autoHeroOption);
  HERO_DEBUG_ANIMATION_OPTIONS.forEach((option) => {
    const element = document.createElement('option');
    element.value = option.id;
    element.textContent = `${option.label}${option.loop ? ' (loop)' : ' (1x)'}`;
    debugHeroSelect.append(element);
  });

  debugHeroSelect.addEventListener('change', () => {
    const heroDebug = ensureDebugHeroState();
    heroDebug.selectedAnimationId = debugHeroSelect.value === 'auto' ? null : debugHeroSelect.value;
  });

  function debugHeroNumberValue(key, fallback = 0) {
    const input = debugHeroInputs.get(key);
    const value = Number(input?.value);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
  }

  function updateDebugHeroFreePointsFromDraft() {
    const freeInput = debugHeroInputs.get('characteristicPoints');
    if (!freeInput || document.activeElement === freeInput) return;

    const level = Math.max(1, debugHeroNumberValue('level', 1));
    const earnedPoints = Math.max(0, level - 1) * XP_RULES.POINTS_PER_LEVEL;
    const spentPoints = Object.keys(CHARACTERISTIC_DEFINITIONS).reduce((sum, key) => {
      return sum + debugHeroNumberValue(`characteristic:${key}`, 0);
    }, 0);
    freeInput.value = String(Math.max(0, earnedPoints - spentPoints));
  }

  for (const input of debugHeroInputs.values()) {
    input.addEventListener('input', () => {
      updateDebugHeroFreePointsFromDraft();
    });
  }

  function readDebugHeroConfig() {
    const characteristics = {};
    for (const key of Object.keys(CHARACTERISTIC_DEFINITIONS)) {
      characteristics[key] = debugHeroNumberValue(`characteristic:${key}`, 0);
    }

    return {
      level: Math.max(1, debugHeroNumberValue('level', 1)),
      health: debugHeroNumberValue('health', 60),
      maxHealth: debugHeroNumberValue('maxHealth', 60),
      apMax: debugHeroNumberValue('apMax', ACTION_RULES.BASE_AP),
      apRemaining: debugHeroNumberValue('apRemaining', ACTION_RULES.BASE_AP),
      speedBase: debugHeroNumberValue('speedBase', 3),
      speedRemaining: debugHeroNumberValue('speedRemaining', 3),
      defenseBase: debugHeroNumberValue('defenseBase', 0),
      rangeBase: debugHeroNumberValue('rangeBase', 2),
      characteristicPoints: debugHeroNumberValue('characteristicPoints', 0),
      characteristics,
    };
  }

  debugHeroApplyButton.addEventListener('click', () => {
    actions.applyDebugHeroConfig?.(readDebugHeroConfig());
    const heroDebug = ensureDebugHeroState();
    heroDebug.lastAppliedAt = performance.now();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

  function ensureDebugHeroState() {
    if (!state.debugHero) state.debugHero = {};
    if (state.debugHero.selectedAnimationId === undefined) state.debugHero.selectedAnimationId = null;
    if (!Number.isFinite(state.debugHero.lastAppliedAt)) state.debugHero.lastAppliedAt = 0;
    return state.debugHero;
  }

  function ensureDebugCubes() {
    if (!state.debugCubes) state.debugCubes = {};
    const debugCubes = state.debugCubes;
    if (!Array.isArray(debugCubes.placements)) debugCubes.placements = [];
    if (debugCubes.enabled === undefined) debugCubes.enabled = false;
    if (debugCubes.selectedCubeId === undefined) debugCubes.selectedCubeId = null;
    if (!Number.isFinite(debugCubes.lastCopiedAt)) debugCubes.lastCopiedAt = 0;
    if (!Number.isFinite(debugCubes.listScroll)) debugCubes.listScroll = 0;
    return debugCubes;
  }

  function normalizeDebugHexColor(value, fallback = '#ffffff') {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
  }

  function parseDebugHexInput(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    const match = normalized.match(/^#?([0-9a-f]{6})$/);
    return match ? `#${match[1]}` : null;
  }

  function ensureDebugColors() {
    if (!state.debugColors) state.debugColors = {};
    const debugColors = state.debugColors;
    const mapId = currentEditorMapId();
    if (debugColors.activeMapId !== mapId) {
      const mapState = state.game.mode === GAME_MODES.OVERWORLD && mapId
        ? ensureOverworldMapState(state.game.overworld, mapId)
        : null;
      debugColors.values = normalizeMapColorValues(mapState?.debugColors?.values || getMapColorValuesForMap(mapId));
      debugColors.activeMapId = mapId;
      debugColors.applyStatus = null;
      debugColors.applyError = '';
    }
    if (!debugColors.values) debugColors.values = {};
    for (const field of DEBUG_COLOR_FIELDS) {
      debugColors.values[field.key] = normalizeDebugHexColor(debugColors.values[field.key], DEBUG_COLOR_DEFAULTS[field.key]);
    }
    if (!Number.isFinite(debugColors.lastCopiedAt)) debugColors.lastCopiedAt = 0;
    if (!Number.isFinite(debugColors.lastAppliedAt)) debugColors.lastAppliedAt = 0;
    if (!Number.isFinite(debugColors.scroll)) debugColors.scroll = 0;
    return debugColors;
  }

  function ensureDebugVisualSettingsState() {
    if (!state.debugVisualSettings) state.debugVisualSettings = {};
    const debugVisualSettings = state.debugVisualSettings;
    if (!Number.isFinite(debugVisualSettings.lastAppliedAt)) debugVisualSettings.lastAppliedAt = 0;
    if (typeof debugVisualSettings.applyError !== 'string') debugVisualSettings.applyError = '';
    return debugVisualSettings;
  }

  function normalizeDebugColorValues(values) {
    const normalized = normalizeMapColorValues(values);
    for (const field of DEBUG_COLOR_FIELDS) {
      normalized[field.key] = normalizeDebugHexColor(normalized[field.key], DEBUG_COLOR_DEFAULTS[field.key]);
    }
    return normalized;
  }

  function mapColorValues(mapId) {
    const mapState = state.game.overworld?.mapStates?.[mapId] || null;
    const draftValues = state.debugColors?.activeMapId === mapId ? state.debugColors?.values : null;
    return normalizeMapColorValues(draftValues || mapState?.debugColors?.values || getMapColorValuesForMap(mapId));
  }

  function combatBackdropColorValues() {
    const mapId = state.game.combatContext?.mapId || state.game.overworld?.currentMapId || null;
    if (mapId) return mapColorValues(mapId);

    return {
      ...DEFAULT_MAP_COLOR_VALUES,
      water1: UI_THEME.bg0,
      water2: UI_THEME.bg1,
      water3: UI_THEME.bg2,
    };
  }

  function fillCombatBackdrop(currentLayout) {
    const colors = combatBackdropColorValues();
    const background = ctx.createLinearGradient(0, 0, 0, currentLayout.sh);
    background.addColorStop(0, colors.water3);
    background.addColorStop(0.55, colors.water2);
    background.addColorStop(1, colors.water1);

    ctx.fillStyle = background;
    ctx.fillRect(-20, -20, currentLayout.sw + 40, currentLayout.sh + 40);
  }

  function debugColorModelStorage() {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
      return null;
    }
  }

  function defaultDebugColorModels() {
    return DEFAULT_MAP_COLOR_MODELS.map((model, index) => {
      return {
        id: typeof model.id === 'string' && model.id ? model.id : `default:${index}`,
        source: 'default',
        label: typeof model.label === 'string' && model.label ? model.label : `Modelo ${index + 1}`,
        values: normalizeDebugColorValues(model.values),
      };
    });
  }

  function readDebugColorModelStore() {
    const storage = debugColorModelStorage();
    if (!storage) return { userModels: [], deletedDefaultModelIds: [] };

    try {
      const parsed = JSON.parse(storage.getItem(DEBUG_COLOR_MODEL_STORAGE_KEY) || '{}');
      const userModels = Array.isArray(parsed.userModels)
        ? parsed.userModels.map((model, index) => {
          if (!model || typeof model !== 'object') return null;
          const id = typeof model.id === 'string' && model.id ? model.id : `custom:stored-${index}`;
          const label = typeof model.label === 'string' && model.label.trim()
            ? model.label.trim().slice(0, 18)
            : `Salvo ${index + 1}`;
          return {
            id,
            source: 'custom',
            label,
            values: normalizeDebugColorValues(model.values),
          };
        }).filter(Boolean)
        : [];
      const deletedDefaultModelIds = Array.isArray(parsed.deletedDefaultModelIds)
        ? parsed.deletedDefaultModelIds.filter((id) => typeof id === 'string')
        : [];
      return { userModels, deletedDefaultModelIds };
    } catch {
      return { userModels: [], deletedDefaultModelIds: [] };
    }
  }

  function writeDebugColorModelStore(debugColors) {
    const storage = debugColorModelStorage();
    if (!storage) return;

    storage.setItem(DEBUG_COLOR_MODEL_STORAGE_KEY, JSON.stringify({
      userModels: Array.isArray(debugColors.userColorModels) ? debugColors.userColorModels : [],
      deletedDefaultModelIds: Array.isArray(debugColors.deletedDefaultColorModelIds)
        ? debugColors.deletedDefaultColorModelIds
        : [],
    }));
  }

  function ensureDebugColorModels(debugColors = ensureDebugColors()) {
    if (!debugColors.colorModelsLoaded) {
      const stored = readDebugColorModelStore();
      debugColors.userColorModels = stored.userModels;
      debugColors.deletedDefaultColorModelIds = stored.deletedDefaultModelIds;
      debugColors.colorModelsLoaded = true;
    }
    if (!Array.isArray(debugColors.userColorModels)) debugColors.userColorModels = [];
    if (!Array.isArray(debugColors.deletedDefaultColorModelIds)) debugColors.deletedDefaultColorModelIds = [];
    if (!Number.isFinite(debugColors.modelScroll)) debugColors.modelScroll = 0;
    return debugColors;
  }

  function debugColorModels(debugColors = ensureDebugColors()) {
    ensureDebugColorModels(debugColors);
    const deleted = new Set(debugColors.deletedDefaultColorModelIds);
    const models = [
      ...defaultDebugColorModels().filter((model) => !deleted.has(model.id)),
      ...debugColors.userColorModels,
    ];
    if (!models.some((model) => model.id === debugColors.selectedColorModelId)) {
      debugColors.selectedColorModelId = models[0]?.id || null;
    }
    return models;
  }

  function selectedDebugColorModel(debugColors = ensureDebugColors()) {
    return debugColorModels(debugColors).find((model) => model.id === debugColors.selectedColorModelId) || null;
  }

  function saveCurrentDebugColorModel() {
    const debugColors = ensureDebugColorModels();
    const values = Object.fromEntries(DEBUG_COLOR_FIELDS.map((field) => {
      return [field.key, normalizeDebugHexColor(debugColors.values[field.key], DEBUG_COLOR_DEFAULTS[field.key])];
    }));
    const model = {
      id: `custom:${Date.now()}`,
      source: 'custom',
      label: `Salvo ${debugColors.userColorModels.length + 1}`,
      values: normalizeDebugColorValues(values),
    };

    debugColors.userColorModels.push(model);
    debugColors.selectedColorModelId = model.id;
    debugColors.lastModelSavedAt = performance.now();
    writeDebugColorModelStore(debugColors);
  }

  function useSelectedDebugColorModel() {
    const debugColors = ensureDebugColorModels();
    const model = selectedDebugColorModel(debugColors);
    if (!model) return;

    debugColors.values = normalizeDebugColorValues(model.values);
    debugColors.applyStatus = null;
    debugColors.applyError = '';
    debugColors.lastModelUsedAt = performance.now();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function deleteSelectedDebugColorModel() {
    const debugColors = ensureDebugColorModels();
    const model = selectedDebugColorModel(debugColors);
    if (!model) return;

    if (model.source === 'default') {
      if (!debugColors.deletedDefaultColorModelIds.includes(model.id)) {
        debugColors.deletedDefaultColorModelIds.push(model.id);
      }
    } else {
      debugColors.userColorModels = debugColors.userColorModels.filter((entry) => entry.id !== model.id);
    }

    debugColors.selectedColorModelId = null;
    debugColors.lastModelDeletedAt = performance.now();
    writeDebugColorModelStore(debugColors);
    debugColorModels(debugColors);
  }

  function openDebugColorPicker(key) {
    const debugColors = ensureDebugColors();
    const input = debugColorInputs.get(key);
    if (!input) return;
    input.value = debugColors.values[key];
    input.click();
  }

  function hideDebugColorInputs() {
    debugColorInputs.forEach((input) => {
      input.style.display = 'none';
    });
    debugColorHexInputs.forEach((input) => {
      input.style.display = 'none';
    });
  }

  function syncDebugColorInput(key, { x, y, size, value, visible }) {
    const input = debugColorInputs.get(key);
    if (!input) return;
    if (!visible) {
      input.style.display = 'none';
      return;
    }
    input.value = value;
    input.style.left = `${Math.round(x)}px`;
    input.style.top = `${Math.round(y)}px`;
    input.style.width = `${Math.round(size)}px`;
    input.style.height = `${Math.round(size)}px`;
    input.style.display = 'block';
  }

  function syncDebugColorHexInput(key, { x, y, w, h, value, visible }) {
    const input = debugColorHexInputs.get(key);
    if (!input) return;
    if (!visible) {
      input.style.display = 'none';
      return;
    }
    if (document.activeElement !== input) {
      input.value = value.toUpperCase();
    }
    input.style.left = `${Math.round(x)}px`;
    input.style.top = `${Math.round(y)}px`;
    input.style.width = `${Math.round(w)}px`;
    input.style.height = `${Math.round(h)}px`;
    input.style.display = 'block';
  }

  function syncDebugHeroOverlay(bounds = null) {
    const visible = !!bounds;
    const wasHidden = debugHeroOverlay.hidden;
    debugHeroOverlay.hidden = !visible;
    if (!visible) return;
    if (wasHidden) debugHeroOverlay.scrollTop = 0;

    const heroDebug = ensureDebugHeroState();
    const selectedAnimationId = heroDebug.selectedAnimationId;
    const selectedOption = HERO_DEBUG_ANIMATION_OPTIONS.find((option) => option.id === selectedAnimationId) || null;
    const selectValue = selectedAnimationId || 'auto';

    if (debugHeroSelect.value !== selectValue) {
      debugHeroSelect.value = selectValue;
    }

    debugHeroStatus.textContent = selectedOption
      ? `Atual: ${selectedOption.label}${selectedOption.loop ? ' (loop)' : ' (1x e para)'}`
      : 'Atual: Auto (jogo)';
    if (performance.now() - (heroDebug.lastAppliedAt || 0) < 1800) {
      debugHeroStatus.textContent = 'Hero aplicado.';
    }

    const player = state.game.player || {};
    const fieldValues = {
      level: player.level || 1,
      health: player.health || 0,
      maxHealth: player.maxHealth || 60,
      apMax: player.apMax || ACTION_RULES.BASE_AP,
      apRemaining: state.game.apRemaining ?? player.apMax ?? ACTION_RULES.BASE_AP,
      speedBase: player.speedBase || 0,
      speedRemaining: state.game.speedRemaining ?? player.speedBase ?? 0,
      defenseBase: player.defenseBase || 0,
      rangeBase: player.rangeBase || 2,
      characteristicPoints: player.characteristicPoints || 0,
    };
    for (const key of Object.keys(CHARACTERISTIC_DEFINITIONS)) {
      fieldValues[`characteristic:${key}`] = player.characteristics?.[key] || 0;
    }
    const heroInputFocused = [...debugHeroInputs.values()].includes(document.activeElement);
    if (!heroInputFocused) {
      for (const [key, value] of Object.entries(fieldValues)) {
        const input = debugHeroInputs.get(key);
        if (input) input.value = String(value);
      }
    }

    debugHeroOverlay.style.left = `${Math.round(bounds.x)}px`;
    debugHeroOverlay.style.top = `${Math.round(bounds.y)}px`;
    debugHeroOverlay.style.width = `${Math.round(bounds.w)}px`;
    if (Number.isFinite(bounds.h)) {
      debugHeroOverlay.style.height = `${Math.round(bounds.h)}px`;
      debugHeroOverlay.style.maxHeight = `${Math.round(bounds.h)}px`;
    } else {
      debugHeroOverlay.style.height = '';
      debugHeroOverlay.style.maxHeight = '';
    }
  }

  function clearThreeBoardViewport(currentLayout) {
    const viewport = threeBoard.getViewport(currentLayout);
    const pixelRatio = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(viewport.x, viewport.y, viewport.w, viewport.h);
    ctx.restore();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function mapTransitionOpacity(now) {
    const transition = state.game.mapTransition;
    if (!transition || transition.type !== 'overworldMap' || !Number.isFinite(transition.startTime)) return 0;

    const fadeIn = Math.max(0, transition.fadeInDuration || 0);
    const hold = Math.max(0, transition.holdDuration || 0);
    const fadeOut = Math.max(0, transition.fadeOutDuration || 0);
    const elapsed = Math.max(0, now - transition.startTime);

    if (fadeIn > 0 && elapsed < fadeIn) return elapsed / fadeIn;
    if (elapsed < fadeIn + hold) return 1;
    if (fadeOut > 0 && elapsed < fadeIn + hold + fadeOut) {
      return 1 - ((elapsed - fadeIn - hold) / fadeOut);
    }

    return 0;
  }

  function drawMapTransitionOverlay(currentLayout, now) {
    const alpha = clamp(mapTransitionOpacity(now), 0, 1);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, currentLayout.sw, currentLayout.sh);
    ctx.restore();
  }

  function getPlayerName(game) {
    return game?.player?.name || 'Aventureiro';
  }

  function getPlayerCardImage(game) {
    return cardImages[game?.player?.characterType] || cardImages.player;
  }

  function getBannerCardImage(banner, game) {
    if (banner.cardKey === 'player') return getPlayerCardImage(game);
    return cardImages[banner.cardKey] || null;
  }

  function beginHeartPath(cx, cy, size) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.36);
    ctx.bezierCurveTo(cx - size * 0.62, cy - size * 0.05, cx - size * 0.44, cy - size * 0.52, cx - size * 0.13, cy - size * 0.42);
    ctx.bezierCurveTo(cx - size * 0.02, cy - size * 0.38, cx, cy - size * 0.24, cx, cy - size * 0.12);
    ctx.bezierCurveTo(cx, cy - size * 0.24, cx + size * 0.02, cy - size * 0.38, cx + size * 0.13, cy - size * 0.42);
    ctx.bezierCurveTo(cx + size * 0.44, cy - size * 0.52, cx + size * 0.62, cy - size * 0.05, cx, cy + size * 0.36);
    ctx.closePath();
  }

  function drawHeartMeter(cx, cy, size, hp, maxHp) {
    const ratio = maxHp > 0 ? clamp(hp / maxHp, 0, 1) : 0;

    ctx.save();
    beginHeartPath(cx, cy, size);
    ctx.fillStyle = '#3b1c18';
    ctx.fill();

    ctx.save();
    beginHeartPath(cx, cy, size);
    ctx.clip();
    const top = cy - size * 0.48;
    const height = size * 0.86;
    const fillY = top + height * (1 - ratio);
    const gradient = ctx.createLinearGradient(cx, fillY, cx, top + height);
    gradient.addColorStop(0, '#cf6b55');
    gradient.addColorStop(1, UI_THEME.danger);
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - size * 0.62, fillY, size * 1.24, height * ratio);
    ctx.restore();

    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeStyle = '#d8a06e';
    beginHeartPath(cx, cy, size);
    ctx.stroke();

    draw.drawText(String(hp), cx, cy + size * 0.04, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.28)}px Inter, sans-serif`,
      color: UI_THEME.text,
    });
    ctx.restore();
  }

  function beginStarPath(cx, cy, outerRadius, innerRadius) {
    ctx.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + index * (Math.PI / 5);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawActionPointBadge(cx, cy, size, value) {
    ctx.save();
    beginStarPath(cx, cy, size * 0.52, size * 0.26);
    ctx.fillStyle = UI_THEME.accentDark;
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = '#d9c894';
    ctx.stroke();
    draw.drawText(String(value), cx, cy + size * 0.08, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.42)}px Inter, sans-serif`,
      color: UI_THEME.text,
    });
    ctx.restore();
  }

  function drawMovementPointBadge(cx, cy, size, value) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.54);
    ctx.lineTo(cx + size * 0.54, cy);
    ctx.lineTo(cx, cy + size * 0.54);
    ctx.lineTo(cx - size * 0.54, cy);
    ctx.closePath();
    ctx.fillStyle = UI_THEME.success;
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = '#b6c79a';
    ctx.stroke();
    draw.drawText(String(value), cx, cy + size * 0.07, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.42)}px Inter, sans-serif`,
      color: UI_THEME.text,
    });
    ctx.restore();
  }

  function drawResourceChip(x, y, w, h, type, value, scale = 1) {
    const isAction = type === 'action';
    const accent = isAction ? UI_THEME.accent : UI_THEME.success;
    const stroke = isAction ? '#d9c894' : '#b6c79a';
    const iconCx = x + 17 * scale;
    const iconCy = y + h / 2;
    const iconSize = Math.min(18 * scale, h * 0.72);

    draw.roundRect(x, y, w, h, 5 * scale, 'rgba(7,8,7,0.42)', 'rgba(111,99,66,0.48)');
    ctx.save();
    ctx.lineWidth = Math.max(1.5, 1.8 * scale);
    ctx.fillStyle = isAction ? UI_THEME.accentDark : UI_THEME.successDark;
    ctx.strokeStyle = stroke;
    if (isAction) {
      beginStarPath(iconCx, iconCy, iconSize * 0.48, iconSize * 0.24);
    } else {
      ctx.beginPath();
      ctx.moveTo(iconCx, iconCy - iconSize * 0.48);
      ctx.lineTo(iconCx + iconSize * 0.48, iconCy);
      ctx.lineTo(iconCx, iconCy + iconSize * 0.48);
      ctx.lineTo(iconCx - iconSize * 0.48, iconCy);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    draw.drawText(String(value), x + w - 13 * scale, y + h / 2, {
      align: 'right',
      baseline: 'middle',
      font: `900 ${Math.max(11, Math.floor(15 * scale))}px Inter, sans-serif`,
      color: accent,
    });
  }

  function drawClockIcon(cx, cy, radius, color = UI_THEME.textMuted) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(23,25,18,0.88)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, radius * 0.16);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - radius * 0.52);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * 0.42, cy + radius * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  function drawShadowedText(text, x, y, options = {}, shadowColor = 'rgba(0,0,0,0.85)') {
    ctx.save();
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = options.shadowBlur ?? 0;
    ctx.shadowOffsetX = options.shadowOffsetX ?? 1;
    ctx.shadowOffsetY = options.shadowOffsetY ?? 1;
    draw.drawText(text, x, y, options);
    ctx.restore();
  }

  function heroTurnPalette(activeTurn, remainingMs = 0) {
    if (!activeTurn) {
      return {
        timerText: UI_THEME.textDim,
        timerTrack: 'rgba(41,41,31,0.9)',
        timerFill: UI_THEME.border0,
        timerBorder: UI_THEME.border0,
        buttonFillTop: '#343226',
        buttonFillMid: UI_THEME.surface2,
        buttonFillBottom: UI_THEME.surface1,
        buttonStroke: UI_THEME.border0,
        buttonText: UI_THEME.textMuted,
      };
    }

    if (remainingMs <= 5000) {
      return {
        timerText: '#e9b5a7',
        timerTrack: 'rgba(75,28,22,0.92)',
        timerFill: UI_THEME.danger,
        timerBorder: UI_THEME.dangerDark,
        buttonFillTop: '#e0b35e',
        buttonFillMid: UI_THEME.accent,
        buttonFillBottom: UI_THEME.accentDark,
        buttonStroke: '#e6c06f',
        buttonText: UI_THEME.text,
      };
    }

    if (remainingMs <= 15000) {
      return {
        timerText: '#d9c894',
        timerTrack: 'rgba(71,54,24,0.92)',
        timerFill: UI_THEME.accent,
        timerBorder: UI_THEME.accentDark,
        buttonFillTop: '#e0b35e',
        buttonFillMid: UI_THEME.accent,
        buttonFillBottom: UI_THEME.accentDark,
        buttonStroke: '#e6c06f',
        buttonText: UI_THEME.text,
      };
    }

    return {
      timerText: '#b6c79a',
      timerTrack: 'rgba(28,49,31,0.94)',
      timerFill: UI_THEME.success,
      timerBorder: UI_THEME.successDark,
      buttonFillTop: '#e0b35e',
      buttonFillMid: UI_THEME.accent,
      buttonFillBottom: UI_THEME.accentDark,
      buttonStroke: '#e6c06f',
      buttonText: UI_THEME.text,
    };
  }

  function drawHeroTurnControl(x, y, w, now, compact = false) {
    const game = state.game;
    const activeTurn = game.phase === PHASES.HERO;
    const heroTimer = activeTurn ? actions.getHeroTurnTimer(now) : null;
    const expired = !!(activeTurn && heroTimer && heroTimer.remainingMs <= 0 && !game.busy);
    if (expired) {
      actions.endHeroPhase();
    }

    const clickable = activeTurn && !game.busy && !expired;
    const palette = heroTurnPalette(activeTurn, heroTimer?.remainingMs ?? 0);
    const controlH = compact ? 58 : 70;
    const rowH = compact ? 22 : 24;
    const buttonGap = compact ? 6 : 7;
    const buttonH = compact ? 30 : 38;
    const rowX = x;
    const rowY = y;
    const rowW = w;
    const timerX = rowX + (compact ? 38 : 42);
    const timerY = rowY + 3;
    const timerW = Math.max(58, rowX + rowW - timerX - (compact ? 8 : 10));
    const timerH = Math.max(14, rowH - 6);
    const buttonX = x;
    const buttonW = w;
    const buttonY = rowY + rowH + buttonGap;
    const buttonActive = activeTurn && !game.busy && !expired;
    const hovered = clickable && layout.pointInRect(state.mouse.x, state.mouse.y, { x, y, w, h: controlH });
    const buttonGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonH);
    const buttonTop = buttonActive && hovered ? '#f0c978' : (buttonActive ? palette.buttonFillTop : '#343226');
    const buttonMid = buttonActive && hovered ? '#d39b32' : (buttonActive ? palette.buttonFillMid : UI_THEME.surface2);
    const buttonBottom = buttonActive && hovered ? '#73501d' : (buttonActive ? palette.buttonFillBottom : UI_THEME.surface1);

    buttonGradient.addColorStop(0, buttonTop);
    buttonGradient.addColorStop(0.52, buttonMid);
    buttonGradient.addColorStop(1, buttonBottom);

    draw.roundRect(rowX, rowY, rowW, rowH, 6, 'rgba(7,8,7,0.64)', 'rgba(111,99,66,0.54)');
    drawClockIcon(rowX + (compact ? 12 : 13), rowY + rowH / 2, compact ? 5 : 5.5, UI_THEME.textMuted);
    drawShadowedText(String(game.turnCount), rowX + (compact ? 27 : 30), rowY + rowH / 2 + 3, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${compact ? 12 : 13}px Inter, sans-serif`,
      color: UI_THEME.text,
    }, 'rgba(0,0,0,0.9)');

    if (activeTurn && heroTimer) {
      const barW = Math.max(0, timerW);
      const fillW = Math.min(barW, Math.max(2, barW * heroTimer.progress));

      draw.roundRect(timerX, timerY, barW, timerH, timerH / 2, palette.timerTrack, palette.timerBorder);
      if (fillW > 0) {
        draw.roundRect(timerX, timerY, fillW, timerH, timerH / 2, palette.timerFill, null);
      }

      drawShadowedText(`${heroTimer.remainingSeconds}s`, timerX + timerW / 2, timerY + timerH / 2 + 2, {
        align: 'center',
        baseline: 'middle',
        font: `900 ${compact ? 12 : 13}px Inter, sans-serif`,
        color: UI_THEME.text,
      }, 'rgba(0,0,0,0.85)');
    } else {
      draw.roundRect(timerX, timerY, timerW, timerH, timerH / 2, palette.timerTrack, palette.timerBorder);
      drawShadowedText('AGUARDE', timerX + timerW / 2, timerY + timerH / 2 + 2, {
        align: 'center',
        baseline: 'middle',
        font: `900 ${compact ? 11 : 12}px Inter, sans-serif`,
        color: palette.timerText,
      }, 'rgba(0,0,0,0.85)');
    }

    draw.roundRect(buttonX, buttonY, buttonW, buttonH, 6, buttonGradient, buttonActive ? palette.buttonStroke : 'rgba(111,99,66,0.52)');
    if (buttonActive) {
      draw.roundRect(buttonX + 2, buttonY + 2, buttonW - 4, Math.max(3, Math.floor(buttonH * 0.18)), 4, 'rgba(242,234,215,0.12)', null);
    }

    drawShadowedText('FIM DE TURNO', buttonX + buttonW / 2, buttonY + buttonH / 2 + (compact ? 2 : 3), {
      align: 'center',
      baseline: 'middle',
      font: `900 ${compact ? 11 : 15}px Inter, sans-serif`,
      color: buttonActive ? palette.buttonText : UI_THEME.textMuted,
    }, 'rgba(0,0,0,0.9)');

    if (buttonActive) {
      state.game.buttons.push({ x: buttonX, y: buttonY, w: buttonW, h: buttonH, onClick: actions.endHeroPhase });
    }
  }

  function drawSidebar(currentLayout) {
    const game = state.game;
    const x = currentLayout.leftX;
    const y = currentLayout.leftY;
    const w = currentLayout.leftW;
    const h = currentLayout.leftH;

    draw.roundRect(x, y, w, h, 8, UI_THEME.surface1, '#0b0c08');
    const inOverworld = game.mode === GAME_MODES.OVERWORLD;
    const worldMap = inOverworld ? getCurrentWorldMap(game.overworld) : null;
    const worldMapState = inOverworld ? getCurrentWorldMapState(game.overworld) : null;
    
    let cy = y + 40;
    draw.drawText('ONE CARD', x + w / 2, cy, {
      align: 'center', font: 'bold 28px Inter, sans-serif', color: UI_THEME.textDim,
    });
    cy += 30;
    draw.drawText(inOverworld ? 'WORLD' : 'DUNGEON', x + w / 2, cy, {
      align: 'center', font: 'bold 28px Inter, sans-serif', color: UI_THEME.textDim,
    });
    
    cy += 36;
    const progressLabel = inOverworld
      ? `${worldMapState?.enemies?.length || 0} inimigos em ${worldMap?.name || 'mapa'}`
      : `Nível ${LEVELS[game.levelIndex].id}/12 • Vez ${game.turnCount}`;
    draw.drawText(progressLabel, x + w / 2, cy, {
      align: 'center', font: 'bold 18px Inter, sans-serif', color: UI_THEME.accent,
    });

    const phaseName = inOverworld
      ? 'MAPA ABERTO'
      : {
          energy: 'ENERGIA',
          hero: 'AVENTUREIRO',
          monsterTurn: 'MONSTROS',
          monsterMove: 'MONSTROS',
          monsterAttack: 'ATAQUE INIMIGO',
          levelup: 'RECOMPENSA',
          won: 'VITÓRIA',
          lost: 'DERROTA',
        }[game.phase];

    cy += 36;
    draw.drawText(phaseName, x + w / 2, cy, {
      align: 'center', font: 'bold 22px Inter, sans-serif', color: '#d9c894',
    });

    cy += 16;
    const totals = actions.getTotals();
    const topMargin = 90;
    const availableW = w - 32;
    const barW = w - 32;
    const barH = 40;
    const barX = x + 16;
    draw.roundRect(barX, cy, barW, barH, 6, 'rgba(23,25,18,0.95)', UI_THEME.border0);
    
    const statItemW = barW / 5;
    const statsArray = [
      { icon: '⚡', val: game.apRemaining ?? totals.ap, color: UI_THEME.accent },
      { icon: '🏃', val: game.speedRemaining ?? totals.speed, color: '#b6c79a' },
      { icon: '⚔️', val: totals.attack, color: '#e0b35e' },
      { icon: '🛡️', val: totals.defense, color: '#b8ac86' },
      { icon: '🎯', val: totals.range, color: '#cf8a43' }
    ];
    
    statsArray.forEach((stat, i) => {
      const cx = barX + (i * statItemW) + statItemW / 2;
      draw.drawText(stat.icon, cx - 12, cy + 26, { align: 'center', font: '16px Inter, sans-serif' });
      draw.drawText(String(stat.val), cx + 10, cy + 26, { align: 'center', font: 'bold 16px Inter, sans-serif', color: stat.color });
    });

    cy += barH + 30;

    if (game.lastEvent && !inOverworld) {
      draw.drawText(game.lastEvent, x + w / 2, cy, {
        align: 'center', font: 'italic 14px Inter, sans-serif', color: UI_THEME.textMuted, maxWidth: w - 24,
      });
      cy += 30;
    }

    game.diceRects = [];
    game.dropZones = [];

    if (game.phase === PHASES.ENERGY) {
      draw.drawText('Dados rolados', x + w / 2, cy, {
        align: 'center', font: '20px Inter, sans-serif', color: UI_THEME.textMuted,
      });
      
      cy += 20;
      const diceSize = 64;
      const diceSpacing = 20;
      const totalDiceW = (diceSize * 3) + (diceSpacing * 2);
      let diceX = x + (w - totalDiceW) / 2;
      
      for (let index = 0; index < 3; index += 1) {
        if (game.phase === PHASES.ENERGY) {
          const stat = actions.assignedStatForDie(index);
          const isDraggingThisDie = game.draggingDie && game.draggingDie.dieIndex === index;
          const currentDiceX = diceX + index * (diceSize + diceSpacing);

          if (stat === null && !isDraggingThisDie) {
            draw.drawDieToken(currentDiceX, cy, diceSize, game.roll[index], index);
          } else if (stat === null) {
            draw.drawDieToken(currentDiceX, cy, diceSize, game.roll[index], index, true);
          }
        }
      }

      cy += diceSize + 40;
      
      const boardY = topMargin + Math.floor((h - topMargin - 140) / 2);
      const boxW = Math.floor((w - 48) / 3);
      const boxH = 140;
      const boxSpacing = 8;
      const startBoxX = x + 16 + (w - 32 - (boxW * 3 + boxSpacing * 2)) / 2;

      ['speed', 'attack', 'defense'].forEach((stat, index) => {
        const meta = STAT_META[stat];
        const bx = startBoxX + index * (boxW + boxSpacing);
        const by = cy;
        const assigned = game.energyAssigned[stat];
        const hoveringDrop = game.phase === PHASES.ENERGY && layout.pointInRect(state.mouse.x, state.mouse.y, {
          x: bx, y: by, w: boxW, h: boxH,
        }) && !!game.draggingDie;

        if (game.phase === PHASES.ENERGY) {
          game.dropZones.push({ x: bx, y: by, w: boxW, h: boxH, stat });
        }
        
        draw.roundRect(
          bx, by, boxW, boxH, 8,
          hoveringDrop ? '#e7e5e4' : '#d6d3d1',
          '#a8a29e'
        );
        
        draw.drawText(meta.label, bx + boxW / 2, by + 24, {
          align: 'center', font: 'bold 16px Inter, sans-serif', color: '#292524',
        });
        draw.drawText(`Base ${game.player[`${stat}Base`]}`, bx + boxW / 2, by + 42, {
          align: 'center', font: '14px Inter, sans-serif', color: '#44403c',
        });

        ctx.beginPath();
        ctx.arc(bx + boxW / 2, by + 80, 24, 0, Math.PI * 2);
        ctx.fillStyle = '#a8a29e';
        ctx.fill();
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 3;
        ctx.stroke();

        draw.drawText(meta.icon, bx + boxW / 2, by + 130, {
          align: 'center', font: '24px Inter, sans-serif',
        });

        if (game.phase === PHASES.ENERGY && assigned !== null && (!game.draggingDie || game.draggingDie.dieIndex !== assigned)) {
          const dieSize = 48;
          draw.drawDieToken(bx + boxW / 2 - dieSize / 2, by + 80 - dieSize / 2, dieSize, game.roll[assigned], assigned);
        }
      });
      
      cy += boxH + 40;
      
      const btnW = w - 64;
      if (game.phase === PHASES.ENERGY) {
        if (actions.allDiceAssigned() && !game.energyConfirmStartTime) {
          game.energyConfirmStartTime = performance.now();
        }

        if (game.energyConfirmStartTime) {
          const elapsed = performance.now() - game.energyConfirmStartTime;
          const remaining = Math.max(0, 5 - Math.floor(elapsed / 1000));

          if (remaining === 0 && actions.allDiceAssigned() && !game.busy && !game.energyConfirmed) {
            game.energyConfirmed = true; // prevent multiple calls
            setTimeout(() => actions.confirmEnergy(), 0);
          }

          draw.drawButton(x + 32, cy, btnW, 56, String(remaining), () => {
            if (actions.allDiceAssigned()) actions.confirmEnergy();
          }, {
            fill: UI_THEME.accentDark, hoverFill: UI_THEME.accent, stroke: '#e6c06f',
            disabled: game.busy || !actions.allDiceAssigned(),
            font: 'bold 28px Inter, sans-serif', color: '#fffbeb',
          });
        }

        if (game.draggingDie) {
          draw.drawDieToken(
            state.mouse.x - game.draggingDie.offsetX,
            state.mouse.y - game.draggingDie.offsetY,
            64, game.roll[game.draggingDie.dieIndex], game.draggingDie.dieIndex
          );
        }
      }
    }

    if (game.phase === PHASES.LEVELUP) {
      const options = [
        ['❤️ Curar', 'heal'],
        ['🏃 +1 Velocidade', 'speed'],
        ['⚔️ +1 Dano do Ataque', 'attack'],
        ['🛡️ +1 Defesa', 'defense'],
        ['🎯 +1 Alcance', 'range'],
      ];

      options.forEach((option, index) => {
        draw.drawButton(x + 24, cy + index * 54, w - 48, 44, option[0], () => {
          actions.applyReward(option[1]);
        }, {
          fill: UI_THEME.successDark, hoverFill: UI_THEME.success, stroke: '#b6c79a',
          disabled: game.busy, font: 'bold 14px Inter, sans-serif',
        });
      });
    }

    if (game.phase === PHASES.WON || game.phase === PHASES.LOST) {
      draw.drawButton(x + 24, cy, w - 48, 48, 'Novo jogo', actions.newGame, {
        fill: UI_THEME.accentDark, hoverFill: UI_THEME.accent, stroke: '#e6c06f',
      });
      cy += 60;
      draw.drawButton(x + 24, cy, w - 48, 48, 'Carregar', actions.loadGame, {
        fill: UI_THEME.surface1, hoverFill: UI_THEME.surface2, stroke: UI_THEME.border1,
      });
    }

  }

  function drawMenu(currentLayout) {
    if (!state.game.menuOpen) return;

    const menuView = state.game.menuView || 'main';
    if (menuView === 'main' || menuView === 'sound') {
      const soundView = menuView === 'sound';
      const w = soundView ? 360 : 260;
      const h = soundView ? 228 : 288;
      const x = (currentLayout.sw - w) / 2;
      const y = (currentLayout.sh - h) / 2;
      const contentX = x + 24;
      const contentY = y + 64;
      const contentW = w - 48;

      function closeMenu() {
        state.game.menuOpen = false;
        state.game.menuView = 'main';
      }

      function openTutorialModal() {
        closeMenu();
        const modal = document.getElementById('tutorial-modal');
        if (modal) modal.style.display = 'flex';
      }

      draw.roundRect(x, y, w, h, 8, UI_THEME.overlay, UI_THEME.border1);
      draw.drawText(soundView ? 'Sons' : 'Menu', x + w / 2, y + 30, {
        align: 'center',
        font: 'bold 17px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawButton(x + w - 38, y + 9, 28, 26, 'X', closeMenu, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });

      if (soundView) {
        const volume = actions.getOverworldMusicVolume?.() ?? 0.5;
        const percent = Math.round(volume * 100);
        const sliderX = contentX;
        const sliderY = contentY + 80;
        const sliderW = contentW;
        const sliderH = 24;
        const trackY = sliderY + sliderH / 2;
        const knobX = sliderX + sliderW * volume;

        function setVolumeFromMouse(mouseX) {
          const nextVolume = clamp((mouseX - sliderX) / sliderW, 0, 1);
          actions.setOverworldMusicVolume?.(nextVolume);
        }

        draw.drawText('Volume da música', contentX, contentY + 6, {
          align: 'left',
          font: 'bold 16px Inter, sans-serif',
          color: UI_THEME.text,
        });
        draw.drawText(`${percent}%`, x + w - 24, contentY + 6, {
          align: 'right',
          font: 'bold 16px Inter, sans-serif',
          color: UI_THEME.accent,
        });
        draw.drawText('Volume da música do jogo como um todo.', contentX, contentY + 34, {
          align: 'left',
          font: '13px Inter, sans-serif',
          color: UI_THEME.textMuted,
          maxWidth: contentW,
        });

        ctx.save();
        draw.roundRect(sliderX, trackY - 4, sliderW, 8, 4, 'rgba(32,34,25,0.92)', UI_THEME.border1);
        draw.roundRect(sliderX, trackY - 4, Math.max(8, knobX - sliderX), 8, 4, UI_THEME.accentDark, null);
        draw.roundRect(knobX - 9, trackY - 11, 18, 22, 6, '#d6b36e', '#f3d79a');
        ctx.restore();

        state.game.buttons.push({
          x: sliderX,
          y: sliderY,
          w: sliderW,
          h: sliderH,
          onClick: () => setVolumeFromMouse(state.mouse.x),
          onDragStart: () => setVolumeFromMouse(state.mouse.x),
          onDrag: (mouseX) => setVolumeFromMouse(mouseX),
        });

        draw.drawButton(contentX, y + h - 48, contentW, 34, 'Fechar', closeMenu, {
          fill: UI_THEME.surface1,
          hoverFill: UI_THEME.surface2,
          stroke: UI_THEME.border1,
        });
        return;
      }

      const buttonH = 38;
      const buttonGap = 10;
      let buttonY = y + 54;

      draw.drawButton(contentX, buttonY, contentW, buttonH, 'Como jogar', openTutorialModal, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
      buttonY += buttonH + buttonGap;

      draw.drawButton(contentX, buttonY, contentW, buttonH, 'Sons', () => {
        state.game.menuView = 'sound';
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
      buttonY += buttonH + buttonGap;

      draw.drawButton(contentX, buttonY, contentW, buttonH, 'Dungeon Legado', () => {
        closeMenu();
        actions.newDungeonLegacyGame();
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
      buttonY += buttonH + buttonGap;

      draw.drawButton(contentX, buttonY, contentW, buttonH, 'Sair', () => {
        closeMenu();
        onExitToMainMenu?.();
      }, {
        fill: UI_THEME.dangerDark,
        hoverFill: UI_THEME.danger,
        stroke: '#fca5a5',
      });
      return;
    }

    const optionsTab = state.game.optionsTab || 'how-to';
    const w = menuView === 'options' ? 420 : 220;
    const h = menuView === 'options' ? 300 : 142;
    const x = (currentLayout.sw - w) / 2;
    const y = (currentLayout.sh - h) / 2;

    draw.roundRect(x, y, w, h, 8, UI_THEME.overlay, UI_THEME.border1);
    draw.drawText(menuView === 'options' ? 'Opções' : 'Menu', x + w / 2, y + 30, {
      align: 'center',
      font: 'bold 17px Inter, sans-serif',
      color: UI_THEME.text,
    });

    if (menuView === 'main') {
      draw.drawButton(x + 18, y + 48, w - 36, 34, 'Opções', () => {
        state.game.menuView = 'options';
        state.game.optionsTab = state.game.optionsTab || 'how-to';
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
      draw.drawButton(x + 18, y + 92, w - 36, 34, 'Sair', () => {
        state.game.menuOpen = false;
        state.game.menuView = 'main';
        onExitToMainMenu?.();
      }, {
        fill: UI_THEME.dangerDark,
        hoverFill: UI_THEME.danger,
        stroke: '#fca5a5',
      });
      return;
    }

    draw.drawButton(x + w - 38, y + 9, 28, 26, '×', () => {
      state.game.menuOpen = false;
      state.game.menuView = 'main';
    }, {
      fill: UI_THEME.surface1,
      hoverFill: UI_THEME.surface2,
      stroke: UI_THEME.border1,
    });

    const tabs = [
      ['how-to', 'Como jogar'],
      ['sound', 'Sons'],
      ['game', 'Jogo'],
    ];
    const tabY = y + 48;
    const tabGap = 8;
    const tabW = (w - 36 - tabGap * (tabs.length - 1)) / tabs.length;
    tabs.forEach(([id, label], index) => {
      const active = optionsTab === id;
      draw.drawButton(x + 18 + index * (tabW + tabGap), tabY, tabW, 32, label, () => {
        state.game.optionsTab = id;
      }, {
        fill: active ? UI_THEME.accentDark : UI_THEME.surface1,
        hoverFill: active ? UI_THEME.accent : UI_THEME.surface2,
        stroke: active ? '#e6c06f' : UI_THEME.border1,
        font: 'bold 12px Inter, sans-serif',
      });
    });

    const contentX = x + 24;
    const contentY = y + 104;
    const contentW = w - 48;

    if (optionsTab === 'how-to') {
      draw.drawText('Guia de regras e controles', contentX, contentY + 6, {
        align: 'left',
        font: 'bold 16px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawButton(contentX, contentY + 34, contentW, 38, 'Como jogar', () => {
        state.game.menuOpen = false;
        state.game.menuView = 'main';
        const modal = document.getElementById('tutorial-modal');
        if (modal) modal.style.display = 'flex';
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
    } else if (optionsTab === 'sound') {
      const volume = actions.getOverworldMusicVolume?.() ?? 0.5;
      const percent = Math.round(volume * 100);
      const sliderX = contentX;
      const sliderY = contentY + 80;
      const sliderW = contentW;
      const sliderH = 24;
      const trackY = sliderY + sliderH / 2;
      const knobX = sliderX + sliderW * volume;

      function setVolumeFromMouse(mouseX) {
        const nextVolume = clamp((mouseX - sliderX) / sliderW, 0, 1);
        actions.setOverworldMusicVolume?.(nextVolume);
      }

      draw.drawText('Volume da música', contentX, contentY + 6, {
        align: 'left',
        font: 'bold 16px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawText(`${percent}%`, x + w - 24, contentY + 6, {
        align: 'right',
        font: 'bold 16px Inter, sans-serif',
        color: UI_THEME.accent,
      });
      draw.drawText('Volume da música do jogo como um todo.', contentX, contentY + 34, {
        align: 'left',
        font: '13px Inter, sans-serif',
        color: UI_THEME.textMuted,
        maxWidth: contentW,
      });

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = UI_THEME.border1;
      ctx.fillStyle = 'rgba(32,34,25,0.92)';
      draw.roundRect(sliderX, trackY - 4, sliderW, 8, 4, 'rgba(32,34,25,0.92)', UI_THEME.border1);
      draw.roundRect(sliderX, trackY - 4, Math.max(8, knobX - sliderX), 8, 4, UI_THEME.accentDark, null);
      draw.roundRect(knobX - 9, trackY - 11, 18, 22, 6, '#d6b36e', '#f3d79a');
      ctx.restore();

      state.game.buttons.push({
        x: sliderX,
        y: sliderY,
        w: sliderW,
        h: sliderH,
        onClick: () => setVolumeFromMouse(state.mouse.x),
        onDragStart: () => setVolumeFromMouse(state.mouse.x),
        onDrag: (mouseX) => setVolumeFromMouse(mouseX),
      });
    } else {
      draw.drawText('Modos de jogo', contentX, contentY + 6, {
        align: 'left',
        font: 'bold 16px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawButton(contentX, contentY + 34, contentW, 38, 'Dungeon legada', () => {
        state.game.menuOpen = false;
        state.game.menuView = 'main';
        actions.newDungeonLegacyGame();
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
    }

    draw.drawButton(x + 18, y + h - 46, w - 36, 34, 'Voltar', () => {
      state.game.menuView = 'main';
    }, {
      fill: UI_THEME.surface1,
      hoverFill: UI_THEME.surface2,
      stroke: UI_THEME.border1,
    });
  }

  function drawCompactBottomUI(currentLayout) {
    const game = state.game;
    const bottomY = currentLayout.sh - currentLayout.bottomUIHeight;
    const uiX = currentLayout.boardX;
    const uiW = currentLayout.boardW;
    const hp = game.player.health;
    const maxHp = game.player.maxHealth;
    const attack = actions.getEquippedAttack(game);
    const attackSelected = game.selectedAttackId === attack.id;
    const attackDisabled = game.phase !== PHASES.HERO || game.busy || game.apRemaining < attack.apCost;

    draw.roundRect(uiX, bottomY + 10, 72, 50, 6, 'rgba(23,25,18,0.88)', UI_THEME.border0);
    draw.drawText('HP', uiX + 36, bottomY + 30, {
      align: 'center',
      font: 'bold 12px Inter, sans-serif',
      color: '#d89a82',
    });
    draw.drawText(`${hp}/${maxHp}`, uiX + 36, bottomY + 50, {
      align: 'center',
      font: 'bold 17px Inter, sans-serif',
      color: UI_THEME.text,
    });

    const slotSize = 46;
    const slotGap = 8;
    const slotsX = uiX + 84;
    const slotsY = bottomY + 12;

    for (let index = 0; index < 3; index += 1) {
      const sx = slotsX + index * (slotSize + slotGap);
      const slot = { x: sx, y: slotsY, w: slotSize, h: slotSize };
      const hovered = layout.pointInRect(state.mouse.x, state.mouse.y, slot);
      const filled = index === 0;
      const selected = filled && attackSelected;
      const fill = !filled
        ? 'rgba(23,25,18,0.52)'
        : selected
          ? UI_THEME.accentDark
          : hovered && !attackDisabled
            ? '#73501d'
            : UI_THEME.surface1;
      const stroke = selected ? '#e6c06f' : filled ? UI_THEME.accentDark : UI_THEME.border0;

      draw.roundRect(sx, slotsY, slotSize, slotSize, 6, fill, stroke);

      if (filled) {
        draw.drawText('ATQ', sx + slotSize / 2, slotsY + 26, {
          align: 'center',
          font: 'bold 12px Inter, sans-serif',
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.text,
        });
        draw.drawText(String(attack.apCost), sx + slotSize - 11, slotsY + slotSize - 7, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.accent,
        });

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: actions.toggleAttackSelection });
        }
      } else {
        draw.drawText('+', sx + slotSize / 2, slotsY + 29, {
          align: 'center',
          font: '20px Inter, sans-serif',
          color: UI_THEME.border0,
        });
      }
    }

    const btnW = Math.min(156, uiW * 0.48);
    const btnX = uiX + uiW - btnW;
    drawHeroTurnControl(btnX, bottomY + 68, btnW, now, true);
  }

  function drawBottomUI(currentLayout) {
    if (currentLayout.compact) {
      drawCompactBottomUI(currentLayout);
      return;
    }

    const game = state.game;
    const bottomY = currentLayout.sh - currentLayout.bottomUIHeight;
    const uiX = currentLayout.boardX;
    
    // Draw Heart
    const hp = game.player.health;
    const maxHp = game.player.maxHealth;
    
    const heartSize = 74;
    const hx = uiX + heartSize / 2;
    const hy = bottomY + 12;
    
    ctx.save();
    ctx.translate(hx, hy);
    
    // Draw heart path
    ctx.beginPath();
    const w = heartSize;
    const h = heartSize;
    const topCurveHeight = h * 0.3;
    ctx.moveTo(0, topCurveHeight);
    ctx.bezierCurveTo(0, 0, -w / 2, 0, -w / 2, topCurveHeight);
    ctx.bezierCurveTo(-w / 2, (h + topCurveHeight) / 2, 0, (h + topCurveHeight) / 2, 0, h);
    ctx.bezierCurveTo(0, (h + topCurveHeight) / 2, w / 2, (h + topCurveHeight) / 2, w / 2, topCurveHeight);
    ctx.bezierCurveTo(w / 2, 0, 0, 0, 0, topCurveHeight);
    ctx.closePath();

    // Fill background (empty heart)
    ctx.fillStyle = '#3f352b';
    ctx.fill();

    // Fill red portion based on HP
    if (hp > 0 && maxHp > 0) {
      ctx.save();
      ctx.clip(); 
      const fillPercent = hp / maxHp;
      const fillHeight = h * fillPercent;
      const startY = h - fillHeight;
      
      ctx.fillStyle = UI_THEME.danger;
      ctx.fillRect(-w / 2, startY, w, fillHeight);
      ctx.restore();
    }

    // Stroke heart
    ctx.strokeStyle = UI_THEME.border0;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Text inside heart
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = UI_THEME.text;
    ctx.font = 'bold 18px Inter, sans-serif';
    
    // Draw current hp
    ctx.fillText(hp, 0, h * 0.35);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(-10, h * 0.5);
    ctx.lineTo(10, h * 0.5);
    ctx.strokeStyle = UI_THEME.text;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw max hp
    ctx.fillText(maxHp, 0, h * 0.67);
    
    ctx.restore();

    const slotSize = 58;
    const slotGap = 10;
    const slotsX = uiX + heartSize + 28;
    const slotsY = bottomY + 21;
    const attack = actions.getEquippedAttack(game);
    const attackSelected = game.selectedAttackId === attack.id;
    const attackDisabled = game.phase !== PHASES.HERO || game.busy || game.apRemaining < attack.apCost;

    for (let index = 0; index < 3; index += 1) {
      const sx = slotsX + index * (slotSize + slotGap);
      const slot = { x: sx, y: slotsY, w: slotSize, h: slotSize };
      const hovered = layout.pointInRect(state.mouse.x, state.mouse.y, slot);
      const filled = index === 0;
      const selected = filled && attackSelected;
      const fill = !filled
        ? 'rgba(23,25,18,0.52)'
        : selected
          ? UI_THEME.accentDark
          : hovered && !attackDisabled
            ? '#73501d'
            : UI_THEME.surface1;
      const stroke = selected ? '#e6c06f' : filled ? UI_THEME.accentDark : UI_THEME.border0;

      draw.roundRect(sx, slotsY, slotSize, slotSize, 6, fill, stroke);

      if (filled) {
        draw.drawText('✊', sx + slotSize / 2, slotsY + 34, {
          align: 'center',
          font: '28px Inter, sans-serif',
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.text,
        });
        draw.drawText(String(attack.apCost), sx + slotSize - 12, slotsY + slotSize - 8, {
          align: 'center',
          font: 'bold 11px Inter, sans-serif',
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.accent,
        });

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: actions.toggleAttackSelection });
        }
      } else {
        draw.drawText('+', sx + slotSize / 2, slotsY + 36, {
          align: 'center',
          font: '22px Inter, sans-serif',
          color: UI_THEME.border0,
        });
      }
    }
    
    // Turn Queue
    if (game.turnQueue && game.turnQueue.length > 0) {
      const queueW = 48;
      const queueSpacing = 16;
      const queueY = bottomY + 26;
      
      let currentX = slotsX + (slotSize + slotGap) * 3 + 28;
      const staticQueue = ['player', ...game.monsters.map(m => m.id)];

      for (let i = 0; i < staticQueue.length; i++) {
         const entityId = staticQueue[i];
         let icon;

         if (entityId === 'player') {
            icon = '🧙';
         } else {
            const monster = game.monsters.find(m => m.id === entityId);
            if (!monster) continue;
            icon = monster.emoji;
         }

         const isCurrent = (entityId === game.turnQueue[0]);
         const bgColor = isCurrent ? UI_THEME.success : UI_THEME.surface0;
         const borderColor = UI_THEME.border1;

         const boxSize = isCurrent ? queueW + 8 : queueW;
         const yOffset = isCurrent ? -4 : 0;
         const bx = currentX;
         
         draw.roundRect(bx, queueY + yOffset, boxSize, boxSize, 6, bgColor, borderColor);
         draw.drawText(icon, bx + boxSize / 2, queueY + yOffset + boxSize / 2 + 8, {
            align: 'center', font: isCurrent ? '30px Inter' : '24px Inter'
         });

         draw.roundRect(bx - 8, queueY + yOffset - 8, 20, 20, 6, UI_THEME.surface1, borderColor);
         draw.drawText(`${i + 1}`, bx + 2, queueY + yOffset + 6, {
            align: 'center', font: 'bold 12px Inter, sans-serif', color: UI_THEME.text
         });

         currentX += (queueW + queueSpacing);
      }
    }

    const btnW = Math.min(156, currentLayout.boardW * 0.48);
    const btnX = currentLayout.boardX + currentLayout.boardW - btnW;
    drawHeroTurnControl(btnX, bottomY + 68, btnW, now, true);
  }

  function drawPlayerResourceHud(x, y, scale = 1) {
    const game = state.game;
    const width = 166 * scale;
    const height = 76 * scale;
    const heartSize = 54 * scale;
    const heartCx = x + 37 * scale;
    const heartCy = y + 37 * scale;
    const chipX = x + 78 * scale;
    const chipW = width - 88 * scale;
    const chipH = 24 * scale;

    draw.roundRect(x, y, width, height, 7 * scale, 'rgba(7,8,7,0.46)', 'rgba(111,99,66,0.58)');
    drawHeartMeter(heartCx, heartCy, heartSize, game.player.health, game.player.maxHealth);
    drawResourceChip(chipX, y + 12 * scale, chipW, chipH, 'action', game.apRemaining ?? game.player.apMax, scale);
    drawResourceChip(chipX, y + 42 * scale, chipW, chipH, 'move', game.speedRemaining ?? game.player.speedBase, scale);

    return width;
  }

  function drawSpellGlyph(cx, cy, size, disabled) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, size * 0.08);
    ctx.strokeStyle = disabled ? UI_THEME.textDim : UI_THEME.accent;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.18, cy + size * 0.18);
    ctx.lineTo(cx + size * 0.18, cy - size * 0.18);
    ctx.moveTo(cx - size * 0.2, cy - size * 0.18);
    ctx.lineTo(cx + size * 0.18, cy + size * 0.2);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  function drawSpellBar(x, y, availableW, slotSize, maxSlots, showLabel = true) {
    const game = state.game;
    const attacks = actions.getAvailableAttacks(game);
    const slotGap = Math.max(8, Math.floor(slotSize * 0.18));
    const slotCount = clamp(Math.floor((availableW + slotGap) / (slotSize + slotGap)), 3, maxSlots);
    const slotsY = y + (showLabel ? 22 : 0);
    let hoveredAttackSlot = null;

    if (showLabel) {
      beginStarPath(x + 8, y + 8, 6, 3);
      ctx.fillStyle = UI_THEME.textMuted;
      ctx.fill();
      draw.drawText('ACOES', x + 20, y + 13, {
        font: '800 12px Inter, sans-serif',
        color: UI_THEME.textMuted,
      });
    }

    for (let index = 0; index < slotCount; index += 1) {
      const sx = x + index * (slotSize + slotGap);
      const slot = { x: sx, y: slotsY, w: slotSize, h: slotSize };
      const hovered = layout.pointInRect(state.mouse.x, state.mouse.y, slot);
      const attack = attacks[index];
      const filled = !!attack;
      const selected = filled && game.selectedAttackId === attack.id;
      const attackDisabled = filled && (game.phase !== PHASES.HERO || game.busy || game.apRemaining < attack.apCost);
      const lacksAp = filled && game.phase === PHASES.HERO && !game.busy && game.apRemaining < attack.apCost;
      const fill = !filled
        ? 'rgba(23,25,18,0.48)'
        : selected
          ? UI_THEME.accentDark
          : hovered && !attackDisabled
            ? '#73501d'
            : lacksAp
              ? 'rgba(65,24,20,0.82)'
              : attackDisabled
                ? 'rgba(23,25,18,0.62)'
              : UI_THEME.surface1;
      const stroke = selected
        ? '#e6c06f'
        : filled && lacksAp
          ? UI_THEME.danger
          : filled
            ? UI_THEME.accent
            : UI_THEME.border0;

      draw.roundRect(sx, slotsY, slotSize, slotSize, Math.min(6, slotSize * 0.18), fill, stroke);

      if (filled) {
        const attackDamage = actions.getAttackDamage(attack, game.player);
        if (hovered) hoveredAttackSlot = { ...slot, attack, attackDamage, lacksAp };

        const iconPad = Math.max(2, Math.floor(slotSize * 0.06));
        ctx.save();
        ctx.globalAlpha = attackDisabled ? 0.68 : 1;
        const drewIcon = draw.drawImageCover(
          cardImages[attack.iconKey] || cardImages.actionStrike,
          sx + iconPad,
          slotsY + iconPad,
          slotSize - iconPad * 2,
          slotSize - iconPad * 2,
        );
        if (!drewIcon) {
          drawSpellGlyph(sx + slotSize / 2, slotsY + slotSize * 0.54, slotSize * 0.48, attackDisabled);
        }
        ctx.restore();

        if (lacksAp) {
          ctx.save();
          draw.roundRect(sx + 2, slotsY + 2, slotSize - 4, slotSize - 4, Math.min(5, slotSize * 0.14), 'rgba(185,71,53,0.24)', null);
          ctx.restore();
        }

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: () => actions.toggleAttackSelection(attack.id) });
        }
      } else {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(sx + slotSize / 2, slotsY + slotSize / 2, Math.max(2, slotSize * 0.06), 0, Math.PI * 2);
        ctx.fillStyle = UI_THEME.border0;
        ctx.fill();
        ctx.restore();
      }
    }

    if (hoveredAttackSlot) {
      const { attack, attackDamage, lacksAp } = hoveredAttackSlot;
      const waiting = game.phase !== PHASES.HERO || game.busy;
      const text = waiting
        ? 'Aguarde sua vez.'
        : lacksAp
          ? `${attack.name}: precisa de ${attack.apCost} AP.`
          : `${attack.name}: ${attack.apCost} AP, ${attackDamage} dano.`;
      ctx.save();
      ctx.font = '800 11px Inter, sans-serif';
      const tipW = Math.min(220, Math.max(132, ctx.measureText(text).width + 18));
      const tipH = 24;
      const screenW = layout.getLayout?.().sw || window.innerWidth || 9999;
      const xPos = clamp(hoveredAttackSlot.x + hoveredAttackSlot.w / 2 - tipW / 2, 8, screenW - tipW - 8);
      const yPos = Math.max(8, hoveredAttackSlot.y - tipH - 8);
      draw.roundRect(xPos, yPos, tipW, tipH, 5, 'rgba(7,8,7,0.94)', lacksAp ? UI_THEME.danger : UI_THEME.accent);
      draw.drawText(text, xPos + tipW / 2, yPos + 16, {
        align: 'center',
        font: '800 11px Inter, sans-serif',
        color: UI_THEME.text,
      });
      ctx.restore();
    }
  }

  function drawIconImage(iconKey, x, y, size, fallback, tint = UI_THEME.accent) {
    ctx.save();
    draw.roundRect(x, y, size, size, Math.min(6, size * 0.14), 'rgba(7,8,7,0.32)', null);
    ctx.clip();
    const drew = draw.drawImageCover(cardImages[iconKey], x, y, size, size);
    ctx.restore();

    if (!drew) {
      draw.drawText(fallback, x + size / 2, y + size / 2 + size * 0.16, {
        align: 'center',
        font: `900 ${Math.floor(size * 0.46)}px Inter, sans-serif`,
        color: tint,
      });
    }
  }

  function drawSmallTooltip(text, anchor, accent = UI_THEME.accent) {
    ctx.save();
    ctx.font = '800 11px Inter, sans-serif';
    const tipW = Math.min(240, Math.max(132, ctx.measureText(text).width + 18));
    const tipH = 24;
    const screenW = layout.getLayout?.().sw || window.innerWidth || 9999;
    const xPos = clamp(anchor.x + anchor.w / 2 - tipW / 2, 8, screenW - tipW - 8);
    const yPos = Math.max(8, anchor.y - tipH - 8);

    draw.roundRect(xPos, yPos, tipW, tipH, 5, 'rgba(7,8,7,0.94)', accent);
    draw.drawText(text, xPos + tipW / 2, yPos + 16, {
      align: 'center',
      font: '800 11px Inter, sans-serif',
      color: UI_THEME.text,
    });
    ctx.restore();
  }

  function drawOverworldMenuBar(x, y, availableW, slotSize, maxSlots, showLabel = true) {
    const slotGap = Math.max(8, Math.floor(slotSize * 0.18));
    const slotCount = clamp(Math.floor((availableW + slotGap) / (slotSize + slotGap)), 3, maxSlots);
    const slotsY = y + (showLabel ? 22 : 0);
    const menuItems = [
      {
        label: 'Características',
        iconKey: 'characteristics',
        fallback: 'C',
        onClick: actions.openCharacteristicsModal,
      },
      {
        label: 'Feitiços',
        iconKey: 'spells',
        fallback: 'F',
        onClick: actions.openSpellsModal,
      },
    ];
    let hoveredMenuSlot = null;

    if (showLabel) {
      beginStarPath(x + 8, y + 8, 6, 3);
      ctx.fillStyle = UI_THEME.textMuted;
      ctx.fill();
      draw.drawText('MENU', x + 20, y + 13, {
        font: '800 12px Inter, sans-serif',
        color: UI_THEME.textMuted,
      });
    }

    for (let index = 0; index < slotCount; index += 1) {
      const sx = x + index * (slotSize + slotGap);
      const slot = { x: sx, y: slotsY, w: slotSize, h: slotSize };
      const item = menuItems[index] || null;
      const hovered = layout.pointInRect(state.mouse.x, state.mouse.y, slot);
      const filled = !!item;
      const fill = !filled
        ? 'rgba(23,25,18,0.48)'
        : hovered
          ? '#73501d'
          : UI_THEME.surface1;
      const stroke = filled ? UI_THEME.accent : UI_THEME.border0;

      draw.roundRect(sx, slotsY, slotSize, slotSize, Math.min(6, slotSize * 0.18), fill, stroke);

      if (filled) {
        if (hovered) hoveredMenuSlot = { ...slot, label: item.label };
        const iconPad = Math.max(2, Math.floor(slotSize * 0.06));
        drawIconImage(
          item.iconKey,
          sx + iconPad,
          slotsY + iconPad,
          slotSize - iconPad * 2,
          item.fallback,
          UI_THEME.accent
        );
        state.game.buttons.push({ ...slot, onClick: item.onClick });
      } else {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(sx + slotSize / 2, slotsY + slotSize / 2, Math.max(2, slotSize * 0.06), 0, Math.PI * 2);
        ctx.fillStyle = UI_THEME.border0;
        ctx.fill();
        ctx.restore();
      }
    }

    if (hoveredMenuSlot && !state.game.activeModal) {
      drawSmallTooltip(hoveredMenuSlot.label, hoveredMenuSlot, UI_THEME.accent);
    }
  }

  function drawOverworldBottomUI(currentLayout) {
    const slotWidth = (slotSize, slotCount) => {
      const gap = Math.max(8, Math.floor(slotSize * 0.18));
      return slotCount * slotSize + Math.max(0, slotCount - 1) * gap;
    };

    const margin = currentLayout.compact ? 8 : 18;
    const panelPad = currentLayout.compact ? 10 : 18;
    const panelMaxW = Math.min(currentLayout.sw - margin * 2, currentLayout.compact ? 520 : 620);
    const panelH = currentLayout.compact ? 82 : 96;
    const panelY = currentLayout.sh - panelH - margin;
    const centerY = panelY + panelH / 2;
    const hudScale = currentLayout.compact ? 0.72 : 0.88;
    const hudW = 166 * hudScale;
    const hudH = 76 * hudScale;
    const slotSize = currentLayout.compact ? 42 : 50;
    const hudGap = currentLayout.compact ? 10 : 22;
    let slotCount = currentLayout.compact ? 4 : 5;
    let menuW = slotWidth(slotSize, slotCount);
    let contentW = hudW + hudGap + menuW;

    while (slotCount > 3 && contentW + panelPad * 2 > panelMaxW) {
      slotCount -= 1;
      menuW = slotWidth(slotSize, slotCount);
      contentW = hudW + hudGap + menuW;
    }

    const panelW = Math.min(panelMaxW, contentW + panelPad * 2);
    const panelX = Math.round((currentLayout.sw - panelW) / 2);
    const contentX = panelX + Math.max(panelPad, Math.floor((panelW - contentW) / 2));
    const hudX = contentX;
    const menuX = hudX + hudW + hudGap;

    draw.roundRect(panelX, panelY, panelW, panelH, 10, UI_THEME.surface0, UI_THEME.border0);
    drawPlayerResourceHud(hudX, centerY - hudH / 2, hudScale);
    drawOverworldMenuBar(menuX, centerY - slotSize / 2 - (currentLayout.compact ? 0 : 22), menuW, slotSize, slotCount, !currentLayout.compact);

    return { x: panelX, y: panelY, w: panelW, h: panelH };
  }

  function characteristicValueText(definition, points, player) {
    if (definition.key === 'life') {
      const lifeBonus = points * XP_RULES.LIFE_PER_POINT;
      return `${player.maxHealth} PV | +${lifeBonus}`;
    }

    const damageBonus = points * XP_RULES.ELEMENT_DAMAGE_PER_POINT;
    return `${points} pts | dano +${damageBonus}`;
  }

  function drawModalBackdrop(currentLayout) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(0, 0, currentLayout.sw, currentLayout.sh);
    ctx.restore();
  }

  function drawCharacteristicsModal(currentLayout) {
    const game = state.game;
    const player = game.player;
    const xp = actions.getXpProgress(player);
    const compact = currentLayout.compact;
    const modalW = Math.min(currentLayout.sw - 24, compact ? 430 : 620);
    const modalH = Math.min(currentLayout.sh - 24, compact ? 566 : 540);
    const x = Math.round((currentLayout.sw - modalW) / 2);
    const y = Math.round((currentLayout.sh - modalH) / 2);
    const pad = compact ? 16 : 22;
    const portraitSize = compact ? 82 : 112;
    const headerX = x + pad + portraitSize + 18;
    const headerW = modalW - pad * 2 - portraitSize - 18;
    const xpBarW = Math.max(120, headerW);
    const xpBarH = 12;
    const rowTop = y + (compact ? 172 : 196);
    const rowH = compact ? 56 : 58;
    const rowGap = compact ? 8 : 10;
    const rowW = modalW - pad * 2;

    drawModalBackdrop(currentLayout);
    draw.roundRect(x, y, modalW, modalH, 10, UI_THEME.overlay, UI_THEME.border1);
    draw.drawText('Características', x + pad, y + 32, {
      font: '900 20px Inter, sans-serif',
      color: UI_THEME.text,
    });
    draw.drawButton(x + modalW - pad - 30, y + 12, 30, 28, 'X', actions.closeActiveModal, {
      fill: UI_THEME.surface1,
      hoverFill: UI_THEME.surface2,
      stroke: UI_THEME.border1,
      font: '900 13px Inter, sans-serif',
    });

    draw.roundRect(x + pad, y + 56, portraitSize, portraitSize, 8, UI_THEME.surface0, UI_THEME.accent);
    ctx.save();
    draw.roundRect(x + pad + 4, y + 60, portraitSize - 8, portraitSize - 8, 6, null, null);
    ctx.clip();
    const drewPortrait = draw.drawImageCover(getPlayerCardImage(game), x + pad + 4, y + 60, portraitSize - 8, portraitSize - 8);
    ctx.restore();
    if (!drewPortrait) {
      draw.drawText('P', x + pad + portraitSize / 2, y + 56 + portraitSize / 2 + 14, {
        align: 'center',
        font: '900 44px Inter, sans-serif',
        color: UI_THEME.accent,
      });
    }

    draw.drawText(getPlayerName(game), headerX, y + 76, {
      font: '900 18px Inter, sans-serif',
      color: UI_THEME.text,
      maxWidth: headerW,
    });
    draw.drawText(`Nível ${xp.level} | Pontos ${player.characteristicPoints}`, headerX, y + 102, {
      font: '800 13px Inter, sans-serif',
      color: UI_THEME.accent,
      maxWidth: headerW,
    });
    draw.drawText(`Vida ${player.health}/${player.maxHealth}`, headerX, y + 126, {
      font: '800 13px Inter, sans-serif',
      color: UI_THEME.textMuted,
      maxWidth: headerW,
    });

    const xpY = y + 148;
    draw.roundRect(headerX, xpY, xpBarW, xpBarH, xpBarH / 2, 'rgba(7,8,7,0.72)', UI_THEME.border0);
    draw.roundRect(headerX + 2, xpY + 2, Math.max(0, (xpBarW - 4) * xp.progress), xpBarH - 4, (xpBarH - 4) / 2, UI_THEME.accent, null);
    draw.drawText(`XP ${xp.progressXp}/${xp.requiredXp}`, headerX, xpY + 30, {
      font: '800 12px Inter, sans-serif',
      color: UI_THEME.textMuted,
      maxWidth: headerW,
    });

    Object.values(CHARACTERISTIC_DEFINITIONS).forEach((definition, index) => {
      const rowY = rowTop + index * (rowH + rowGap);
      const points = player.characteristics?.[definition.key] || 0;
      const canSpend = player.characteristicPoints > 0;
      const iconSize = rowH - 14;
      const iconX = x + pad + 8;
      const textX = iconX + iconSize + 14;
      const buttonSize = 34;
      const buttonX = x + pad + rowW - buttonSize - 10;

      draw.roundRect(x + pad, rowY, rowW, rowH, 8, 'rgba(23,25,18,0.84)', UI_THEME.border0);
      draw.roundRect(x + pad + 3, rowY + 3, 5, rowH - 6, 3, definition.color, null);
      drawIconImage(definition.iconKey, iconX, rowY + 7, iconSize, definition.label[0], definition.color);
      draw.drawText(definition.label, textX, rowY + 24, {
        font: '900 14px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawText(characteristicValueText(definition, points, player), textX, rowY + 45, {
        font: '800 12px Inter, sans-serif',
        color: UI_THEME.textMuted,
        maxWidth: buttonX - textX - 12,
      });
      draw.drawButton(buttonX, rowY + (rowH - buttonSize) / 2, buttonSize, buttonSize, '+', () => {
        actions.allocateCharacteristic(definition.key);
      }, {
        fill: definition.color,
        hoverFill: UI_THEME.accent,
        stroke: '#e6c06f',
        disabled: !canSpend,
        font: '900 20px Inter, sans-serif',
      });
    });
  }

  function drawCrossRangeIcon(x, y, size, color, disabled = false) {
    const cell = Math.max(3, Math.floor(size / 3));
    const gap = Math.max(1, Math.floor(size * 0.08));
    const startX = x + Math.round((size - cell * 3 - gap * 2) / 2);
    const startY = y + Math.round((size - cell * 3 - gap * 2) / 2);
    const squares = [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ];

    ctx.save();
    ctx.globalAlpha = disabled ? 0.62 : 1;
    ctx.fillStyle = disabled ? UI_THEME.textDim : color;
    squares.forEach(([col, row]) => {
      draw.roundRect(
        startX + col * (cell + gap),
        startY + row * (cell + gap),
        cell,
        cell,
        Math.max(1, Math.floor(cell * 0.22)),
        ctx.fillStyle,
        null,
      );
    });
    ctx.restore();
  }

  function drawSpellsModal(currentLayout) {
    const game = state.game;
    const compact = currentLayout.compact;
    const selectedAttack = actions.getSelectedAttack(game) || actions.getEquippedAttack(game);
    const spellRows = actions.getPlayerSpellbook(game.player).map((spell) => {
      const elementMeta = SPELL_ELEMENT_META[spell.element] || SPELL_ELEMENT_META.neutral;
      const damage = actions.getAttackDamage(spell, game.player);
      const range = actions.getAttackRangeLabel(spell, game.player);
      const cross = spell.pattern === ATTACK_PATTERNS.CROSS;

      return {
        ...spell,
        color: elementMeta.color,
        elementLabel: elementMeta.label,
        damage,
        range,
        cross,
        value: `${elementMeta.label} | ${spell.apCost} AP | ${damage} dano`,
        detail: cross ? `Alcance ${range} | em cruz` : `Alcance ${range}`,
      };
    });
    const modalW = Math.min(currentLayout.sw - 24, compact ? 430 : 620);
    const pad = compact ? 16 : 22;
    const iconSize = compact ? 82 : 112;
    const rowTopOffset = compact ? 170 : 186;
    const preferredRowH = compact ? 68 : 72;
    const preferredRowGap = compact ? 8 : 10;
    const preferredRowsH = spellRows.length * preferredRowH + (spellRows.length - 1) * preferredRowGap;
    const modalH = Math.min(
      currentLayout.sh - 24,
      Math.max(compact ? 380 : 420, rowTopOffset + preferredRowsH + pad),
    );
    const x = Math.round((currentLayout.sw - modalW) / 2);
    const y = Math.round((currentLayout.sh - modalH) / 2);
    const headerX = x + pad + iconSize + 18;
    const headerW = modalW - pad * 2 - iconSize - 18;
    const rowTop = y + rowTopOffset;
    const availableRowsH = modalH - rowTopOffset - pad;
    const rowGap = availableRowsH < preferredRowsH ? (compact ? 6 : 8) : preferredRowGap;
    const rowH = Math.floor((availableRowsH - (spellRows.length - 1) * rowGap) / spellRows.length);
    const rowW = modalW - pad * 2;

    drawModalBackdrop(currentLayout);
    draw.roundRect(x, y, modalW, modalH, 10, UI_THEME.overlay, UI_THEME.border1);
    draw.drawText('Feitiços', x + pad, y + 32, {
      font: '900 20px Inter, sans-serif',
      color: UI_THEME.text,
    });
    draw.drawButton(x + modalW - pad - 30, y + 12, 30, 28, 'X', actions.closeActiveModal, {
      fill: UI_THEME.surface1,
      hoverFill: UI_THEME.surface2,
      stroke: UI_THEME.border1,
      font: '900 13px Inter, sans-serif',
    });

    draw.roundRect(x + pad, y + 56, iconSize, iconSize, 8, UI_THEME.surface0, UI_THEME.accent);
    drawIconImage('spells', x + pad + 4, y + 60, iconSize - 8, 'F', UI_THEME.accent);

    draw.drawText(getPlayerName(game), headerX, y + 78, {
      font: '900 18px Inter, sans-serif',
      color: UI_THEME.text,
      maxWidth: headerW,
    });
    draw.drawText('Grimório', headerX, y + 106, {
      font: '800 13px Inter, sans-serif',
      color: UI_THEME.accent,
      maxWidth: headerW,
    });
    draw.drawText(`Feitiço equipado: ${selectedAttack.name}`, headerX, y + 132, {
      font: '800 13px Inter, sans-serif',
      color: UI_THEME.textMuted,
      maxWidth: headerW,
    });

    spellRows.forEach((spell, index) => {
      const rowY = rowTop + index * (rowH + rowGap);
      const rowAlpha = spell.locked ? 0.62 : index === 0 ? 0.88 : 0.76;
      const smallIcon = Math.min(rowH - 14, 56);
      const iconX = x + pad + 8;
      const textX = iconX + smallIcon + 14;
      const rangeChipW = spell.cross ? 78 : 0;
      const rangeChipX = x + pad + rowW - rangeChipW - 12;
      const textMaxW = rowW - smallIcon - 34 - rangeChipW;
      const titleColor = spell.locked ? UI_THEME.textDim : UI_THEME.text;
      const valueColor = spell.locked ? UI_THEME.textDim : UI_THEME.textMuted;
      const rowFill = spell.locked ? `rgba(18,18,17,${rowAlpha})` : `rgba(23,25,18,${rowAlpha})`;
      const rowStroke = spell.locked ? 'rgba(143,135,115,0.38)' : UI_THEME.border0;
      const stripeColor = spell.locked ? 'rgba(143,135,115,0.82)' : spell.color;

      draw.roundRect(x + pad, rowY, rowW, rowH, 8, rowFill, rowStroke);
      draw.roundRect(x + pad + 3, rowY + 3, 5, rowH - 6, 3, stripeColor, null);
      ctx.save();
      if (spell.locked) {
        ctx.filter = 'grayscale(1)';
        ctx.globalAlpha = 0.62;
      }
      drawIconImage(spell.iconKey, iconX, rowY + (rowH - smallIcon) / 2, smallIcon, spell.name[0], spell.color);
      ctx.restore();
      draw.drawText(spell.name, textX, rowY + 24, {
        font: '900 14px Inter, sans-serif',
        color: titleColor,
      });
      draw.drawText(spell.locked ? `Bloqueado | libera no nível ${spell.unlockLevel}` : spell.value, textX, rowY + 45, {
        font: '800 12px Inter, sans-serif',
        color: valueColor,
        maxWidth: textMaxW,
      });
      draw.drawText(spell.locked ? spell.value : spell.detail, textX, rowY + 63, {
        font: '800 11px Inter, sans-serif',
        color: spell.locked ? 'rgba(143,135,115,0.76)' : UI_THEME.textDim,
        maxWidth: textMaxW,
      });

      if (spell.cross) {
        draw.roundRect(rangeChipX, rowY + (rowH - 34) / 2, rangeChipW, 34, 7, 'rgba(7,8,7,0.36)', spell.locked ? 'rgba(143,135,115,0.32)' : 'rgba(108,171,79,0.45)');
        drawCrossRangeIcon(rangeChipX + 8, rowY + (rowH - 22) / 2, 22, spell.color, spell.locked);
        draw.drawText(spell.range, rangeChipX + 53, rowY + rowH / 2 + 4, {
          align: 'center',
          font: '900 12px Inter, sans-serif',
          color: spell.locked ? UI_THEME.textDim : UI_THEME.text,
        });
      }
    });
  }

  function drawLevelUpModal(currentLayout) {
    const notice = state.game.levelUpNotice || { levelsGained: 1, pointsGained: XP_RULES.POINTS_PER_LEVEL };
    const modalW = Math.min(currentLayout.sw - 24, 420);
    const modalH = 230;
    const x = Math.round((currentLayout.sw - modalW) / 2);
    const y = Math.round((currentLayout.sh - modalH) / 2);
    const pad = 24;

    drawModalBackdrop(currentLayout);
    draw.roundRect(x, y, modalW, modalH, 10, UI_THEME.overlay, UI_THEME.accent);
    draw.drawText('Você passou de nível', x + modalW / 2, y + 46, {
      align: 'center',
      font: '900 22px Inter, sans-serif',
      color: UI_THEME.text,
    });
    draw.drawText(`Nível ${state.game.player.level}`, x + modalW / 2, y + 82, {
      align: 'center',
      font: '900 28px Inter, sans-serif',
      color: UI_THEME.accent,
    });
    draw.drawText(`+${notice.pointsGained} pontos de característica`, x + modalW / 2, y + 114, {
      align: 'center',
      font: '800 14px Inter, sans-serif',
      color: UI_THEME.textMuted,
    });

    const buttonW = (modalW - pad * 2 - 12) / 2;
    const buttonY = y + modalH - 66;
    draw.drawButton(x + pad, buttonY, buttonW, 42, 'Características', actions.openCharacteristicsModal, {
      fill: UI_THEME.accentDark,
      hoverFill: UI_THEME.accent,
      stroke: '#e6c06f',
      font: '900 13px Inter, sans-serif',
    });
    draw.drawButton(x + pad + buttonW + 12, buttonY, buttonW, 42, 'Continuar', actions.closeActiveModal, {
      fill: UI_THEME.surface1,
      hoverFill: UI_THEME.surface2,
      stroke: UI_THEME.border1,
      font: '900 13px Inter, sans-serif',
    });
  }

  function drawActiveModal(currentLayout) {
    if (!state.game.activeModal) return;
    state.game.buttons = [];

    if (state.game.activeModal === 'characteristics') {
      drawCharacteristicsModal(currentLayout);
      return;
    }

    if (state.game.activeModal === 'spells') {
      drawSpellsModal(currentLayout);
      return;
    }

    if (state.game.activeModal === 'levelUp') {
      drawLevelUpModal(currentLayout);
    }
  }

  function turnQueueEntries(game) {
    const ids = ['player', ...game.monsters.map((monster) => monster.id)];

    return ids.map((entityId) => {
      if (entityId === 'player') {
        return {
          id: 'player',
          name: getPlayerName(game),
          hp: game.player.health,
          maxHp: game.player.maxHealth,
          image: getPlayerCardImage(game),
          fallback: 'P',
          tint: UI_THEME.success,
        };
      }

      const monster = game.monsters.find((currentMonster) => currentMonster.id === entityId);
      if (!monster) return null;
      return {
        id: monster.id,
        name: monster.name,
        hp: monster.hp,
        maxHp: monster.maxHp,
        image: cardImages[monster.type] || null,
        fallback: 'M',
        tint: monster.tint,
      };
    }).filter(Boolean);
  }

  function drawTurnQueuePortrait(entry, x, y, size, radius) {
    const image = entry.image;

    ctx.save();
    draw.roundRect(x, y, size, size, radius, 'rgba(7,8,7,0.42)', null);
    ctx.clip();

    const drew = draw.drawImageCover(image, x, y, size, size);
    if (!drew) {
      draw.drawText(entry.fallback || '?', x + size / 2, y + size / 2 + 1, {
        align: 'center',
        baseline: 'middle',
        font: `900 ${Math.floor(size * 0.5)}px Inter, sans-serif`,
        color: UI_THEME.text,
      });
    }

    ctx.restore();
  }

  function turnQueueWidth(game, itemSize, gap) {
    const entryCount = turnQueueEntries(game).length;
    return (entryCount + 1) * itemSize + entryCount * gap + 8;
  }

  function drawTurnQueueHpBar(x, y, w, h, hp, maxHp) {
    const ratio = maxHp > 0 ? clamp(hp / maxHp, 0, 1) : 0;
    const fillColor = UI_THEME.danger;
    const fillTop = '#cf6b55';
    const trackRadius = 2;

    draw.roundRect(x, y, w, h, trackRadius, 'rgba(41,18,15,0.92)', 'rgba(185,71,53,0.22)');

    const innerPad = 1;
    const innerX = x + innerPad;
    const innerY = y + innerPad;
    const innerW = Math.max(0, w - innerPad * 2);
    const innerH = Math.max(0, h - innerPad * 2);
    const fillH = Math.max(0, innerH * ratio);

    if (fillH > 0) {
      const fillY = innerY + innerH - fillH;
      const gradient = ctx.createLinearGradient(innerX, fillY, innerX, fillY + fillH);
      gradient.addColorStop(0, fillTop);
      gradient.addColorStop(1, fillColor);

      ctx.save();
      draw.roundRect(innerX, innerY, innerW, innerH, Math.max(1, Math.min(innerW, innerH) / 2), null, null);
      ctx.clip();
      ctx.fillStyle = gradient;
      ctx.fillRect(innerX, fillY, innerW, fillH);
      ctx.restore();
    }
  }

  function drawTurnQueue(x, y, itemSize, gap, now, compact = false) {
    const game = state.game;
    const entries = turnQueueEntries(game);
    if (entries.length === 0) return;

    const clockW = itemSize;
    const clockH = itemSize;
    const cardRadius = compact ? 4 : 5;
    draw.roundRect(x, y, clockW, clockH, cardRadius, 'rgba(23,25,18,0.88)', UI_THEME.border0);
    draw.drawText(String(game.turnCount), x + itemSize * 0.28, y + itemSize / 2 + 1, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(itemSize * 0.34)}px Inter, sans-serif`,
      color: UI_THEME.text,
    });
    drawClockIcon(x + itemSize * 0.73, y + itemSize / 2, Math.max(4, itemSize * 0.17), '#d9c894');

    let currentX = x + clockW + gap;
    for (const entry of entries) {
      const isCurrent = entry.id === game.turnQueue?.[0];
      const bx = currentX;
      const cardX = bx;
      const cardY = y;
      const cardSize = itemSize;
      const hpBarW = compact ? 3 : 4;
      const contentPad = compact ? 2 : 3;
      const hpBarH = Math.max(10, cardSize - (compact ? 6 : 8));
      const hpBarX = cardX + cardSize - hpBarW - contentPad;
      const hpBarY = cardY + Math.floor((cardSize - hpBarH) / 2);
      const fill = isCurrent ? 'rgba(154,122,50,0.34)' : 'rgba(23,25,18,0.78)';
      const stroke = isCurrent ? UI_THEME.accent : UI_THEME.border0;

      draw.roundRect(cardX, cardY, cardSize, cardSize, cardRadius, fill, stroke);
      drawTurnQueuePortrait(
        entry,
        cardX + 2,
        cardY + 2,
        cardSize - 4,
        Math.max(3, cardRadius - 1),
      );
      draw.roundRect(cardX, cardY, cardSize, cardSize, cardRadius, null, stroke);
      drawTurnQueueHpBar(hpBarX, hpBarY, hpBarW, hpBarH, entry.hp, entry.maxHp);

      currentX += itemSize + gap;
    }
  }

  function drawDesktopTurnQueue(currentLayout, now) {
    if (currentLayout.compact) return;

    const game = state.game;
    const itemSize = 48;
    const gap = 8;
    const width = turnQueueWidth(game, itemSize, gap);
    const x = currentLayout.boardX + currentLayout.boardW / 2 - width / 2;
    const y = Math.max(18, currentLayout.boardY - 112);

    drawTurnQueue(x, y, itemSize, gap, now, false);
  }

  function drawCombatBottomUI(currentLayout, now = performance.now()) {
    const slotWidth = (slotSize, slotCount) => {
      const gap = Math.max(8, Math.floor(slotSize * 0.18));
      return slotCount * slotSize + Math.max(0, slotCount - 1) * gap;
    };

    if (currentLayout.compact) {
      const panelMargin = 8;
      const panelPad = 10;
      const panelW = Math.min(currentLayout.sw - panelMargin * 2, 520);
      const panelH = 132;
      const panelX = Math.round((currentLayout.sw - panelW) / 2);
      const panelY = currentLayout.sh - panelH - panelMargin;
      const hudScale = 0.74;
      const hudW = 166 * hudScale;
      const hudH = 76 * hudScale;
      const slotSize = 39;
      const spellW = Math.min(slotWidth(slotSize, 4), panelW - panelPad * 2 - hudW - 10);
      const topGap = 10;
      const topContentW = hudW + topGap + spellW;
      const topX = panelX + Math.max(panelPad, Math.floor((panelW - topContentW) / 2));
      const topCenterY = panelY + 40;
      const bottomCenterY = panelY + 102;
      const queueItem = 29;
      const queueGap = 5;
      const queueW = turnQueueWidth(state.game, queueItem, queueGap);
      const btnW = Math.min(156, Math.max(132, panelW * 0.44));
      const bottomGap = 18;
      const bottomContentW = queueW + bottomGap + btnW;
      const bottomX = panelX + Math.max(panelPad, Math.floor((panelW - bottomContentW) / 2));

      draw.roundRect(panelX, panelY, panelW, panelH, 9, UI_THEME.surface0, UI_THEME.border0);
      drawPlayerResourceHud(topX, topCenterY - hudH / 2, hudScale);
      drawSpellBar(topX + hudW + topGap, topCenterY - slotSize / 2, spellW, slotSize, 4, false);

      drawTurnQueue(bottomX, bottomCenterY - queueItem / 2, queueItem, queueGap, now, true);
      drawHeroTurnControl(bottomX + queueW + bottomGap, bottomCenterY - 29, btnW, now, true);
      return;
    }

    const availableScreenW = currentLayout.sw - 32;
    const tight = availableScreenW < 760;
    const panelPad = tight ? 14 : 18;
    const panelMaxW = Math.min(availableScreenW, tight ? availableScreenW : 860);
    const panelH = tight ? 88 : 96;
    const panelY = currentLayout.sh - panelH - 18;
    const centerY = panelY + panelH / 2;
    const hudScale = tight ? 0.74 : 0.88;
    const hudW = 166 * hudScale;
    const hudH = 76 * hudScale;
    const btnW = tight ? 162 : 182;
    const slotSize = tight ? 40 : 46;
    const hudGap = tight ? 16 : 22;
    const buttonGap = tight ? 20 : 30;
    let slotCount = 6;
    let spellW = slotWidth(slotSize, slotCount);
    let contentW = hudW + hudGap + spellW + buttonGap + btnW;

    while (slotCount > 3 && contentW + panelPad * 2 > panelMaxW) {
      slotCount -= 1;
      spellW = slotWidth(slotSize, slotCount);
      contentW = hudW + hudGap + spellW + buttonGap + btnW;
    }

    const panelW = Math.min(panelMaxW, contentW + panelPad * 2);
    const panelX = Math.round((currentLayout.sw - panelW) / 2);
    const contentX = panelX + Math.max(panelPad, Math.floor((panelW - contentW) / 2));
    const hudX = contentX;
    const spellX = hudX + hudW + hudGap;
    const btnX = spellX + spellW + buttonGap;

    draw.roundRect(panelX, panelY, panelW, panelH, 10, UI_THEME.surface0, UI_THEME.border0);
    drawPlayerResourceHud(hudX, centerY - hudH / 2, hudScale);
    drawSpellBar(spellX, centerY - slotSize / 2 - 22, spellW, slotSize, slotCount, true);
    drawHeroTurnControl(btnX, centerY - 35, btnW, now, false);
  }

  function drawSelectedEntityModal(currentLayout) {
    const game = state.game;
    const playerSelected = !!layout.hoveredPlayer();
    const monster = playerSelected ? null : layout.hoveredMonster();
    if (!playerSelected && !monster) return;

    const tile = playerSelected ? game.player : monster;

    const rect = layout.tileRect(currentLayout, tile.x, tile.y);
    const totals = actions.getTotals();
    const image = playerSelected ? getPlayerCardImage(game) : cardImages[monster.type];
    const title = playerSelected ? getPlayerName(game) : monster.name;
    const titleIcon = playerSelected ? '🧙' : monster.emoji;
    const attackLine = totals.attackLifeSteal > 0
      ? `Ataque ${totals.attack} | suga ${totals.attackLifeSteal}`
      : `Ataque ${totals.attack}`;
    const lines = playerSelected
      ? [
          `Vida ${game.player.health}/${game.player.maxHealth}`,
          `AP ${game.apRemaining}/${game.player.apMax} | ${totals.attackName} custa ${totals.attackCost} AP`,
          `Movimento ${game.speedRemaining}/${game.player.speedBase} | só em cruz`,
          attackLine,
          `Defesa ${totals.defense}`,
          `Alcance ${totals.range}`,
        ]
      : [
          `Vida ${monster.hp}/${monster.maxHp}`,
          `Ataque ${monster.attack}`,
          `Defesa ${monster.defense}`,
          `Alcance ${monster.range}`,
          `Velocidade ${monster.speed}`,
        ];

    const cardW = 110;
    const cardH = 146;
    const width = currentLayout.leftW - 32;
    const height = playerSelected ? 224 : 200;
    let x = currentLayout.leftX + 16;
    let y = currentLayout.leftY + currentLayout.leftH - height - 16;

    draw.roundRect(x, y, width, height, 8, UI_THEME.overlay, UI_THEME.border1);
    draw.roundRect(x + 12, y + 27, cardW, cardH, 8, UI_THEME.surface0, '#d6a85c');

    ctx.save();
    draw.roundRect(x + 16, y + 31, cardW - 8, cardH - 8, 6, null, null);
    ctx.clip();

    const drew = draw.drawImageCover(image, x + 16, y + 31, cardW - 8, cardH - 8);
    if (!drew) {
      draw.drawText(titleIcon, x + 16 + cardW / 2, y + 31 + cardH / 2 + 15, {
        align: 'center',
        font: '46px Inter, sans-serif',
      });
    }

    ctx.restore();

    const textX = x + cardW + 24;
    draw.drawText(`${titleIcon} ${title}`, textX, y + 46, {
      font: 'bold 16px Inter, sans-serif',
      color: UI_THEME.text,
    });

    const icons = playerSelected
      ? ['❤️', '🏃', '⚔️', '🛡️', '🎯']
      : ['❤️', '⚔️', '🛡️', '🎯', '🏃'];

    for (let index = 0; index < lines.length; index += 1) {
      draw.drawText(icons[index] || '', textX + 2, y + 80 + index * 22, {
        font: '14px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawText(lines[index], textX + 26, y + 80 + index * 22, {
        font: '13px Inter, sans-serif',
        color: UI_THEME.textMuted,
        maxWidth: width - cardW - 32,
      });
    }
  }

  function screenPointForTile(currentLayout, x, y, height = 1) {
    const projected = threeBoard.screenPositionForTile?.(currentLayout, x, y, height);
    if (projected) return projected;

    const rect = layout.tileRect(currentLayout, x, y);
    return {
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    };
  }

  function drawHoveredEntityTooltip(currentLayout) {
    const game = state.game;
    const playerHovered = !!layout.hoveredPlayer();
    const monster = playerHovered ? null : layout.hoveredMonster();
    if (!playerHovered && !monster) return;

    const entity = playerHovered ? game.player : monster;
    const name = playerHovered ? getPlayerName(game) : monster.name;
    const hp = playerHovered ? game.player.health : monster.hp;
    const point = screenPointForTile(currentLayout, entity.x, entity.y, 1.28);
    const label = `${name} | ${hp} \u2665`;

    ctx.save();
    ctx.font = '800 13px Inter, sans-serif';
    const width = Math.min(currentLayout.sw - 24, Math.max(118, ctx.measureText(label).width + 26));
    const height = 30;
    const x = clamp(point.x - width / 2, 12, currentLayout.sw - width - 12);
    const y = clamp(point.y - 34, 12, currentLayout.sh - height - 12);

    draw.roundRect(x, y, width, height, 6, 'rgba(7,8,7,0.92)', '#d9c894');
    draw.drawText(label, x + width / 2, y + 20, {
      align: 'center',
      font: '800 13px Inter, sans-serif',
      color: UI_THEME.text,
    });
    ctx.restore();
  }

  function drawFloatingTextAnimations(currentLayout, now) {
    state.game.animations.forEach((anim) => {
      if (anim.type !== 'floatingText' || now < anim.startTime) return;

      const progress = (now - anim.startTime) / anim.duration;
      const point = screenPointForTile(currentLayout, anim.x, anim.y, 1.18);
      const isDamage = anim.color === '#ef4444' || anim.color === UI_THEME.danger;
      const fontSize = isDamage ? 38 : 28;
      const lift = (isDamage ? 54 : 42) * progress;
      const cx = point.x;
      const cy = point.y - lift;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.pow(progress, 2.6));
      ctx.strokeStyle = 'rgba(23,25,18,0.92)';
      ctx.lineWidth = isDamage ? 7 : 5;
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(anim.text, cx, cy);
      ctx.fillStyle = anim.color;
      ctx.fillText(anim.text, cx, cy);
      ctx.restore();
    });
  }

  function drawBanner(currentLayout) {
    const banner = state.game.banner;
    if (!banner) return;

    const now = performance.now();
    const remaining = Math.max(0, banner.until - now);
    const alpha = Math.min(1, remaining / 250);

    const activeViewport = state.game.mode === GAME_MODES.OVERWORLD
      ? threeBoard.getViewport(currentLayout)
      : null;
    const cx = activeViewport
      ? activeViewport.x + activeViewport.w / 2
      : currentLayout.boardX + currentLayout.boardW / 2;
    const cy = activeViewport
      ? activeViewport.y + activeViewport.h / 2
      : currentLayout.boardY + currentLayout.boardH / 2;
    const hasCard = !!banner.cardKey;
    const panelW = hasCard ? Math.min(620, Math.max(480, currentLayout.boardW * 0.82)) : 520;
    const panelH = hasCard ? 176 : 148;
    const panelX = cx - panelW / 2;
    const panelY = hasCard ? cy - panelH / 2 + 16 : cy - 74;
    const accent = banner.accent || UI_THEME.accent;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (hasCard) {
      const cardImage = getBannerCardImage(banner, state.game);
      const cardW = 118;
      const cardH = 150;
      const cardX = panelX + 20;
      const cardY = panelY + (panelH - cardH) / 2;
      const textX = cardX + cardW + 24;
      const textW = panelW - (textX - panelX) - 20;

      draw.roundRect(panelX, panelY, panelW, panelH, 10, 'rgba(7,8,7,0.86)', accent);
      draw.roundRect(cardX - 8, cardY - 8, cardW + 16, cardH + 16, 8, 'rgba(0,0,0,0.35)', null);
      draw.roundRect(cardX, cardY, cardW, cardH, 8, UI_THEME.surface0, accent);

      ctx.save();
      draw.roundRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8, 6, null, null);
      ctx.clip();
      const drew = draw.drawImageCover(cardImage, cardX + 4, cardY + 4, cardW - 8, cardH - 8);
      if (!drew) {
        draw.drawText(banner.subtitle || banner.title, cardX + cardW / 2, cardY + cardH / 2 + 8, {
          align: 'center',
          font: 'bold 18px Inter, sans-serif',
          color: UI_THEME.text,
          maxWidth: cardW - 16,
        });
      }
      ctx.restore();

      draw.drawText(banner.title, textX, panelY + 62, {
        align: 'left',
        font: 'bold 30px Inter, sans-serif',
        color: UI_THEME.text,
        maxWidth: textW,
      });

      if (banner.subtitle) {
        draw.drawText(banner.subtitle, textX, panelY + 102, {
          align: 'left',
          font: '16px Inter, sans-serif',
          color: UI_THEME.textMuted,
          maxWidth: textW,
        });
      }
    } else {
      ctx.lineWidth = 3;
      draw.roundRect(panelX, panelY, panelW, panelH, 10, 'rgba(7,8,7,0.8)', accent);
      draw.drawText(banner.title, cx, cy - 12, {
        align: 'center',
        font: 'bold 32px Inter, sans-serif',
        color: UI_THEME.text,
      });

      if (banner.subtitle) {
        draw.drawText(banner.subtitle, cx, cy + 25, {
          align: 'center',
          font: '16px Inter, sans-serif',
          color: UI_THEME.textMuted,
        });
      }
    }

    ctx.restore();
  }

  function drawCarriedAttack() {
    const game = state.game;
    const attack = actions.getEquippedAttack(game);
    if (game.phase !== PHASES.HERO || game.busy || game.selectedAttackId !== attack.id) return;
    if (!layout.hoveredTile()) return;

    const size = 46;
    const currentLayout = layout.getLayout?.();
    const screenW = currentLayout?.sw || window.innerWidth || 9999;
    const screenH = currentLayout?.sh || window.innerHeight || 9999;
    const x = clamp(state.mouse.x + 18, 8, screenW - size - 8);
    const y = clamp(state.mouse.y + 18, 8, screenH - size - 8);
    const imagePad = 3;

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    draw.roundRect(x, y, size, size, 6, UI_THEME.accentDark, '#e6c06f');
    ctx.shadowColor = 'transparent';

    ctx.save();
    draw.roundRect(x + imagePad, y + imagePad, size - imagePad * 2, size - imagePad * 2, 5, null, null);
    ctx.clip();
    const drewIcon = draw.drawImageCover(
      cardImages.actionStrike,
      x + imagePad,
      y + imagePad,
      size - imagePad * 2,
      size - imagePad * 2,
    );
    if (!drewIcon) {
      drawSpellGlyph(x + size / 2, y + size / 2, size * 0.48, false);
    }
    ctx.restore();
    ctx.restore();
  }

  function drawEnergyFocusMask(currentLayout) {
    if (state.game.phase !== PHASES.ENERGY) return;

    const maskX = currentLayout.boardX - 18;
    const maskW = currentLayout.sw - maskX;
    const gradient = ctx.createLinearGradient(maskX, 0, currentLayout.sw, 0);
    gradient.addColorStop(0, 'rgba(13,15,11,0.54)');
    gradient.addColorStop(0.35, 'rgba(10,11,8,0.66)');
    gradient.addColorStop(1, 'rgba(7,8,7,0.78)');

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(maskX, 0, maskW, currentLayout.sh);
    ctx.restore();
  }

  function drawOverworldChat(currentLayout, bottomInset = 0) {
    const game = state.game;
    const log = (game.eventLog || []).slice(-4);
    if (!log || log.length === 0) return;

    const viewport = threeBoard.getViewport(currentLayout);
    const chatW = Math.min(280, viewport.w - 16);
    const lineH = 18;
    const padV = 8;
    const padH = 10;
    const chatH = log.length * lineH + padV * 2;
    const chatX = viewport.x + 8;
    const chatY = viewport.y + viewport.h - chatH - 10 - bottomInset;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(7, 8, 7, 0.34)';
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(chatX + r, chatY);
    ctx.lineTo(chatX + chatW - r, chatY);
    ctx.quadraticCurveTo(chatX + chatW, chatY, chatX + chatW, chatY + r);
    ctx.lineTo(chatX + chatW, chatY + chatH - r);
    ctx.quadraticCurveTo(chatX + chatW, chatY + chatH, chatX + chatW - r, chatY + chatH);
    ctx.lineTo(chatX + r, chatY + chatH);
    ctx.quadraticCurveTo(chatX, chatY + chatH, chatX, chatY + chatH - r);
    ctx.lineTo(chatX, chatY + r);
    ctx.quadraticCurveTo(chatX, chatY, chatX + r, chatY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    log.forEach((entry, i) => {
      const alpha = 0.45 + 0.55 * ((i + 1) / log.length);
      ctx.globalAlpha = alpha;
      ctx.font = `italic ${i === log.length - 1 ? 'bold ' : ''}12px Inter, sans-serif`;
      ctx.fillStyle = i === log.length - 1 ? UI_THEME.text : UI_THEME.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const ty = chatY + padV + i * lineH + lineH / 2;
      const maxW = chatW - padH * 2;
      const text = ctx.measureText(entry).width > maxW
        ? entry.slice(0, Math.floor(entry.length * maxW / ctx.measureText(entry).width) - 1) + '…'
        : entry;
      ctx.fillText(text, chatX + padH, ty);
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawOverworld(currentLayout, now) {
    const game = state.game;
    const overworld = game.overworld;
    if (!overworld) return;

    state.game.animations = state.game.animations.filter((anim) => isAnimationActive(anim, now));

    const worldMap = getCurrentWorldMap(overworld);
    const bounds = getCurrentWorldBounds(overworld);
    const objects = getCurrentWorldObjects(overworld);
    const reachable = actions.getOverworldReachableTiles();
    const hoverTile = layout.hoveredTile();
    const hoverEnemy = layout.hoveredOverworldEnemy();
    const hoverPath = hoverTile && reachable.has(posKey(hoverTile))
      ? reachable.get(posKey(hoverTile)).path
      : null;
    const moveHighlight = new Map();
    if (hoverTile && !hoverEnemy && reachable.has(posKey(hoverTile))) {
      moveHighlight.set(posKey(hoverTile), reachable.get(posKey(hoverTile)));
    }

    threeBoard.render({
      currentLayout,
      boardWidth: bounds.width,
      boardHeight: bounds.height,
      walls: new Set(),
      objects,
      connections: worldMap.connections,
      hoverTile,
      hoverPath: hoverEnemy ? null : hoverPath,
      reachable: moveHighlight,
      playerAttackTiles: new Set(),
      monsterReachable: new Map(),
      monsterAttackTiles: new Set(),
      now,
    });

    const background = ctx.createLinearGradient(0, 0, 0, currentLayout.sh);
    background.addColorStop(0, UI_THEME.bg2);
    background.addColorStop(0.55, UI_THEME.bg1);
    background.addColorStop(1, UI_THEME.bg0);

    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, currentLayout.sw, currentLayout.sh);

    clearThreeBoardViewport(currentLayout);

    drawMenu(currentLayout);
    draw.drawButton(currentLayout.sw - 48, 16, 32, 32, '⚙️', () => {
      state.game.menuOpen = !state.game.menuOpen;
      state.game.menuView = 'main';
    }, {
      fill: UI_THEME.surface0, hoverFill: UI_THEME.surface1, stroke: UI_THEME.border1, font: '16px Inter, sans-serif',
    });
    const overworldBottomUi = drawOverworldBottomUI(currentLayout);
    const compactBottomInset = currentLayout.compact ? overworldBottomUi.h + 16 : 0;
    drawOverworldChat(currentLayout, compactBottomInset);
    drawBanner(currentLayout);
 
    drawDebugOverlay(currentLayout);
    drawDebugMinimap(currentLayout, compactBottomInset);
    drawActiveModal(currentLayout);
 
    ctx.restore();
    drawMapTransitionOverlay(currentLayout, now);

    canvas.style.cursor = game.activeModal || game.busy
      ? 'default'
      : (
          layout.hoveredButton() ||
          hoverEnemy ||
          (hoverTile && reachable.has(posKey(hoverTile)))
        )
        ? 'pointer'
        : 'default';
  }

  function render() {
    if (disposed) return;
    renderFrameId = requestAnimationFrame(render);

    state.game.buttons = [];
    const now = performance.now();

    const currentLayout = layout.getLayout();
    
    if (state.game.phase !== PHASES.ENERGY) {
      state.game.energyConfirmStartTime = null;
      state.game.energyConfirmed = false;
    }

    if (state.game.mode === GAME_MODES.OVERWORLD) {
      threeBoard.setVisible?.(true);
      drawOverworld(currentLayout, now);
      return;
    }

    threeBoard.setVisible?.(true);

    const walls = levelWallsSet(state.game.levelIndex, state.game.combatWalls);
    const reachable = actions.getReachableTiles();
    const playerAttackTiles = actions.getPlayerAttackTiles();
    const hoverTile = layout.hoveredTile();
    const hoverMonster = layout.hoveredMonster();
    const attackMode = state.game.phase === PHASES.HERO && !!state.game.selectedAttackId && !state.game.busy;
    const showMoveHints =
      state.game.phase === PHASES.HERO &&
      !state.game.busy &&
      !attackMode &&
      (layout.hoveredPlayer() || (hoverTile && reachable.has(posKey(hoverTile))));
    const hoverPath =
      showMoveHints && hoverTile && reachable.has(posKey(hoverTile))
        ? reachable.get(posKey(hoverTile)).path
        : null;

    let monsterReachable = new Map();
    let monsterAttackTiles = new Set();
    if (hoverMonster && !state.game.busy && !attackMode) {
       monsterReachable = actions.getMonsterReachableTiles(hoverMonster.id);
       monsterAttackTiles = actions.getMonsterAttackTiles(hoverMonster.id);
    }

    threeBoard.render({
      currentLayout,
      walls,
      hoverTile,
      hoverPath,
      reachable,
      playerAttackTiles,
      monsterReachable,
      monsterAttackTiles,
      now,
    });

    ctx.save();

    fillCombatBackdrop(currentLayout);

    draw.roundRect(
      currentLayout.boardX - 14,
      currentLayout.boardY - 14,
      currentLayout.boardW + 28,
      currentLayout.boardH + 28,
      24,
      '#10110c',
      UI_THEME.border0
    );

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const rect = layout.tileRect(currentLayout, x, y);
        const key = `${x},${y}`;
        const isWall = walls.has(key);
        const monster = state.game.monsters.find((currentMonster) => currentMonster.x === x && currentMonster.y === y);

        if (isWall) draw.drawWallTile(rect);
        else draw.drawFloorTile(rect, x, y);

        if (!isWall && playerAttackTiles.has(key) && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(185,71,53,0.18)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(207,107,85,0.85)';
          ctx.lineWidth = 4;
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
          ctx.lineWidth = 1;
        } else if (!isWall && showMoveHints && reachable.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(95,143,84,0.2)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(182,199,154,0.55)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        } else if (!isWall && monsterAttackTiles.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(185,71,53,0.26)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(207,107,85,0.58)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        } else if (!isWall && monsterReachable.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(95,143,84,0.18)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(182,199,154,0.48)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        }

      }
    }

    if (hoverMonster && monsterAttackTiles.has(posKey(hoverMonster))) {
      const hoverRect = layout.tileRect(currentLayout, hoverMonster.x, hoverMonster.y);
      ctx.strokeStyle = 'rgba(207,107,85,0.95)';
      ctx.lineWidth = 4;
      ctx.strokeRect(hoverRect.x + 4, hoverRect.y + 4, hoverRect.w - 8, hoverRect.h - 8);
    }

    if (hoverPath && hoverPath.length > 1) {
      ctx.strokeStyle = 'rgba(182,199,154,0.98)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();

      hoverPath.forEach((point, index) => {
        const rect = layout.tileRect(currentLayout, point.x, point.y);
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;

        if (index === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });

      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    if (attackMode && hoverTile && playerAttackTiles.has(posKey(hoverTile))) {
      const hoverRect = layout.tileRect(currentLayout, hoverTile.x, hoverTile.y);
      ctx.strokeStyle = 'rgba(230,192,111,0.95)';
      ctx.lineWidth = 5;
      ctx.strokeRect(hoverRect.x + 4, hoverRect.y + 4, hoverRect.w - 8, hoverRect.h - 8);
    }

    // now is computed at the top

    state.game.animations = state.game.animations.filter((anim) => isAnimationActive(anim, now));

    for (const monster of state.game.monsters) {
      let drawX = monster.x;
      let drawY = monster.y;
      
      const monsterAnim = state.game.animations.find((a) => a.type === 'movement' && a.entityId === monster.id);
      if (monsterAnim) {
        const elapsed = now - monsterAnim.startTime;
        if (elapsed >= 0) {
          const tileIndex = Math.floor(elapsed / monsterAnim.durationPerTile);
          const tileProgress = (elapsed % monsterAnim.durationPerTile) / monsterAnim.durationPerTile;
          if (tileIndex < monsterAnim.path.length - 1) {
            const p1 = monsterAnim.path[tileIndex];
            const p2 = monsterAnim.path[tileIndex + 1];
            drawX = p1.x + (p2.x - p1.x) * tileProgress;
            drawY = p1.y + (p2.y - p1.y) * tileProgress;
          } else {
            const last = monsterAnim.path[monsterAnim.path.length - 1];
            drawX = last.x;
            drawY = last.y;
          }
        }
      }

      const rect = layout.tileRect(currentLayout, drawX, drawY);
      
      let pixelOffsetX = 0;
      let pixelOffsetY = 0;
      let flashRed = false;

      const bumpAnim = state.game.animations.find(a => a.type === 'bumpAttack' && a.entityId === monster.id);
      if (bumpAnim) {
         const p = (now - bumpAnim.startTime) / bumpAnim.duration;
         const dx = bumpAnim.targetX - monster.x;
         const dy = bumpAnim.targetY - monster.y;
         const len = Math.sqrt(dx*dx + dy*dy) || 1;
         let bump = 0;
         if (p < 0.25) bump = -0.25 * (p / 0.25);
         else if (p < 0.5) bump = -0.25 + 1.25 * ((p - 0.25) / 0.25);
         else bump = 1.0 * (1 - ((p - 0.5) / 0.5));
         pixelOffsetX += (dx / len) * bump * 40;
         pixelOffsetY += (dy / len) * bump * 40;
      }

      const shakeAnim = state.game.animations.find(a => a.type === 'damageShake' && a.entityId === monster.id);
      if (shakeAnim) {
         const p = (now - shakeAnim.startTime) / shakeAnim.duration;
         pixelOffsetX += Math.sin(p * Math.PI * 10) * 6;
         if (Math.floor(p * 10) % 2 === 0) flashRed = true;
      }

      rect.x += pixelOffsetX;
      rect.y += pixelOffsetY;

      draw.drawUnitCardToken(monster, rect, false, flashRed);
    }

    let drawPlayerX = state.game.player.x;
    let drawPlayerY = state.game.player.y;

    const playerAnim = state.game.animations.find((a) => a.type === 'movement' && a.entityId === 'player');
    if (playerAnim) {
      const elapsed = now - playerAnim.startTime;
      if (elapsed >= 0) {
        const tileIndex = Math.floor(elapsed / playerAnim.durationPerTile);
        const tileProgress = (elapsed % playerAnim.durationPerTile) / playerAnim.durationPerTile;

        if (tileIndex < playerAnim.path.length - 1) {
          const p1 = playerAnim.path[tileIndex];
          const p2 = playerAnim.path[tileIndex + 1];
          drawPlayerX = p1.x + (p2.x - p1.x) * tileProgress;
          drawPlayerY = p1.y + (p2.y - p1.y) * tileProgress;
        } else {
          const last = playerAnim.path[playerAnim.path.length - 1];
          drawPlayerX = last.x;
          drawPlayerY = last.y;
        }
      }
    }

    const playerRect = layout.tileRect(currentLayout, drawPlayerX, drawPlayerY);

    let playerOffsetX = 0;
    let playerOffsetY = 0;

    const playerBumpAnim = state.game.animations.find(a => a.type === 'bumpAttack' && a.entityId === 'player');
    if (playerBumpAnim) {
       const p = (now - playerBumpAnim.startTime) / playerBumpAnim.duration;
       if (p >= 0 && p <= 1) {
           const dx = playerBumpAnim.targetX - state.game.player.x;
           const dy = playerBumpAnim.targetY - state.game.player.y;
           const len = Math.sqrt(dx*dx + dy*dy) || 1;
           let bump = 0;
           if (p < 0.25) bump = -0.25 * (p / 0.25);
           else if (p < 0.5) bump = -0.25 + 1.25 * ((p - 0.25) / 0.25);
           else bump = 1.0 * (1 - ((p - 0.5) / 0.5));
           playerOffsetX += (dx / len) * bump * 40;
           playerOffsetY += (dy / len) * bump * 40;
       }
    }

    playerRect.x += playerOffsetX;
    playerRect.y += playerOffsetY;

    draw.drawUnitCardToken(state.game.player, playerRect, true, false);

    clearThreeBoardViewport(currentLayout);

    drawFloatingTextAnimations(currentLayout, now);
    drawDesktopTurnQueue(currentLayout, now);
    drawHoveredEntityTooltip(currentLayout);
    drawMenu(currentLayout);
    drawCombatBottomUI(currentLayout, now);

    // Top right settings button
    draw.drawButton(currentLayout.sw - 48, 16, 32, 32, '⚙️', () => {
      state.game.menuOpen = !state.game.menuOpen;
      state.game.menuView = 'main';
    }, {
      fill: UI_THEME.surface0, hoverFill: UI_THEME.surface1, stroke: UI_THEME.border1, font: '16px Inter, sans-serif',
    });

    drawCarriedAttack();
    
    drawEnergyFocusMask(currentLayout);
    drawBanner(currentLayout);
    
    drawDebugOverlay(currentLayout);
    drawActiveModal(currentLayout);
    
    ctx.restore();

    canvas.style.cursor = state.game.activeModal
      ? 'default'
      : state.game.draggingDie
      ? 'grabbing'
      : (
          layout.hoveredButton() ||
          layout.hoveredDraggableDie() ||
          (hoverTile && reachable.has(posKey(hoverTile))) ||
          (hoverTile && playerAttackTiles.has(posKey(hoverTile)))
        )
        ? 'pointer'
        : 'default';
  }

  let frameCount = 0;
  let lastTime = performance.now();
  let currentFps = 0;

  function updateDebugMetrics() {
    frameCount += 1;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastTime = now;
    }
  }

  function selectedDebugCube() {
    const debugCubes = ensureDebugCubes();
    const currentMapId = currentEditorMapId();
    return debugCubes.placements.find((cube) => {
      return cube.id === debugCubes.selectedCubeId && cube.mapId === currentMapId;
    }) || null;
  }

  function removeSelectedDebugCube() {
    const debugCubes = ensureDebugCubes();
    const selected = selectedDebugCube();
    if (!selected) return;

    removeDebugCube(selected.id);
  }

  function removeDebugCube(cubeId) {
    const debugCubes = ensureDebugCubes();
    const index = debugCubes.placements.findIndex((cube) => cube.id === cubeId);
    if (index >= 0) debugCubes.placements.splice(index, 1);
    if (debugCubes.selectedCubeId === cubeId) debugCubes.selectedCubeId = null;
  }

  function currentDebugCubes() {
    const debugCubes = ensureDebugCubes();
    const currentMapId = currentEditorMapId();
    return debugCubes.placements
      .filter((cube) => !currentMapId || cube.mapId === currentMapId)
      .slice()
      .sort((a, b) => {
        return (a.y - b.y) || (a.x - b.x) || ((a.level ?? 0) - (b.level ?? 0));
      });
  }

  function drawSelectedDebugCubeDelete(currentLayout) {
    const cube = selectedDebugCube();
    if (!cube) return;

    const level = Math.max(0, cube.level ?? 0);
    const point = screenPointForTile(currentLayout, cube.x, cube.y, DEBUG_CUBE_HEIGHT * (level + 1) + 0.28);
    const size = 30;
    const x = clamp(point.x + 8, 8, currentLayout.sw - size - 8);
    const y = clamp(point.y - size - 8, 8, currentLayout.sh - size - 8);

    draw.roundRect(x, y, size, size, 6, UI_THEME.dangerDark, '#fca5a5');
    draw.drawText('🗑', x + size / 2, y + 20, {
      align: 'center',
      font: '16px Inter, sans-serif',
      color: UI_THEME.text,
    });
    state.game.buttons.push({
      x,
      y,
      w: size,
      h: size,
      onClick: removeSelectedDebugCube,
    });
  }

  function getDebugMemoryLabel() {
    if (!window.performance?.memory) return 'N/A';
    return `${Math.round(window.performance.memory.usedJSHeapSize / 1048576)} MB`;
  }

  function clampDebugPanelPosition(currentLayout, panelW, panelH, position) {
    const minX = DEBUG_PANEL_MARGIN;
    const minY = DEBUG_PANEL_MARGIN;
    const maxX = Math.max(minX, currentLayout.sw - panelW - DEBUG_PANEL_OPEN_TAB_OVERHANG - DEBUG_PANEL_MARGIN);
    const maxY = Math.max(minY, currentLayout.sh - panelH - DEBUG_PANEL_MARGIN);

    return {
      x: clamp(position.x, minX, maxX),
      y: clamp(position.y, minY, maxY),
    };
  }

  function debugPanelPosition(currentLayout, panelW, panelH, fallbackY) {
    const position = state.debugPanelPosition || { x: DEBUG_PANEL_MARGIN, y: fallbackY };
    state.debugPanelPosition = clampDebugPanelPosition(currentLayout, panelW, panelH, position);
    return state.debugPanelPosition;
  }

  function moveDebugPanel(currentLayout, panelW, panelH, mouseX, mouseY) {
    const offset = state.debugPanelDragOffset || { x: 0, y: 0 };
    state.debugPanelPosition = clampDebugPanelPosition(currentLayout, panelW, panelH, {
      x: mouseX - offset.x,
      y: mouseY - offset.y,
    });
  }

  function drawDebugSlider({ x, y, w, label, value, min, max, onChange, formatValue }) {
    const sliderH = 18;
    const sliderY = y + 19;
    const trackY = y + 28;
    const normalized = clamp((value - min) / (max - min), 0, 1);
    const knobX = x + w * normalized;

    function setFromMouse(mouseX) {
      const nextValue = min + clamp((mouseX - x) / w, 0, 1) * (max - min);
      onChange(nextValue);
    }

    draw.drawText(label, x, y + 10, {
      align: 'left',
      font: 'bold 11px Inter, sans-serif',
      color: UI_THEME.textMuted,
    });
    draw.drawText(formatValue(value), x + w, y + 10, {
      align: 'right',
      font: 'bold 11px Inter, sans-serif',
      color: UI_THEME.accent,
    });

    ctx.save();
    draw.roundRect(x, trackY - 4, w, 8, 4, 'rgba(32,34,25,0.92)', UI_THEME.border1);
    draw.roundRect(x, trackY - 4, Math.max(8, knobX - x), 8, 4, UI_THEME.accentDark, null);
    draw.roundRect(knobX - 9, trackY - 11, 18, 22, 6, '#d6b36e', '#f3d79a');
    ctx.restore();

    state.game.buttons.push({
      x,
      y: sliderY,
      w,
      h: sliderH,
      onClick: () => setFromMouse(state.mouse.x),
      onDragStart: () => setFromMouse(state.mouse.x),
      onDrag: (mouseX) => setFromMouse(mouseX),
    });
  }

  function drawDebugToggle({ x, y, w, label, checked, onChange }) {
    const toggleW = 62;
    const toggleH = 24;
    const toggleX = x + w - toggleW;
    const knobSize = 18;
    const knobX = checked ? toggleX + toggleW - knobSize - 3 : toggleX + 3;

    draw.drawText(label, x, y + 16, {
      align: 'left',
      font: 'bold 12px Inter, sans-serif',
      color: UI_THEME.textMuted,
    });
    draw.roundRect(
      toggleX,
      y,
      toggleW,
      toggleH,
      12,
      checked ? UI_THEME.successDark : UI_THEME.surface2,
      checked ? UI_THEME.success : UI_THEME.border1,
    );
    draw.drawText(checked ? 'ON' : 'OFF', checked ? toggleX + 19 : toggleX + 42, y + 16, {
      align: 'center',
      font: '900 9px Inter, sans-serif',
      color: checked ? '#f2ead7' : UI_THEME.textDim,
    });
    draw.roundRect(knobX, y + 3, knobSize, knobSize, 9, '#f2ead7', 'rgba(7,8,7,0.35)');

    state.game.buttons.push({
      x: toggleX,
      y,
      w: toggleW,
      h: toggleH,
      onClick: onChange,
    });
  }

  function ensureDebugEditor() {
    if (!state.debugEditor) state.debugEditor = {};
    const editor = state.debugEditor;
    if (!editor.expandedFolders) editor.expandedFolders = {};
    if (!editor.expandedTextureFolders) editor.expandedTextureFolders = { textures: true };
    if (editor.expandedTextureFolders.textures === undefined) editor.expandedTextureFolders.textures = true;
    if (!Array.isArray(editor.placements)) editor.placements = [];
    if (!Number.isFinite(editor.treeScroll)) editor.treeScroll = 0;
    if (!Number.isFinite(editor.sceneScroll)) editor.sceneScroll = 0;
    if (!editor.editorAssetTab) editor.editorAssetTab = 'models';
    return editor;
  }

  function currentEditorMapId() {
    if (state.game.mode === GAME_MODES.OVERWORLD) {
      return state.game.overworld?.currentMapId || null;
    }
    return `combat:${state.game.levelIndex ?? 0}`;
  }

  function currentEditorBounds() {
    if (state.game.mode === GAME_MODES.OVERWORLD) {
      return getCurrentWorldBounds(state.game.overworld);
    }
    return { width: BOARD_SIZE, height: BOARD_SIZE };
  }

  function tileForWorldPosition(position) {
    const bounds = currentEditorBounds();
    return {
      x: Math.floor((position?.x || 0) + bounds.width / 2),
      y: Math.floor((position?.z || 0) + bounds.height / 2),
    };
  }

  function tileCenterForCell(cell) {
    const bounds = currentEditorBounds();
    return {
      x: cell.x - bounds.width / 2 + 0.5,
      z: cell.y - bounds.height / 2 + 0.5,
    };
  }

  function textureCellLimits(bounds) {
    return {
      minX: -bounds.width * TEXTURE_OUTSIDE_BOARD_MULTIPLIER,
      maxX: bounds.width * (TEXTURE_OUTSIDE_BOARD_MULTIPLIER + 1) - 1,
      minY: -bounds.height * TEXTURE_OUTSIDE_BOARD_MULTIPLIER,
      maxY: bounds.height * (TEXTURE_OUTSIDE_BOARD_MULTIPLIER + 1) - 1,
    };
  }

  function snapDegrees(value, step = 5) {
    return Math.round(value / step) * step;
  }

  function textureDropTarget(mouseX, mouseY) {
    const bounds = currentEditorBounds();
    const limits = textureCellLimits(bounds);
    const point = state.boardInteraction?.worldPointAtAny?.(layout.getLayout(), mouseX, mouseY)
      || state.boardInteraction?.worldPointAt?.(layout.getLayout(), mouseX, mouseY);
    const fallbackCell = state.game.player
      ? { x: state.game.player.x, y: state.game.player.y }
      : { x: Math.floor(bounds.width / 2), y: Math.floor(bounds.height / 2) };
    const cell = point
      ? {
        x: clamp(point.x, limits.minX, limits.maxX),
        y: clamp(point.y, limits.minY, limits.maxY),
      }
      : fallbackCell;
    const roundedCell = {
      x: Math.round(clamp(cell.x, limits.minX, limits.maxX)),
      y: Math.round(clamp(cell.y, limits.minY, limits.maxY)),
    };
    const center = tileCenterForCell(roundedCell);
    return {
      cell: roundedCell,
      position: { x: center.x, y: 0.02, z: center.z },
    };
  }

  function moveDebugPlacementToMouse(placement, mouseX, mouseY) {
    const point = placement?.kind === 'texture'
      ? state.boardInteraction?.worldPointAtAny?.(layout.getLayout(), mouseX, mouseY)
      : state.boardInteraction?.worldPointAt?.(layout.getLayout(), mouseX, mouseY);
    if (!point || !placement) return false;

    placement.position = placement.position || { x: 0, y: 0, z: 0 };
    if (placement.kind === 'texture') {
      const target = textureDropTarget(mouseX, mouseY);
      placement.position.x = target.position.x;
      placement.position.z = target.position.z;
    } else {
      placement.position.x = point.worldX;
      placement.position.z = point.worldZ;
    }
    placement.mapId = currentEditorMapId() || placement.mapId;
    return true;
  }

  function selectedDebugPlacement() {
    const editor = ensureDebugEditor();
    const currentMapId = currentEditorMapId();
    return editor.placements.find((placement) => {
      return placement.id === editor.selectedPlacementId && (!currentMapId || placement.mapId === currentMapId);
    }) || null;
  }

  function removeDebugPlacement(placementId) {
    const editor = ensureDebugEditor();
    const index = editor.placements.findIndex((placement) => placement.id === placementId);
    if (index < 0) return;

    const [removed] = editor.placements.splice(index, 1);
    if (editor.selectedPlacementId === removed.id) editor.selectedPlacementId = null;
  }

  function createDebugPlacement(libraryItem, mouseX, mouseY) {
    const editor = ensureDebugEditor();
    const mapId = currentEditorMapId();
    if (!libraryItem || !mapId) return null;

    const point = state.boardInteraction?.worldPointAt?.(layout.getLayout(), mouseX, mouseY);
    const fallback = state.game.player
      ? {
        worldX: state.game.player.x - currentEditorBounds().width / 2 + 0.5,
        worldZ: state.game.player.y - currentEditorBounds().height / 2 + 0.5,
      }
      : { worldX: 0, worldZ: 0 };
    const drop = point || fallback;
    const placement = {
      id: `debug-model-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      kind: 'model',
      mapId,
      libraryId: libraryItem.id,
      modelUrl: libraryItem.url,
      modelName: libraryItem.name,
      folder: libraryItem.folder,
      position: { x: drop.worldX, y: 0, z: drop.worldZ },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 0.5,
    };

    editor.placements.push(placement);
    editor.selectedPlacementId = placement.id;
    editor.selectedLibraryId = libraryItem.id;
    return placement;
  }

  function createDebugTexturePlacement(textureItem, mouseX, mouseY) {
    const editor = ensureDebugEditor();
    const mapId = currentEditorMapId();
    if (!textureItem || !mapId) return null;

    const drop = textureDropTarget(mouseX, mouseY);
    const placement = {
      id: `debug-texture-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      kind: 'texture',
      mapId,
      libraryId: textureItem.id,
      modelUrl: textureItem.url,
      textureUrl: textureItem.url,
      modelName: textureItem.name,
      folder: textureItem.folder,
      position: { ...drop.position, y: 1 },
      rotation: { x: 0, y: Math.PI / 4, z: 0 },
      scale: 1,
    };

    editor.placements.push(placement);
    editor.selectedPlacementId = placement.id;
    editor.selectedTextureId = textureItem.id;
    return placement;
  }

  function debugPlacementSummary(placement) {
    if (!placement) return '';
    const tile = tileForWorldPosition(placement.position);
    const assetUrl = placement.modelUrl || placement.textureUrl || '-';
    const kindLabel = placement.kind === 'texture' ? 'Imagem' : 'Modelo 3D';
    const rotationYDeg = Math.round(((placement.rotation?.y || 0) * 180) / Math.PI);
    const position = placement.position || { x: 0, y: 0, z: 0 };
    const scale = Number.isFinite(placement.scale) ? placement.scale : 0.5;

    return [
      `Mapa: ${placement.mapId}`,
      `Tipo: ${kindLabel}`,
      `Modelo: ${assetUrl}`,
      `Nome: ${placement.modelName}`,
      `Pasta: ${placement.folder || '-'}`,
      `Tile: ${tile.x},${tile.y}`,
      `Posicao XYZ: x=${position.x.toFixed(3)}, y=${position.y.toFixed(3)}, z=${position.z.toFixed(3)}`,
      `Rotacao: x=${((placement.rotation?.x || 0) * 180 / Math.PI).toFixed(1)}deg, y=${rotationYDeg}deg, z=${((placement.rotation?.z || 0) * 180 / Math.PI).toFixed(1)}deg`,
      `Escala: ${scale.toFixed(3)}`,
    ].join('\n');
  }

  function copyDebugPlacementSummary(placement) {
    const editor = ensureDebugEditor();
    const summary = debugPlacementSummary(placement);
    if (!summary) return;

    editor.lastCopiedAt = performance.now();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(summary).catch(() => {
        window.prompt('Resumo do modelo', summary);
      });
    } else {
      window.prompt('Resumo do modelo', summary);
    }
  }

  function copyAllDebugPlacementSummaries() {
    const editor = ensureDebugEditor();
    const summary = editor.placements
      .map((placement) => debugPlacementSummary(placement))
      .filter(Boolean)
      .join('\n\n\n');
    if (!summary) return;

    editor.lastCopiedAt = performance.now();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(summary).catch(() => {
        window.prompt('Resumo dos modelos', summary);
      });
    } else {
      window.prompt('Resumo dos modelos', summary);
    }
  }

  function debugCubeSummary(cube) {
    if (!cube) return '';
    return [
      `Mapa: ${cube.mapId}`,
      'Tipo: Cubo',
      `Tile: ${cube.x},${cube.y}`,
      `Nível: ${cube.level ?? 0}`,
    ].join('\n');
  }

  function copyAllDebugCubeSummaries() {
    const debugCubes = ensureDebugCubes();
    const summary = debugCubes.placements
      .map((cube) => debugCubeSummary(cube))
      .filter(Boolean)
      .join('\n\n\n');
    if (!summary) return;

    debugCubes.lastCopiedAt = performance.now();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(summary).catch(() => {
        window.prompt('Resumo dos cubos', summary);
      });
    } else {
      window.prompt('Resumo dos cubos', summary);
    }
  }

  function debugColorSummary() {
    const debugColors = ensureDebugColors();
    let currentGroup = '';
    const lines = [
      `Mapa: ${currentEditorMapId() || 'atual'}`,
      'Tipo: Cores do mapa',
      'Estado editavel: state.debugColors.values em js/main.js',
      'Aplicacao visual: js/ui/three-board-view.js -> syncDebugColorMaterials(), paintProceduralGrassTexture() e paintProceduralDirtSideTexture()',
      '',
      'Formato: Nome visual | chave tecnica | cor | onde pinta',
    ];

    for (const field of DEBUG_COLOR_FIELDS) {
      if (field.group !== currentGroup) {
        currentGroup = field.group;
        lines.push('', `[${currentGroup}]`);
      }
      lines.push(`${field.label} (${field.description}) | chave: ${field.key} | cor: ${debugColors.values[field.key].toUpperCase()} | pinta: ${field.codeUse}`);
    }

    return lines.join('\n');
  }

  function copyAllDebugColorSummaries() {
    const debugColors = ensureDebugColors();
    const summary = debugColorSummary();
    debugColors.lastCopiedAt = performance.now();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(summary).catch(() => {
        window.prompt('Resumo das cores', summary);
      });
    } else {
      window.prompt('Resumo das cores', summary);
    }
  }

  async function applyDebugColorsToCurrentMap() {
    const debugColors = ensureDebugColors();
    const mapId = currentEditorMapId();
    const values = Object.fromEntries(DEBUG_COLOR_FIELDS.map((field) => {
      return [field.key, normalizeDebugHexColor(debugColors.values[field.key], DEBUG_COLOR_DEFAULTS[field.key])];
    }));

    debugColors.values = { ...values };
    debugColors.activeMapId = mapId;
    debugColors.applyStatus = 'pending';
    debugColors.applyError = '';
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    if (mapId && state.game.overworld) {
      const mapState = ensureOverworldMapState(state.game.overworld, mapId);
      if (mapState) {
        mapState.debugColors = { values: { ...values } };
      }
    }

    try {
      const response = await fetch('/__debug/map-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId, values }),
      });
      if (!response.ok) throw new Error(await response.text());

      debugColors.lastAppliedAt = performance.now();
      debugColors.appliedMapId = mapId;
      debugColors.applyStatus = 'applied';
    } catch (error) {
      debugColors.applyStatus = 'failed';
      debugColors.applyError = error instanceof Error ? error.message : 'Falha desconhecida.';
    }
  }

  function currentDebugVisualSettingsValues() {
    function numberValue(key, min, max, fallback) {
      const value = Number(state.visuals?.[key]);
      return Number.isFinite(value) ? clamp(value, min, max) : fallback;
    }

    return {
      exposure: numberValue('exposure', 0.1, 3.0, 1.0),
      ambientIntensity: numberValue('ambientIntensity', 0, 3.0, 1.05),
      keyIntensity: numberValue('keyIntensity', 0, 5.0, 1.75),
      keyLightDirectionDeg: numberValue('keyLightDirectionDeg', 0, 360, 84),
      fogDensity: numberValue('fogDensity', 0, 0.1, 0.0),
      shadowMapEnabled: !!state.visuals?.shadowMapEnabled,
      showOutlines: !!state.visuals?.showOutlines,
      showGrid: !!state.visuals?.showGrid,
      overworldOrthographicCamera: !!state.visuals?.overworldOrthographicCamera,
      overworldWater: state.visuals?.overworldWater !== false,
    };
  }

  async function applyDebugVisualSettings() {
    const debugVisualSettings = ensureDebugVisualSettingsState();
    const values = currentDebugVisualSettingsValues();

    state.visuals = { ...state.visuals, ...values };
    debugVisualSettings.applyStatus = 'pending';
    debugVisualSettings.applyError = '';
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    try {
      const response = await fetch('/__debug/visual-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      if (!response.ok) throw new Error(await response.text());

      debugVisualSettings.lastAppliedAt = performance.now();
      debugVisualSettings.applyStatus = 'applied';
    } catch (error) {
      debugVisualSettings.applyStatus = 'failed';
      debugVisualSettings.applyError = error instanceof Error ? error.message : 'Falha desconhecida.';
    }
  }

  function visibleAssetTreeRows(libraryItems, expandedFolders) {
    const rows = [];
    const sortedItems = libraryItems;

    function childFolders(prefixParts) {
      const prefixLength = prefixParts.length;
      const prefix = prefixParts.join('/');
      const folders = new Set();
      for (const item of sortedItems) {
        const itemPrefix = item.path.slice(0, prefixLength).join('/');
        if (itemPrefix !== prefix) continue;
        const nextPart = item.path[prefixLength];
        if (nextPart && item.path.length > prefixLength + 1) folders.add(nextPart);
      }
      return [...folders].sort((a, b) => a.localeCompare(b));
    }

    function filesIn(prefixParts) {
      const prefix = prefixParts.join('/');
      return sortedItems.filter((item) => item.folder === prefix);
    }

    function visit(prefixParts, depth) {
      for (const folder of childFolders(prefixParts)) {
        const nextParts = [...prefixParts, folder];
        const key = nextParts.join('/');
        const expanded = !!expandedFolders[key];
        rows.push({ type: 'folder', key, label: folder, depth, expanded });
        if (expanded) visit(nextParts, depth + 1);
      }

      for (const file of filesIn(prefixParts)) {
        rows.push({ type: 'file', key: file.id, label: file.name, depth, item: file });
      }
    }

    visit([], 0);
    return rows;
  }

  function visibleModelTreeRows() {
    const editor = ensureDebugEditor();
    return visibleAssetTreeRows(MODEL_LIBRARY, editor.expandedFolders);
  }

  function visibleTextureTreeRows() {
    const editor = ensureDebugEditor();
    return visibleAssetTreeRows(TEXTURE_LIBRARY, editor.expandedTextureFolders);
  }

  function debugMapBlockedKeys(map, mapState) {
    const blocked = new Set();

    for (const object of map.objects || []) {
      const type = WORLD_OBJECT_TYPES[object.type];
      if (!type || type.blocksMovement === false) continue;
      const footprint = object.footprint || type.footprint || [[0, 0]];
      for (const [dx, dy] of footprint) {
        blocked.add(posKey({ x: object.x + dx, y: object.y + dy }));
      }
    }

    for (const enemy of mapState?.enemies || []) {
      if (enemy.hp <= 0) continue;
      blocked.add(posKey(enemy));
    }

    return blocked;
  }

  function debugSpawnForMap(map, mapState) {
    const blocked = debugMapBlockedKeys(map, mapState);
    const preferred = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];

    function isFree(cell) {
      return (
        cell.x >= 0 &&
        cell.y >= 0 &&
        cell.x < map.size.width &&
        cell.y < map.size.height &&
        !blocked.has(posKey(cell))
      );
    }

    for (const cell of preferred) {
      if (isFree(cell)) return cell;
    }

    for (let y = 0; y < map.size.height; y += 1) {
      for (let x = 0; x < map.size.width; x += 1) {
        const cell = { x, y };
        if (isFree(cell)) return cell;
      }
    }

    return map.playerStart || { x: 0, y: 0 };
  }

  function debugJumpToMap(mapId) {
    const map = WORLD_MAPS[mapId];
    if (!map) return;

    const game = state.game;
    if (!game.overworld) {
      game.overworld = { currentMapId: map.id, mapStates: {} };
    }

    const mapState = ensureOverworldMapState(game.overworld, map.id);
    const spawn = debugSpawnForMap(map, mapState);

    game.mode = GAME_MODES.OVERWORLD;
    game.overworld.currentMapId = map.id;
    game.player.x = spawn.x;
    game.player.y = spawn.y;
    game.monsters = [];
    game.combatContext = null;
    game.turnQueue = ['player'];
    game.turnCount = 0;
    game.phase = PHASES.HERO;
    game.heroTurnStartedAt = null;
    game.heroTurnEndsAt = null;
    game.speedRemaining = game.player.speedBase;
    game.apRemaining = game.player.apMax;
    game.selectedEntity = null;
    game.selectedAttackId = null;
    game.animations = [];
    game.busy = false;
    actions.setEvent?.(`Debug: entrou em ${map.name} (${spawn.x}, ${spawn.y}).`);
  }

  function drawDebugTab({ x, y, w, label, active, onClick }) {
    draw.roundRect(
      x,
      y,
      w,
      28,
      6,
      active ? UI_THEME.accentDark : UI_THEME.surface1,
      active ? '#e6c06f' : UI_THEME.border1,
    );
    draw.drawText(label, x + w / 2, y + 18, {
      align: 'center',
      font: w < 48 ? '900 9px Inter, sans-serif' : '900 11px Inter, sans-serif',
      color: active ? UI_THEME.text : UI_THEME.textMuted,
    });
    state.game.buttons.push({ x, y, w, h: 28, onClick });
  }

  function drawMinimapDiamond(cx, cy, halfW, halfH, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfH);
    ctx.lineTo(cx + halfW, cy);
    ctx.lineTo(cx, cy + halfH);
    ctx.lineTo(cx - halfW, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  function drawDebugMinimap(currentLayout, bottomInset = 0) {
    if (!DEBUG_CONFIG.SHOW_STATS || state.game.mode !== GAME_MODES.OVERWORLD) return;

    const activeMap = getCurrentWorldMap(state.game.overworld);
    if (!activeMap?.gridPosition) return;

    const maps = Object.values(WORLD_MAPS).filter((map) => map.gridPosition);
    if (maps.length === 0) return;

    const radius = currentLayout.compact ? 78 : 94;
    const cx = currentLayout.sw - radius - 18;
    const cy = currentLayout.sh - radius - 18 - bottomInset;
    const stepX = currentLayout.compact ? 26 : 32;
    const stepY = currentLayout.compact ? 18 : 22;
    const halfW = currentLayout.compact ? 20 : 24;
    const halfH = currentLayout.compact ? 13 : 16;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(7,8,7,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,192,111,0.58)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.clip();

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(242,234,215,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    maps
      .slice()
      .sort((a, b) => (a.gridPosition.x - a.gridPosition.y) - (b.gridPosition.x - b.gridPosition.y))
      .forEach((map) => {
        const { x, y } = map.gridPosition;
        const tileCx = cx + (x + y) * stepX;
        const tileCy = cy + (x - y) * stepY;
        const active = map.id === activeMap.id;
        drawMinimapDiamond(
          tileCx,
          tileCy,
          halfW,
          halfH,
          active ? '#f2c94c' : 'rgba(32,34,25,0.92)',
          active ? '#fff0a6' : 'rgba(111,99,66,0.95)',
        );
        draw.drawText(`${x},${y}`, tileCx, tileCy + 4, {
          align: 'center',
          font: currentLayout.compact ? '900 9px Inter, sans-serif' : '900 10px Inter, sans-serif',
          color: active ? '#221707' : UI_THEME.textMuted,
        });
      });

    ctx.restore();
  }

  function drawDebugOverlay(currentLayout) {
    if (!DEBUG_CONFIG.SHOW_STATS) {
      syncDebugHeroOverlay(null);
      hideDebugColorInputs();
      return;
    }

    updateDebugMetrics();

    const activeTab = state.debugPanelTab || 'settings';
    const editorTab = activeTab === 'editor';
    const cubeTab = activeTab === 'cube';
    const colorTab = activeTab === 'color';
    const heroTab = activeTab === 'hero';
    if (!colorTab) hideDebugColorInputs();
    const panelTargetW = (editorTab || colorTab) ? 380 : (cubeTab || heroTab) ? 340 : 320;
    const panelTargetH = editorTab ? 820 : colorTab ? 800 : cubeTab ? 600 : heroTab ? 610 : activeTab === 'settings' ? 610 : 464;
    const panelW = Math.min(panelTargetW, Math.max(236, currentLayout.sw - 48));
    const availablePanelH = Math.max(220, currentLayout.sh - DEBUG_PANEL_MARGIN * 2);
    const panelH = Math.min(panelTargetH, Math.max(334, availablePanelH), availablePanelH);
    const position = debugPanelPosition(currentLayout, panelW, panelH, editorTab ? 12 : 56);
    const panelX = position.x;
    const panelY = position.y;
    const tabW = 30;
    const tabH = 62;

    if (!state.debugPanelOpen) {
      const tabX = 0;
      const tabY = DEBUG_PANEL_MINIMIZED_Y;
      state.debugPanelBounds = null;
      state.debugEditorTreeBounds = null;
      state.debugEditorSceneBounds = null;
      state.debugCubeListBounds = null;
      state.debugColorListBounds = null;
      hideDebugColorInputs();
      syncDebugHeroOverlay(null);
      draw.roundRect(tabX - 8, tabY, tabW + 8, tabH, 0, 'rgba(7,8,7,0.92)', UI_THEME.border1);
      draw.drawText('>', tabX + 10, tabY + 37, {
        align: 'center',
        font: '900 22px Inter, sans-serif',
        color: UI_THEME.accent,
      });
      state.game.buttons.push({
        x: tabX,
        y: tabY,
        w: tabW,
        h: tabH,
        onClick: () => {
          state.debugPanelOpen = true;
        },
      });
      return;
    }

    draw.roundRect(panelX, panelY, panelW, panelH, 8, 'rgba(7,8,7,0.92)', UI_THEME.border1);
    state.debugPanelBounds = { x: panelX, y: panelY, w: panelW, h: panelH };
    state.game.buttons.push({
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      onClick: () => {},
    });

    const dragHandleH = 38;
    state.game.buttons.push({
      x: panelX,
      y: panelY,
      w: panelW - 36,
      h: dragHandleH,
      onDragStart: (mouseX, mouseY) => {
        state.debugPanelDragOffset = {
          x: mouseX - panelX,
          y: mouseY - panelY,
        };
      },
      onDrag: (mouseX, mouseY) => {
        moveDebugPanel(currentLayout, panelW, panelH, mouseX, mouseY);
      },
      onDragEnd: () => {
        state.debugPanelDragOffset = null;
      },
    });

    const tabX = panelX + panelW - 2;
    const tabY = panelY + 18;
    draw.roundRect(tabX, tabY, tabW, tabH, 0, 'rgba(7,8,7,0.92)', UI_THEME.border1);
    draw.drawText('<', tabX + 14, tabY + 37, {
      align: 'center',
      font: '900 22px Inter, sans-serif',
      color: UI_THEME.accent,
    });
    state.game.buttons.push({
      x: tabX,
      y: tabY,
      w: tabW,
      h: tabH,
      onClick: () => {
        state.debugPanelOpen = false;
      },
    });

    let cy = panelY + 22;
    draw.drawText('DEBUG', panelX + 16, cy, {
      align: 'left',
      font: '900 13px Inter, sans-serif',
      color: UI_THEME.text,
    });

    cy += 18;
    const stats = [
      { label: 'FPS', value: String(currentFps), color: UI_THEME.success },
      { label: 'Zoom', value: `${Math.round((state.debugZoom || 1.15) * 100)}%`, color: UI_THEME.accent },
      { label: 'Memoria', value: getDebugMemoryLabel(), color: '#b8ac86' },
    ];
    const statW = (panelW - 40) / 3;
    stats.forEach((stat, index) => {
      const statX = panelX + 14 + index * (statW + 6);
      draw.drawText(stat.label, statX, cy + 8, {
        align: 'left',
        font: '900 9px Inter, sans-serif',
        color: UI_THEME.textDim,
      });
      draw.drawText(stat.value, statX, cy + 26, {
        align: 'left',
        font: 'bold 13px Inter, sans-serif',
        color: stat.color,
      });
    });

    cy += 50;
    const tabGap = 8;
    const tabs = [
      ['settings', 'Ajustes'],
      ['maps', 'Mapas'],
      ['editor', 'Editor'],
      ['cube', 'Cubo'],
      ['color', 'Cor'],
      ['hero', 'Hero'],
    ];
    const tabButtonW = (panelW - 32 - tabGap * (tabs.length - 1)) / tabs.length;
    tabs.forEach(([id, label], index) => {
      drawDebugTab({
        x: panelX + 16 + index * (tabButtonW + tabGap),
        y: cy,
        w: tabButtonW,
        label,
        active: activeTab === id,
        onClick: () => {
          state.debugPanelTab = id;
        },
      });
    });

    cy += 38;

    if (activeTab === 'maps') {
      syncDebugHeroOverlay(null);
      const mapEntries = Object.values(WORLD_MAPS);
      const columns = 2;
      const tileGap = 8;
      const tileW = (panelW - 32 - tileGap) / columns;
      const tileH = 58;

      mapEntries.forEach((map, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const tileX = panelX + 16 + col * (tileW + tileGap);
        const tileY = cy + row * (tileH + tileGap);
        const activeMap = state.game.overworld?.currentMapId === map.id;

        draw.roundRect(
          tileX,
          tileY,
          tileW,
          tileH,
          6,
          activeMap ? 'rgba(63,111,69,0.82)' : UI_THEME.surface1,
          activeMap ? UI_THEME.success : UI_THEME.border1,
        );
        draw.drawText(map.name, tileX + 8, tileY + 20, {
          align: 'left',
          font: '900 11px Inter, sans-serif',
          color: UI_THEME.text,
          maxWidth: tileW - 16,
        });
        draw.drawText(`${map.size.width}x${map.size.height}`, tileX + 8, tileY + 42, {
          align: 'left',
          font: 'bold 10px Inter, sans-serif',
          color: activeMap ? '#d8f3dc' : UI_THEME.textDim,
        });

        state.game.buttons.push({
          x: tileX,
          y: tileY,
          w: tileW,
          h: tileH,
          onClick: () => debugJumpToMap(map.id),
        });
      });
      return;
    }

    if (activeTab === 'editor') {
      syncDebugHeroOverlay(null);
      const editor = ensureDebugEditor();
      const selectedPlacementForLayout = selectedDebugPlacement();
      const textureEditorActive = editor.editorAssetTab === 'textures';
      const assetTabGap = 8;
      const assetTabW = (panelW - 32 - assetTabGap) / 2;
      drawDebugTab({
        x: panelX + 16,
        y: cy,
        w: assetTabW,
        label: 'Modelos',
        active: !textureEditorActive,
        onClick: () => {
          editor.editorAssetTab = 'models';
          editor.treeScroll = 0;
        },
      });
      drawDebugTab({
        x: panelX + 16 + assetTabW + assetTabGap,
        y: cy,
        w: assetTabW,
        label: 'Texturas',
        active: textureEditorActive,
        onClick: () => {
          editor.editorAssetTab = 'textures';
          editor.treeScroll = 0;
        },
      });
      cy += 36;

      const treeX = panelX + 16;
      const treeY = cy;
      const treeW = panelW - 32;
      const sliderRowH = 36;
      const actionRowH = 28;
      const sceneListH = selectedPlacementForLayout
        ? (panelH >= 760 ? 120 : panelH >= 650 ? 96 : 70)
        : (panelH >= 650 ? 144 : panelH >= 590 ? 112 : 70);
      const sceneRowH = 24;
      const sceneDeleteW = 50;
      const editorTopUsed = cy - panelY;
      const transformSliderCount = selectedPlacementForLayout ? 5 : 0;
      const estimatedTransformH = selectedPlacementForLayout ? 14 + sliderRowH * transformSliderCount + 16 : 0;
      const estimatedSceneH = 18 + sceneListH + 12;
      const estimatedFooterH = actionRowH + 36;
      const availableTreeH = panelH - editorTopUsed - estimatedTransformH - estimatedSceneH - estimatedFooterH - 10;
      const treeH = Math.floor(clamp(availableTreeH, 64, 178));
      const rowH = 24;
      const rows = textureEditorActive ? visibleTextureTreeRows() : visibleModelTreeRows();
      const expandedFolders = textureEditorActive ? editor.expandedTextureFolders : editor.expandedFolders;
      const maxScroll = Math.max(0, rows.length * rowH - treeH);
      editor.treeScroll = clamp(editor.treeScroll, 0, maxScroll);
      state.debugPanelBounds = { x: panelX, y: panelY, w: panelW, h: panelH };
      state.debugEditorTreeBounds = { x: treeX, y: treeY, w: treeW, h: treeH };

      draw.roundRect(treeX, treeY, treeW, treeH, 6, 'rgba(17,19,13,0.82)', UI_THEME.border0);

      ctx.save();
      ctx.beginPath();
      ctx.rect(treeX + 1, treeY + 1, treeW - 2, treeH - 2);
      ctx.clip();
      rows.forEach((row, index) => {
        const rowY = treeY + index * rowH - editor.treeScroll;
        if (rowY < treeY - rowH || rowY > treeY + treeH) return;
        const indent = row.depth * 13;
        const rowX = treeX + 6 + indent;
        const rowW = treeW - 12 - indent;

        if (row.type === 'folder') {
          draw.drawText(row.expanded ? 'v' : '>', rowX, rowY + 16, {
            align: 'left',
            font: '900 10px Inter, sans-serif',
            color: UI_THEME.accent,
          });
          draw.drawText(row.label, rowX + 14, rowY + 16, {
            align: 'left',
            font: 'bold 11px Inter, sans-serif',
            color: UI_THEME.textMuted,
            maxWidth: rowW - 14,
          });
          if (rowY >= treeY && rowY + rowH <= treeY + treeH) {
            state.game.buttons.push({
              x: treeX,
              y: rowY,
              w: treeW,
              h: rowH,
              onClick: () => {
                expandedFolders[row.key] = !expandedFolders[row.key];
              },
            });
          }
          return;
        }

        const selected = textureEditorActive
          ? editor.selectedTextureId === row.item.id
          : editor.selectedLibraryId === row.item.id;
        draw.roundRect(
          rowX,
          rowY + 3,
          rowW,
          rowH - 5,
          4,
          selected ? 'rgba(143,103,36,0.55)' : 'rgba(32,34,25,0.75)',
          selected ? UI_THEME.accent : null,
        );
        draw.drawText(row.label, rowX + 8, rowY + 16, {
          align: 'left',
          font: '10px Inter, sans-serif',
          color: UI_THEME.text,
          maxWidth: rowW - 16,
        });
        if (rowY >= treeY && rowY + rowH <= treeY + treeH) {
          state.game.buttons.push({
            x: rowX,
            y: rowY + 2,
            w: rowW,
            h: rowH - 4,
            onClick: () => {
              if (textureEditorActive) editor.selectedTextureId = row.item.id;
              else editor.selectedLibraryId = row.item.id;
            },
            onDragStart: () => {
              if (textureEditorActive) editor.selectedTextureId = row.item.id;
              else editor.selectedLibraryId = row.item.id;
            },
            onDragEnd: (mouseX, mouseY) => {
              if (textureEditorActive) createDebugTexturePlacement(row.item, mouseX, mouseY);
              else createDebugPlacement(row.item, mouseX, mouseY);
            },
          });
        }
      });
      ctx.restore();

      if (maxScroll > 0) {
        const thumbH = Math.max(24, treeH * (treeH / (treeH + maxScroll)));
        const thumbY = treeY + (treeH - thumbH) * (editor.treeScroll / maxScroll);
        draw.roundRect(treeX + treeW - 5, thumbY, 3, thumbH, 2, UI_THEME.border1, null);
      }

      const currentMapId = currentEditorMapId();
      const placements = editor.placements.filter((placement) => placement.mapId === currentMapId);
      cy = treeY + treeH + 24;
      draw.drawText('Na cena', treeX, cy - 6, {
        align: 'left',
        font: '900 10px Inter, sans-serif',
        color: UI_THEME.textDim,
      });
      const sceneListY = cy;
      const sceneMaxScroll = Math.max(0, placements.length * sceneRowH - sceneListH);
      editor.sceneScroll = clamp(editor.sceneScroll, 0, sceneMaxScroll);
      state.debugEditorSceneBounds = { x: treeX, y: sceneListY, w: treeW, h: sceneListH };
      draw.roundRect(treeX, sceneListY, treeW, sceneListH, 6, 'rgba(17,19,13,0.82)', UI_THEME.border0);

      if (placements.length === 0) {
        draw.drawText('Arraste um asset para o mapa.', treeX + 8, sceneListY + 22, {
          align: 'left',
          font: '11px Inter, sans-serif',
          color: UI_THEME.textMuted,
          maxWidth: treeW - 16,
        });
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(treeX + 1, sceneListY + 1, treeW - 2, sceneListH - 2);
        ctx.clip();

        placements.forEach((placement, index) => {
          const y = sceneListY + index * sceneRowH - editor.sceneScroll;
          if (y < sceneListY - sceneRowH || y > sceneListY + sceneListH) return;
          const selected = placement.id === editor.selectedPlacementId;
          const rowX = treeX + 3;
          const rowW = treeW - 6;
          const deleteX = treeX + treeW - sceneDeleteW - 7;

          draw.roundRect(
            rowX,
            y + 2,
            rowW,
            20,
            4,
            selected ? 'rgba(63,111,69,0.7)' : UI_THEME.surface1,
            selected ? UI_THEME.success : UI_THEME.border0,
          );
          draw.drawText(placement.modelName, treeX + 10, y + 16, {
            align: 'left',
            font: '10px Inter, sans-serif',
            color: UI_THEME.text,
            maxWidth: treeW - sceneDeleteW - 22,
          });
          draw.roundRect(deleteX, y + 4, sceneDeleteW, 16, 4, UI_THEME.dangerDark, '#fca5a5');
          draw.drawText('Excluir', deleteX + sceneDeleteW / 2, y + 15, {
            align: 'center',
            font: '900 8px Inter, sans-serif',
            color: UI_THEME.text,
          });

          if (y >= sceneListY && y + sceneRowH <= sceneListY + sceneListH) {
            state.game.buttons.push({
              x: rowX,
              y: y + 2,
              w: rowW - sceneDeleteW - 6,
              h: 20,
              onClick: () => {
                editor.selectedPlacementId = selected ? null : placement.id;
              },
            });
            state.game.buttons.push({
              x: deleteX,
              y: y + 4,
              w: sceneDeleteW,
              h: 16,
              onClick: () => {
                removeDebugPlacement(placement.id);
              },
            });
          }
        });
        ctx.restore();

        if (sceneMaxScroll > 0) {
          const thumbH = Math.max(18, sceneListH * (sceneListH / (sceneListH + sceneMaxScroll)));
          const thumbY = sceneListY + (sceneListH - thumbH) * (editor.sceneScroll / sceneMaxScroll);
          draw.roundRect(treeX + treeW - 5, thumbY, 3, thumbH, 2, UI_THEME.border1, null);
        }
      }
      cy = sceneListY + sceneListH + 12;

      const actionY = panelY + panelH - 40;
      const actionGap = 8;
      const actionW = (treeW - actionGap) / 2;
      const placement = selectedDebugPlacement();
      if (!placement) {
        if (editor.placements.length > 0) {
          draw.drawButton(treeX, actionY, treeW, actionRowH, 'Copiar tudo', () => {
            copyAllDebugPlacementSummaries();
          }, {
            fill: UI_THEME.accentDark,
            hoverFill: UI_THEME.accent,
            stroke: '#e6c06f',
            font: 'bold 11px Inter, sans-serif',
          });
          if (performance.now() - (editor.lastCopiedAt || 0) < 1800) {
            draw.drawText('Copiado.', treeX + treeW / 2, actionY - 12, {
              align: 'center',
              font: 'bold 10px Inter, sans-serif',
              color: UI_THEME.success,
            });
          }
        }
        return;
      }

      const bounds = currentEditorBounds();
      const position = placement.position || { x: 0, y: 0, z: 0 };
      const rotation = placement.rotation || { x: 0, y: 0, z: 0 };
      placement.position = position;
      placement.rotation = rotation;
      if (!Number.isFinite(placement.scale)) placement.scale = placement.kind === 'texture' ? 1 : 0.5;

      draw.drawText('Transform', treeX, cy + 4, {
        align: 'left',
        font: '900 10px Inter, sans-serif',
        color: UI_THEME.textDim,
      });
      cy += 14;

      const isTexturePlacement = placement.kind === 'texture';
      const toDegrees = (radians) => (radians || 0) * 180 / Math.PI;
      const fromSnappedDegrees = (degrees) => (snapDegrees(degrees) * Math.PI) / 180;
      if (isTexturePlacement) {
        position.y = clamp(Math.round(position.y || 1), 1, 6);
      }

      const transformSliders = isTexturePlacement
        ? [
          {
            label: 'Altura',
            value: position.y,
            min: 1,
            max: 6,
            formatValue: (value) => String(Math.round(value)),
            onChange: (value) => { position.y = clamp(Math.round(value), 1, 6); },
          },
          {
            label: 'Rot X',
            value: snapDegrees(toDegrees(rotation.x)),
            min: -180,
            max: 180,
            formatValue: (value) => `${snapDegrees(value)}deg`,
            onChange: (value) => { rotation.x = fromSnappedDegrees(value); },
          },
          {
            label: 'Rot Y',
            value: snapDegrees(toDegrees(rotation.y)),
            min: -180,
            max: 180,
            formatValue: (value) => `${snapDegrees(value)}deg`,
            onChange: (value) => { rotation.y = fromSnappedDegrees(value); },
          },
          {
            label: 'Rot Z',
            value: snapDegrees(toDegrees(rotation.z)),
            min: -180,
            max: 180,
            formatValue: (value) => `${snapDegrees(value)}deg`,
            onChange: (value) => { rotation.z = fromSnappedDegrees(value); },
          },
          {
            label: 'Tamanho',
            value: placement.scale,
            min: 0.05,
            max: 5,
            formatValue: (value) => value.toFixed(2),
            onChange: (value) => { placement.scale = value; },
          },
        ]
        : [
          {
            label: 'X',
            value: position.x,
            min: -bounds.width / 2,
            max: bounds.width / 2,
            formatValue: (value) => value.toFixed(2),
            onChange: (value) => { position.x = value; },
          },
          {
            label: 'Y altura',
            value: position.y,
            min: 0,
            max: 6,
            formatValue: (value) => value.toFixed(2),
            onChange: (value) => { position.y = value; },
          },
          {
            label: 'Z',
            value: position.z,
            min: -bounds.height / 2,
            max: bounds.height / 2,
            formatValue: (value) => value.toFixed(2),
            onChange: (value) => { position.z = value; },
          },
          {
            label: 'Direcao',
            value: ((rotation.y || 0) * 180) / Math.PI,
            min: 0,
            max: 360,
            formatValue: (value) => `${Math.round(value)}deg`,
            onChange: (value) => { rotation.y = (value * Math.PI) / 180; },
          },
          {
            label: 'Tamanho',
            value: placement.scale,
            min: 0.05,
            max: 3,
            formatValue: (value) => value.toFixed(2),
            onChange: (value) => { placement.scale = value; },
          },
        ];

      transformSliders.forEach((slider) => {
        drawDebugSlider({
          x: treeX,
          y: cy,
          w: treeW,
          label: slider.label,
          value: slider.value,
          min: slider.min,
          max: slider.max,
          formatValue: slider.formatValue,
          onChange: slider.onChange,
        });
        cy += sliderRowH;
      });

      const summaryTile = tileForWorldPosition(position);
      const summaryY = actionY - 10;
      draw.drawText(`Mapa ${placement.mapId} | tile ${summaryTile.x},${summaryTile.y}`, treeX, summaryY, {
        align: 'left',
        font: 'bold 10px Inter, sans-serif',
        color: UI_THEME.textMuted,
        maxWidth: treeW,
      });
      draw.drawButton(treeX, actionY, actionW, actionRowH, 'Copiar info', () => {
        copyDebugPlacementSummary(placement);
      }, {
        fill: UI_THEME.accentDark,
        hoverFill: UI_THEME.accent,
        stroke: '#e6c06f',
        font: 'bold 11px Inter, sans-serif',
      });
      draw.drawButton(treeX + actionW + actionGap, actionY, actionW, actionRowH, 'Copiar tudo', () => {
        copyAllDebugPlacementSummaries();
      }, {
        fill: UI_THEME.accentDark,
        hoverFill: UI_THEME.accent,
        stroke: '#e6c06f',
        font: 'bold 11px Inter, sans-serif',
      });
      if (performance.now() - (editor.lastCopiedAt || 0) < 1800) {
        draw.drawText('Copiado.', treeX + treeW / 2, summaryY - 12, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: UI_THEME.success,
        });
      }
      return;
    }

    if (activeTab === 'color') {
      syncDebugHeroOverlay(null);
      state.debugEditorTreeBounds = null;
      state.debugEditorSceneBounds = null;
      state.debugCubeListBounds = null;

      const debugColors = ensureDebugColors();
      const contentX = panelX + 16;
      const contentW = panelW - 32;
      const models = debugColorModels(debugColors);
      const selectedModel = selectedDebugColorModel(debugColors);

      draw.drawText('Modelos', contentX, cy + 4, {
        align: 'left',
        font: '900 11px Inter, sans-serif',
        color: UI_THEME.text,
      });

      const modelTileW = 36;
      const modelTileGap = 10;
      const modelSquare = 30;
      const carouselY = cy + 16;
      const carouselH = 36;
      const totalModelW = Math.max(0, models.length * modelTileW + Math.max(0, models.length - 1) * modelTileGap);
      const maxModelScroll = Math.max(0, totalModelW - contentW);
      debugColors.modelScroll = clamp(debugColors.modelScroll || 0, 0, maxModelScroll);

      ctx.save();
      ctx.beginPath();
      ctx.rect(contentX, carouselY, contentW, carouselH);
      ctx.clip();
      models.forEach((model, index) => {
        const itemX = contentX + index * (modelTileW + modelTileGap) - debugColors.modelScroll;
        if (itemX + modelTileW < contentX || itemX > contentX + contentW) return;

        const selected = model.id === debugColors.selectedColorModelId;
        const squareX = itemX + (modelTileW - modelSquare) / 2;
        const squareY = carouselY + 2;
        draw.roundRect(squareX, squareY, modelSquare, modelSquare, 5, model.values.water1, selected ? '#f2ead7' : 'rgba(242,234,215,0.72)');
        draw.roundRect(squareX + 8, squareY + 8, modelSquare - 16, modelSquare - 16, 3, model.values.top1, null);
      });
      ctx.restore();

      state.game.buttons.push({
        x: contentX,
        y: carouselY,
        w: contentW,
        h: carouselH,
        onDragStart: (mouseX) => {
          debugColors.modelDrag = {
            startX: mouseX,
            startScroll: debugColors.modelScroll || 0,
            moved: false,
          };
        },
        onDrag: (mouseX) => {
          const drag = debugColors.modelDrag;
          if (!drag) return;
          const delta = mouseX - drag.startX;
          if (Math.abs(delta) > 3) drag.moved = true;
          debugColors.modelScroll = clamp(drag.startScroll - delta, 0, maxModelScroll);
        },
        onDragEnd: (mouseX, mouseY) => {
          const drag = debugColors.modelDrag;
          debugColors.modelDrag = null;
          if (drag?.moved) return;
          const localX = mouseX - contentX + (debugColors.modelScroll || 0);
          const index = Math.floor(localX / (modelTileW + modelTileGap));
          const model = models[index];
          const itemStart = index * (modelTileW + modelTileGap);
          if (model && localX >= itemStart && localX <= itemStart + modelTileW && mouseY >= carouselY && mouseY <= carouselY + carouselH) {
            debugColors.selectedColorModelId = model.id;
          }
        },
      });

      if (maxModelScroll > 0) {
        const thumbW = Math.max(24, contentW * (contentW / (contentW + maxModelScroll)));
        const thumbX = contentX + (contentW - thumbW) * (debugColors.modelScroll / maxModelScroll);
        draw.roundRect(thumbX, carouselY + carouselH - 2, thumbW, 2, 2, UI_THEME.border1, null);
      }

      const modelActionY = carouselY + carouselH + 6;
      const modelActionGap = 8;
      const modelActionW = (contentW - modelActionGap) / 2;
      draw.drawButton(contentX, modelActionY, modelActionW, 28, 'Usar modelo', () => {
        useSelectedDebugColorModel();
      }, {
        fill: UI_THEME.surface2,
        hoverFill: UI_THEME.accentDark,
        stroke: UI_THEME.border1,
        disabled: !selectedModel,
        font: 'bold 10px Inter, sans-serif',
      });
      draw.drawButton(contentX + modelActionW + modelActionGap, modelActionY, modelActionW, 28, 'Excluir modelo', () => {
        deleteSelectedDebugColorModel();
      }, {
        fill: UI_THEME.dangerDark,
        hoverFill: UI_THEME.danger,
        stroke: '#fca5a5',
        disabled: !selectedModel,
        font: 'bold 10px Inter, sans-serif',
      });

      cy = modelActionY + 42;

      draw.drawText('Cores do mapa', contentX, cy + 4, {
        align: 'left',
        font: '900 11px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawText('Editar mostra na hora. Aplicar grava no codigo.', contentX, cy + 20, {
        align: 'left',
        font: '10px Inter, sans-serif',
        color: UI_THEME.textDim,
      });
      draw.drawText(`Mapa: ${currentEditorMapId() || 'atual'}`, contentX + contentW, cy + 20, {
        align: 'right',
        font: '900 10px Inter, sans-serif',
        color: UI_THEME.accent,
      });
      cy += 34;

      const actionY = panelY + panelH - 42;
      const listX = contentX;
      const listY = cy;
      const listW = contentW;
      const listH = Math.max(120, actionY - listY - 12);
      let totalListH = 0;
      let previousGroup = '';
      DEBUG_COLOR_FIELDS.forEach((field) => {
        if (field.group !== previousGroup) {
          previousGroup = field.group;
          totalListH += 26;
        }
        totalListH += 35;
      });
      const maxScroll = Math.max(0, totalListH - listH);
      debugColors.scroll = clamp(debugColors.scroll || 0, 0, maxScroll);
      state.debugColorListBounds = { x: listX, y: listY, w: listW, h: listH };

      draw.roundRect(listX, listY, listW, listH, 6, 'rgba(17,19,13,0.68)', UI_THEME.border0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(listX, listY, listW, listH);
      ctx.clip();

      let currentGroup = '';
      let rowCursor = listY - debugColors.scroll;
      DEBUG_COLOR_FIELDS.forEach((field) => {
        if (field.group !== currentGroup) {
          currentGroup = field.group;
          rowCursor += 12;
          draw.drawText(currentGroup, contentX, rowCursor + 4, {
            align: 'left',
            font: '900 10px Inter, sans-serif',
            color: UI_THEME.textDim,
          });
          rowCursor += 14;
        }

        const rowY = rowCursor;
        const swatchSize = 24;
        const swatchX = contentX;
        const hex = debugColors.values[field.key];
        const visible = rowY >= listY && rowY + 31 <= listY + listH;
        const hexW = 88;
        const hexH = 22;
        const hexX = contentX + contentW - hexW - 7;
        const hexY = rowY + 5;
        if (visible) {
          draw.roundRect(contentX, rowY, contentW, 31, 5, 'rgba(32,34,25,0.58)', 'rgba(111,99,66,0.5)');
          draw.roundRect(swatchX + 7, rowY + 4, swatchSize, swatchSize, 5, hex, '#f2ead7');
          draw.drawText(field.label, swatchX + 40, rowY + 14, {
            align: 'left',
            font: '900 10px Inter, sans-serif',
            color: UI_THEME.text,
            maxWidth: 86,
          });
          draw.drawText(field.description, swatchX + 40, rowY + 27, {
            align: 'left',
            font: '9px Inter, sans-serif',
            color: UI_THEME.textDim,
            maxWidth: 108,
          });
          draw.roundRect(hexX, hexY, hexW, hexH, 4, 'rgba(13,15,11,0.72)', 'rgba(111,99,66,0.7)');
          state.game.buttons.push({
            x: contentX,
            y: rowY,
            w: contentW,
            h: 31,
            onClick: () => {
              openDebugColorPicker(field.key);
            },
          });
        }
        syncDebugColorInput(field.key, {
          x: swatchX + 7,
          y: rowY + 4,
          size: swatchSize,
          value: hex,
          visible,
        });
        syncDebugColorHexInput(field.key, {
          x: hexX + 2,
          y: hexY + 1,
          w: hexW - 4,
          h: hexH - 2,
          value: hex,
          visible,
        });
        rowCursor += 35;
      });
      ctx.restore();

      if (maxScroll > 0) {
        const thumbH = Math.max(18, listH * (listH / (listH + maxScroll)));
        const thumbY = listY + (listH - thumbH) * (debugColors.scroll / maxScroll);
        draw.roundRect(listX + listW - 5, thumbY, 3, thumbH, 2, UI_THEME.border1, null);
      }

      const bottomActionGap = 8;
      const bottomActionW = (contentW - bottomActionGap) / 2;
      draw.drawButton(contentX, actionY, bottomActionW, 30, 'Salvar modelo', () => {
        saveCurrentDebugColorModel();
      }, {
        fill: UI_THEME.surface2,
        hoverFill: UI_THEME.accentDark,
        stroke: UI_THEME.border1,
        font: 'bold 11px Inter, sans-serif',
      });
      draw.drawButton(contentX + bottomActionW + bottomActionGap, actionY, bottomActionW, 30, 'Aplicar', () => {
        applyDebugColorsToCurrentMap();
      }, {
        fill: UI_THEME.accentDark,
        hoverFill: UI_THEME.accent,
        stroke: '#e6c06f',
        font: 'bold 11px Inter, sans-serif',
      });
      if (debugColors.applyStatus === 'pending') {
        draw.drawText('Aplicando no codigo...', contentX + contentW / 2, actionY - 10, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: UI_THEME.accent,
        });
      } else if (debugColors.applyStatus === 'failed') {
        draw.drawText('Falha ao aplicar no codigo.', contentX + contentW / 2, actionY - 10, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: UI_THEME.danger,
        });
      } else if (performance.now() - (debugColors.lastModelSavedAt || 0) < 1800) {
        draw.drawText('Modelo salvo.', contentX + contentW / 2, actionY - 10, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: UI_THEME.success,
        });
      } else if (performance.now() - (debugColors.lastModelUsedAt || 0) < 1800) {
        draw.drawText('Modelo aplicado na edicao.', contentX + contentW / 2, actionY - 10, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: UI_THEME.success,
        });
      } else if (performance.now() - (debugColors.lastModelDeletedAt || 0) < 1800) {
        draw.drawText('Modelo excluido.', contentX + contentW / 2, actionY - 10, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: UI_THEME.danger,
        });
      } else if (performance.now() - (debugColors.lastAppliedAt || 0) < 1800) {
        draw.drawText('Cores aplicadas.', contentX + contentW / 2, actionY - 10, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: UI_THEME.success,
        });
      }
      return;
    }

    if (activeTab === 'cube') {
      syncDebugHeroOverlay(null);
      state.debugEditorTreeBounds = null;
      state.debugEditorSceneBounds = null;

      const debugCubes = ensureDebugCubes();
      const currentMapId = currentEditorMapId();
      const cubes = currentDebugCubes();
      const contentX = panelX + 16;
      const contentW = panelW - 32;

      drawDebugToggle({
        x: contentX,
        y: cy,
        w: contentW,
        label: 'Modo cubo',
        checked: !!debugCubes.enabled,
        onChange: () => {
          debugCubes.enabled = !debugCubes.enabled;
        },
      });

      cy += 42;
      draw.drawText(`Mapa: ${currentMapId || 'atual'}`, contentX, cy, {
        align: 'left',
        font: '900 10px Inter, sans-serif',
        color: UI_THEME.textDim,
      });
      draw.drawText(`${cubes.length} cubo${cubes.length === 1 ? '' : 's'}`, contentX + contentW, cy, {
        align: 'right',
        font: '900 10px Inter, sans-serif',
        color: UI_THEME.textMuted,
      });

      cy += 12;
      const actionGap = 8;
      const actionW = (contentW - actionGap) / 2;
      draw.drawButton(contentX, cy, actionW, 30, 'Copiar tudo', () => {
        copyAllDebugCubeSummaries();
      }, {
        fill: UI_THEME.accentDark,
        hoverFill: UI_THEME.accent,
        stroke: '#e6c06f',
        disabled: debugCubes.placements.length === 0,
        font: 'bold 11px Inter, sans-serif',
      });
      draw.drawButton(contentX + actionW + actionGap, cy, actionW, 30, 'Desmarcar', () => {
        debugCubes.selectedCubeId = null;
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
        disabled: !debugCubes.selectedCubeId,
        font: 'bold 11px Inter, sans-serif',
      });

      if (performance.now() - (debugCubes.lastCopiedAt || 0) < 1800) {
        draw.drawText('Cubos copiados.', contentX + contentW / 2, cy + 44, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: UI_THEME.success,
        });
      }

      cy += 44;
      draw.drawText('Cubos colocados', contentX, cy, {
        align: 'left',
        font: '900 10px Inter, sans-serif',
        color: UI_THEME.textDim,
      });

      cy += 10;
      const listX = contentX;
      const listY = cy;
      const listW = contentW;
      const listH = Math.max(60, panelY + panelH - listY - 16);
      const rowH = 42;
      const deleteW = 58;
      const maxScroll = Math.max(0, cubes.length * rowH - listH);
      debugCubes.listScroll = clamp(debugCubes.listScroll || 0, 0, maxScroll);
      state.debugCubeListBounds = { x: listX, y: listY, w: listW, h: listH };

      draw.roundRect(listX, listY, listW, listH, 6, 'rgba(17,19,13,0.82)', UI_THEME.border0);
      if (cubes.length === 0) {
        draw.drawText('Nenhum cubo neste mapa.', listX + listW / 2, listY + listH / 2 + 4, {
          align: 'center',
          font: 'bold 11px Inter, sans-serif',
          color: UI_THEME.textMuted,
        });
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(listX, listY, listW, listH);
        ctx.clip();
        cubes.forEach((cube, index) => {
          const rowY = listY + index * rowH - debugCubes.listScroll;
          if (rowY + rowH < listY || rowY > listY + listH) return;

          const selected = cube.id === debugCubes.selectedCubeId;
          draw.roundRect(
            listX + 6,
            rowY + 5,
            listW - 12,
            rowH - 8,
            5,
            selected ? 'rgba(154,111,42,0.62)' : 'rgba(32,34,25,0.72)',
            selected ? '#f2c94c' : 'rgba(111,99,66,0.65)',
          );
          draw.drawText(`Tile ${cube.x},${cube.y} | nível ${Math.max(0, cube.level ?? 0) + 1}`, listX + 16, rowY + 19, {
            align: 'left',
            font: '900 11px Inter, sans-serif',
            color: selected ? UI_THEME.text : UI_THEME.textMuted,
            maxWidth: listW - deleteW - 34,
          });
          draw.drawText(cube.id, listX + 16, rowY + 33, {
            align: 'left',
            font: '9px Inter, sans-serif',
            color: UI_THEME.textDim,
            maxWidth: listW - deleteW - 34,
          });

          const deleteX = listX + listW - deleteW - 10;
          draw.roundRect(deleteX, rowY + 12, deleteW, 18, 4, UI_THEME.dangerDark, '#fca5a5');
          draw.drawText('Excluir', deleteX + deleteW / 2, rowY + 25, {
            align: 'center',
            font: '900 9px Inter, sans-serif',
            color: UI_THEME.text,
          });

          state.game.buttons.push({
            x: listX + 6,
            y: rowY + 5,
            w: listW - deleteW - 22,
            h: rowH - 8,
            onClick: () => {
              debugCubes.selectedCubeId = selected ? null : cube.id;
            },
          });
          state.game.buttons.push({
            x: deleteX,
            y: rowY + 12,
            w: deleteW,
            h: 18,
            onClick: () => {
              removeDebugCube(cube.id);
            },
          });
        });
        ctx.restore();

        if (maxScroll > 0) {
          const thumbH = Math.max(18, listH * (listH / (listH + maxScroll)));
          const thumbY = listY + (listH - thumbH) * (debugCubes.listScroll / maxScroll);
          draw.roundRect(listX + listW - 5, thumbY, 3, thumbH, 2, UI_THEME.border1, null);
        }
      }
      return;
    }

    if (activeTab === 'hero') {
      const heroCardX = panelX + 16;
      const heroCardY = cy + 8;
      const heroCardW = panelW - 32;
      const heroCardH = Math.max(178, panelH - (heroCardY - panelY) - 16);
      draw.roundRect(heroCardX, heroCardY, heroCardW, heroCardH, 6, 'rgba(17,19,13,0.82)', UI_THEME.border0);
      syncDebugHeroOverlay({
        x: heroCardX + 12,
        y: heroCardY + 12,
        w: heroCardW - 24,
        h: heroCardH - 24,
      });
      return;
    }

    syncDebugHeroOverlay(null);

    const debugVisualSettings = ensureDebugVisualSettingsState();
    const controls = [
      { label: 'Exposicao', key: 'exposure', min: 0.1, max: 3.0, digits: 2 },
      { label: 'Luz ambiente', key: 'ambientIntensity', min: 0, max: 3.0, digits: 2 },
      { label: 'Luz direta', key: 'keyIntensity', min: 0, max: 5.0, digits: 2 },
      { label: 'Direcao da luz', key: 'keyLightDirectionDeg', min: 0, max: 360, digits: 0, suffix: 'deg' },
      { label: 'Nevoa', key: 'fogDensity', min: 0, max: 0.1, digits: 3 },
    ];

    controls.forEach((ctrl) => {
      cy += 44;
      drawDebugSlider({
        x: panelX + 16,
        y: cy - 28,
        w: panelW - 32,
        label: ctrl.label,
        value: state.visuals[ctrl.key],
        min: ctrl.min,
        max: ctrl.max,
        formatValue: (value) => `${value.toFixed(ctrl.digits)}${ctrl.suffix || ''}`,
        onChange: (value) => {
          state.visuals[ctrl.key] = clamp(value, ctrl.min, ctrl.max);
        },
      });
    });

    cy += 18;
    drawDebugToggle({
      x: panelX + 16,
      y: cy,
      w: panelW - 32,
      label: 'Sombras',
      checked: state.visuals.shadowMapEnabled,
      onChange: () => {
        state.visuals.shadowMapEnabled = !state.visuals.shadowMapEnabled;
      },
    });

    cy += 34;
    drawDebugToggle({
      x: panelX + 16,
      y: cy,
      w: panelW - 32,
      label: 'Bordas',
      checked: state.visuals.showOutlines,
      onChange: () => {
        state.visuals.showOutlines = !state.visuals.showOutlines;
      },
    });

    cy += 34;
    drawDebugToggle({
      x: panelX + 16,
      y: cy,
      w: panelW - 32,
      label: 'Mostrar grade',
      checked: !!state.visuals.showGrid,
      onChange: () => {
        state.visuals.showGrid = !state.visuals.showGrid;
      },
    });

    cy += 34;
    drawDebugToggle({
      x: panelX + 16,
      y: cy,
      w: panelW - 32,
      label: 'Camera ortografica',
      checked: !!state.visuals.overworldOrthographicCamera,
      onChange: () => {
        state.visuals.overworldOrthographicCamera = !state.visuals.overworldOrthographicCamera;
      },
    });

    cy += 34;
    drawDebugToggle({
      x: panelX + 16,
      y: cy,
      w: panelW - 32,
      label: 'Água',
      checked: state.visuals.overworldWater !== false,
      onChange: () => {
        state.visuals.overworldWater = !(state.visuals.overworldWater !== false);
      },
    });

    const actionY = cy + 42;
    draw.drawButton(panelX + 16, actionY, panelW - 32, 30, 'Aplicar ajustes', () => {
      applyDebugVisualSettings();
    }, {
      fill: UI_THEME.accentDark,
      hoverFill: UI_THEME.accent,
      stroke: '#e6c06f',
      font: 'bold 11px Inter, sans-serif',
    });

    if (debugVisualSettings.applyStatus === 'pending') {
      draw.drawText('Aplicando no codigo...', panelX + panelW / 2, actionY - 10, {
        align: 'center',
        font: 'bold 10px Inter, sans-serif',
        color: UI_THEME.accent,
      });
    } else if (debugVisualSettings.applyStatus === 'failed') {
      draw.drawText('Falha ao aplicar ajustes.', panelX + panelW / 2, actionY - 10, {
        align: 'center',
        font: 'bold 10px Inter, sans-serif',
        color: UI_THEME.danger,
      });
    } else if (performance.now() - (debugVisualSettings.lastAppliedAt || 0) < 1800) {
      draw.drawText('Ajustes aplicados.', panelX + panelW / 2, actionY - 10, {
        align: 'center',
        font: 'bold 10px Inter, sans-serif',
        color: UI_THEME.success,
      });
    }
  }

  function drawDebugPanel(x, y, w) {
    let cy = y;
    
    draw.roundRect(x, cy, w, 220, 8, 'rgba(23,25,18,0.88)', UI_THEME.border0);
    
    cy += 20;
    draw.drawText('AJUSTES VISUAIS', x + w / 2, cy, { align: 'center', font: '900 11px Inter, sans-serif', color: UI_THEME.textDim });
    cy += 24;

    const controls = [
      { label: 'Expos.', key: 'exposure', step: 0.1, min: 0.1, max: 3.0 },
      { label: 'Amb.', key: 'ambientIntensity', step: 0.1, min: 0, max: 3.0 },
      { label: 'Dir.', key: 'keyIntensity', step: 0.1, min: 0, max: 5.0 },
      { label: 'Névoa', key: 'fogDensity', step: 0.005, min: 0, max: 0.1 },
    ];

    controls.forEach(ctrl => {
      const val = state.visuals[ctrl.key];
      draw.drawText(`${ctrl.label}: ${val.toFixed(3)}`, x + 12, cy + 14, { font: '10px Inter, sans-serif', color: UI_THEME.textDim });
      
      draw.drawButton(x + w - 52, cy, 20, 18, '-', () => {
        state.visuals[ctrl.key] = Math.max(ctrl.min, state.visuals[ctrl.key] - ctrl.step);
      }, { fill: UI_THEME.surface1, stroke: UI_THEME.border0, font: 'bold 12px Inter' });

      draw.drawButton(x + w - 28, cy, 20, 18, '+', () => {
        state.visuals[ctrl.key] = Math.min(ctrl.max, state.visuals[ctrl.key] + ctrl.step);
      }, { fill: UI_THEME.surface1, stroke: UI_THEME.border0, font: 'bold 12px Inter' });

      cy += 24;
    });

    cy += 8;
    const shadowLabel = state.visuals.shadowMapEnabled ? 'Sombras: ON' : 'Sombras: OFF';
    draw.drawButton(x + 10, cy, (w / 2) - 14, 22, shadowLabel, () => {
      state.visuals.shadowMapEnabled = !state.visuals.shadowMapEnabled;
    }, { fill: state.visuals.shadowMapEnabled ? UI_THEME.successDark : UI_THEME.surface1, stroke: UI_THEME.border0, font: 'bold 9px Inter' });

    const outlineLabel = state.visuals.showOutlines ? 'Bordas: ON' : 'Bordas: OFF';
    draw.drawButton(x + (w / 2) + 4, cy, (w / 2) - 14, 22, outlineLabel, () => {
      state.visuals.showOutlines = !state.visuals.showOutlines;
    }, { fill: state.visuals.showOutlines ? UI_THEME.successDark : UI_THEME.surface1, stroke: UI_THEME.border0, font: 'bold 9px Inter' });
  }

  return {
    start() {
      if (disposed || renderFrameId !== null) return;
      render();
    },
    dispose() {
      disposed = true;
      if (renderFrameId !== null) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
      }
      hideDebugColorInputs();
      debugColorInputs.forEach((input) => input.remove());
      debugColorHexInputs.forEach((input) => input.remove());
      debugHeroOverlay.remove();
      threeBoard.dispose?.();
    },
  };
}
