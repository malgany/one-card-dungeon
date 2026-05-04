import { createGameActions } from './game/game-actions.js';
import { createGame, loadCardImages } from './game/game-factories.js';
import { DEBUG_CONFIG } from './config/game-data.js';
import { DEFAULT_MAP_COLOR_VALUES } from './config/map-colors.js';
import { registerCanvasInput } from './ui/input.js';
import { createLayoutTools } from './ui/layout.js';
import { createMenuFlow } from './ui/menu-flow.js';
import { createRenderer } from './ui/renderer.js';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas #game nao encontrado.');
}

const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Contexto 2D nao disponivel.');
}

const state = {
  game: createGame(),
  mouse: { x: 0, y: 0 },
  suppressClick: false,
  debugZoom: 1.15,
  debugPanelOpen: false,
  debugPanelPosition: { x: 12, y: 56 },
  debugPanelDragOffset: null,
  debugPanelTab: 'settings',
  debugHero: {
    selectedAnimationId: null,
  },
  debugCubes: {
    enabled: false,
    placements: [],
    selectedCubeId: null,
    lastCopiedAt: 0,
    listScroll: 0,
  },
  debugColors: {
    values: { ...DEFAULT_MAP_COLOR_VALUES },
    lastCopiedAt: 0,
    lastAppliedAt: 0,
    applyStatus: null,
    scroll: 0,
  },
  debugEditor: {
    expandedFolders: {},
    placements: [],
    selectedPlacementId: null,
    selectedLibraryId: null,
    treeScroll: 0,
    lastCopiedAt: 0,
  },
  visuals: {
    exposure: 1.0,
    ambientIntensity: 1.05,
    keyIntensity: 1.75,
    keyLightDirectionDeg: 84,
    fogDensity: 0.0,
    shadowMapEnabled: true,
    showOutlines: false,
    showGrid: false,
    overworldOrthographicCamera: true,
    overworldWater: true,
  },
};

const cardImages = loadCardImages();
const actions = createGameActions(state);
const layout = createLayoutTools({ canvas, ctx, state });
const menuFlow = createMenuFlow({ state, actions });
const renderer = createRenderer({
  canvas,
  ctx,
  cardImages,
  state,
  actions,
  layout,
  onExitToMainMenu: menuFlow.show,
});

if (DEBUG_CONFIG.SHOW_STATS && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  window.__ONE_RPG_DEBUG__ = { state, actions, layout, menuFlow };
}

window.addEventListener('resize', layout.resize);
layout.resize();
const unregisterCanvasInput = registerCanvasInput({ canvas, state, actions, layout });
if (DEBUG_CONFIG.SHOW_STATS) menuFlow.showDebugEntry();
else menuFlow.show();
renderer.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    renderer.dispose?.();
    menuFlow.dispose?.();
    unregisterCanvasInput?.();
    window.removeEventListener('resize', layout.resize);
    if (window.__ONE_RPG_DEBUG__?.state === state) delete window.__ONE_RPG_DEBUG__;
  });
}
