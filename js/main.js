import { createGameActions } from './game/game-actions.js';
import { createGame, loadCardImages } from './game/game-factories.js';
import { registerCanvasInput } from './ui/input.js';
import { createLayoutTools } from './ui/layout.js';
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
  debugZoom: 1.0,
  visuals: {
    exposure: 1.0,
    ambientIntensity: 1.05,
    keyIntensity: 1.75,
    fogDensity: 0.0,
    shadowMapEnabled: false,
    showOutlines: false,
  },
};

const cardImages = loadCardImages();
const actions = createGameActions(state);
const layout = createLayoutTools({ canvas, ctx, state });
const renderer = createRenderer({
  canvas,
  ctx,
  cardImages,
  state,
  actions,
  layout,
});

if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  window.__ONE_RPG_DEBUG__ = { state, actions, layout };
}

window.addEventListener('resize', layout.resize);
layout.resize();
registerCanvasInput({ canvas, state, actions, layout });
renderer.start();
