import { describe, expect, it, vi } from 'vitest';
import { PHASES } from '../../js/config/game-data.js';
import { registerCanvasInput } from '../../js/ui/input.js';

function createInputHarness() {
  const listeners = new Map();
  const canvas = {
    addEventListener: vi.fn((name, handler) => listeners.set(name, handler)),
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
  };
  const state = {
    mouse: { x: 0, y: 0 },
    suppressClick: false,
    game: {
      phase: PHASES.ENERGY,
      busy: false,
      roll: [2, 3, 4],
      diceRects: [
        { x: 0, y: 0, w: 10, h: 10, dieIndex: 0 },
        { x: 20, y: 0, w: 10, h: 10, dieIndex: 1 },
      ],
      dropZones: [
        { x: 0, y: 20, w: 20, h: 20, stat: 'speed' },
        { x: 30, y: 20, w: 20, h: 20, stat: 'attack' },
        { x: 60, y: 20, w: 20, h: 20, stat: 'defense' },
      ],
      energyAssigned: { speed: null, attack: null, defense: null },
      draggingDie: null,
      selectedAttackId: null,
      buttons: [],
      menuOpen: false,
      monsters: [],
      player: { x: 0, y: 0 },
    },
  };
  const actions = {
    assignedStatForDie: vi.fn((dieIndex) => {
      return Object.entries(state.game.energyAssigned).find(([, value]) => value === dieIndex)?.[0] ?? null;
    }),
    setEvent: vi.fn(),
    getAttackableMonsters: vi.fn(() => new Set()),
    attackMonster: vi.fn(),
    attackTile: vi.fn(),
    movePlayer: vi.fn(),
  };
  const layout = {
    pointInRect: (px, py, rect) => px >= rect.x && py >= rect.y && px <= rect.x + rect.w && py <= rect.y + rect.h,
    getLayout: vi.fn(() => ({})),
    tileAt: vi.fn(() => null),
  };

  registerCanvasInput({ canvas, state, actions, layout });
  return { actions, listeners, layout, state };
}

describe('canvas input', () => {
  it('updates mouse position relative to the canvas', () => {
    const { listeners, state } = createInputHarness();

    listeners.get('mousemove')({ clientX: 30, clientY: 45 });

    expect(state.mouse).toEqual({ x: 20, y: 25 });
  });

  it('drags a die into a drop zone and auto-fills the last remaining stat', () => {
    const { actions, listeners, state } = createInputHarness();

    state.mouse = { x: 5, y: 5 };
    listeners.get('mousedown')();
    expect(state.game.draggingDie).toMatchObject({ dieIndex: 0, fromStat: null });

    state.mouse = { x: 5, y: 25 };
    listeners.get('mouseup')();

    expect(state.game.energyAssigned.speed).toBe(0);
    expect(state.game.draggingDie).toBe(null);
    expect(state.suppressClick).toBe(true);
    expect(actions.setEvent).toHaveBeenCalledWith('Velocidade recebeu o dado 2.');

    state.mouse = { x: 25, y: 5 };
    listeners.get('mousedown')();
    state.mouse = { x: 35, y: 25 };
    listeners.get('mouseup')();

    expect(state.game.energyAssigned).toEqual({ speed: 0, attack: 1, defense: 2 });
  });

  it('clicks buttons before board actions and suppresses drag clicks', () => {
    const { listeners, state } = createInputHarness();
    const onClick = vi.fn();
    state.game.buttons = [{ x: 0, y: 0, w: 20, h: 20, onClick }];
    state.mouse = { x: 5, y: 5 };

    state.suppressClick = true;
    listeners.get('click')();
    expect(onClick).not.toHaveBeenCalled();
    expect(state.suppressClick).toBe(false);

    listeners.get('click')();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('attacks monsters or moves to empty tiles in hero phase', () => {
    const { actions, layout, listeners, state } = createInputHarness();
    state.game.phase = PHASES.HERO;
    state.game.monsters = [{ id: 'm1', x: 1, y: 0 }];
    actions.getAttackableMonsters.mockReturnValue(new Set(['m1']));
    layout.tileAt.mockReturnValueOnce({ x: 1, y: 0 }).mockReturnValueOnce({ x: 2, y: 0 });

    listeners.get('click')();
    expect(actions.attackMonster).toHaveBeenCalledWith('m1');

    listeners.get('click')();
    expect(actions.movePlayer).toHaveBeenCalledWith({ x: 2, y: 0 });
  });

  it('targets board cells instead of moving while an attack is selected', () => {
    const { actions, layout, listeners, state } = createInputHarness();
    state.game.phase = PHASES.HERO;
    state.game.selectedAttackId = 'strike';
    layout.tileAt.mockReturnValue({ x: 2, y: 0 });

    listeners.get('click')();

    expect(actions.attackTile).toHaveBeenCalledWith({ x: 2, y: 0 });
    expect(actions.movePlayer).not.toHaveBeenCalled();
  });
});
