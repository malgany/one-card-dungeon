import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_MODES, PHASES } from '../../js/config/game-data.js';
import { registerCanvasInput } from '../../js/ui/input.js';

const cleanupCallbacks = [];

function createInputHarness() {
  const listeners = new Map();
  const canvas = {
    addEventListener: vi.fn((name, handler) => listeners.set(name, handler)),
    removeEventListener: vi.fn((name) => listeners.delete(name)),
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
    getOverworldEnemyAt: vi.fn(() => null),
    moveOverworldPlayer: vi.fn(),
    movePlayer: vi.fn(),
    startOverworldEncounter: vi.fn(),
    getAvailableAttacks: vi.fn(() => []),
    toggleAttackSelection: vi.fn(),
    endHeroPhase: vi.fn(),
    advanceCutscene: vi.fn(),
    skipCutscene: vi.fn(),
  };
  const layout = {
    pointInRect: (px, py, rect) => px >= rect.x && py >= rect.y && px <= rect.x + rect.w && py <= rect.y + rect.h,
    getLayout: vi.fn(() => ({})),
    tileAt: vi.fn(() => null),
  };

  const unregister = registerCanvasInput({ canvas, state, actions, layout });
  cleanupCallbacks.push(unregister);
  return { actions, listeners, layout, state, unregister };
}

describe('canvas input', () => {
  afterEach(() => {
    while (cleanupCallbacks.length > 0) cleanupCallbacks.pop()?.();
  });

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

  it('drops the selected attack when clicking outside the board', () => {
    const { actions, layout, listeners, state } = createInputHarness();
    state.game.phase = PHASES.HERO;
    state.game.selectedAttackId = 'strike';
    layout.tileAt.mockReturnValue(null);

    listeners.get('click')();

    expect(state.game.selectedAttackId).toBe(null);
    expect(actions.attackTile).not.toHaveBeenCalled();
    expect(actions.movePlayer).not.toHaveBeenCalled();
  });

  it('starts overworld encounters or moves on empty overworld tiles', () => {
    const { actions, layout, listeners, state } = createInputHarness();
    state.game.mode = GAME_MODES.OVERWORLD;
    state.game.phase = PHASES.HERO;
    state.game.player = { x: 0, y: 0 };
    const enemy = { id: 'e1', x: 1, y: 0 };
    layout.tileAt.mockReturnValueOnce({ x: 1, y: 0 }).mockReturnValueOnce({ x: 2, y: 0 });
    actions.getOverworldEnemyAt.mockReturnValueOnce(enemy).mockReturnValueOnce(null);

    listeners.get('click')();
    expect(actions.startOverworldEncounter).toHaveBeenCalledWith('e1');

    listeners.get('click')();
    expect(actions.moveOverworldPlayer).toHaveBeenCalledWith({ x: 2, y: 0 });
  });

  it('ignores clicks while a cutscene is active', () => {
    const { actions, layout, listeners, state } = createInputHarness();
    state.game.mode = GAME_MODES.OVERWORLD;
    state.game.phase = PHASES.HERO;
    state.game.cutscene = { id: 'nursery-intro' };
    layout.tileAt.mockReturnValue({ x: 2, y: 0 });

    listeners.get('click')();

    expect(layout.tileAt).not.toHaveBeenCalled();
    expect(actions.moveOverworldPlayer).not.toHaveBeenCalled();
    expect(actions.startOverworldEncounter).not.toHaveBeenCalled();
    expect(actions.advanceCutscene).toHaveBeenCalledTimes(1);
  });

  it('allows cutscene buttons while board input is blocked', () => {
    const { actions, layout, listeners, state } = createInputHarness();
    const onClick = vi.fn();
    state.game.mode = GAME_MODES.OVERWORLD;
    state.game.phase = PHASES.HERO;
    state.game.cutscene = { id: 'nursery-intro' };
    state.game.buttons = [{ x: 0, y: 0, w: 20, h: 20, onClick }];
    state.mouse = { x: 5, y: 5 };
    layout.tileAt.mockReturnValue({ x: 2, y: 0 });

    listeners.get('click')();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(layout.tileAt).not.toHaveBeenCalled();
    expect(actions.moveOverworldPlayer).not.toHaveBeenCalled();
    expect(actions.advanceCutscene).not.toHaveBeenCalled();
  });

  it('allows debug drag controls while a cutscene is active', () => {
    const { listeners, state } = createInputHarness();
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    state.game.cutscene = { id: 'nursery-intro' };
    state.game.buttons = [{
      x: 0,
      y: 0,
      w: 20,
      h: 20,
      onDragStart,
      onDragEnd,
    }];
    state.mouse = { x: 5, y: 5 };

    listeners.get('mousedown')();
    expect(onDragStart).toHaveBeenCalledWith(5, 5);
    expect(state.game.draggingControl).toBe(state.game.buttons[0]);

    listeners.get('mouseup')();
    expect(onDragEnd).toHaveBeenCalledWith(5, 5);
    expect(state.game.draggingControl).toBe(null);
  });

  it('advances cutscenes with keyboard confirm keys', () => {
    const { actions, state } = createInputHarness();
    state.game.cutscene = { id: 'nursery-intro' };

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));

    expect(actions.advanceCutscene).toHaveBeenCalledTimes(2);
  });

  it('activates water-mode overworld connections only from bridge clicks', () => {
    const { actions, layout, listeners, state } = createInputHarness();
    state.game.mode = GAME_MODES.OVERWORLD;
    state.game.phase = PHASES.HERO;
    state.game.player = { x: 0, y: 0 };
    state.game.overworld = { currentMapId: 'chao3-start', mapStates: {} };
    state.visuals = { overworldWater: true };

    layout.tileAt
      .mockReturnValueOnce({ x: 2, y: 0 })
      .mockReturnValueOnce({ x: 2, y: 0, kind: 'connectionBridge' })
      .mockReturnValueOnce({ x: 2, y: 0, kind: 'connectionBridge' });

    listeners.get('click')();
    expect(actions.moveOverworldPlayer).toHaveBeenLastCalledWith({ x: 2, y: 0 }, { activateConnection: false });

    listeners.get('click')();
    expect(actions.moveOverworldPlayer).toHaveBeenLastCalledWith(
      { x: 2, y: 0, kind: 'connectionBridge' },
      { activateConnection: true },
    );

    state.game.player = { x: 2, y: 0 };
    listeners.get('click')();
    expect(actions.moveOverworldPlayer).toHaveBeenLastCalledWith(
      { x: 2, y: 0, kind: 'connectionBridge' },
      { activateConnection: true },
    );
  });

  it('uses the current map water draft for overworld connection clicks', () => {
    const { actions, layout, listeners, state } = createInputHarness();
    state.game.mode = GAME_MODES.OVERWORLD;
    state.game.phase = PHASES.HERO;
    state.game.player = { x: 0, y: 0 };
    state.game.overworld = {
      currentMapId: 'chao3-start',
      mapStates: {
        'chao3-start': {
          debugVisualSettings: { values: { overworldWater: false } },
        },
      },
    };
    state.visuals = { overworldWater: true };

    layout.tileAt.mockReturnValue({ x: 2, y: 0 });

    listeners.get('click')();

    expect(actions.moveOverworldPlayer).toHaveBeenLastCalledWith({ x: 2, y: 0 });
  });

  it('snaps dragged editor models to outside lower-ground tile centers', () => {
    const { listeners, state } = createInputHarness();
    const placement = {
      id: 'model-1',
      kind: 'model',
      position: { x: 0, y: 0, z: 0 },
    };
    state.game.phase = PHASES.HERO;
    state.debugPanelOpen = true;
    state.debugPanelTab = 'editor';
    state.debugPanelBounds = { x: 200, y: 200, w: 100, h: 100 };
    state.debugEditor = {
      selectedPlacementId: placement.id,
      placements: [placement],
    };
    state.boardInteraction = {
      worldPointAtAny: vi.fn(() => ({ x: -1, y: 10, worldX: -2.6, worldZ: 7.2 })),
      worldPointAtLower: vi.fn(() => ({ x: -2, y: 7, worldX: -4.5, worldZ: 4.5 })),
    };

    listeners.get('mousedown')({ clientX: 20, clientY: 30 });

    expect(placement.position).toEqual({ x: -4.5, y: -0.62, z: 4.5 });
  });

  it('selects action slots with top-row and numpad number keys', () => {
    const { actions, state } = createInputHarness();
    state.game.phase = PHASES.HERO;
    actions.getAvailableAttacks.mockReturnValue([
      { id: 'slot-1' },
      { id: 'slot-2' },
      { id: 'slot-3' },
      { id: 'slot-4' },
      { id: 'slot-5' },
      { id: 'slot-6' },
    ]);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Numpad6', bubbles: true }));

    expect(actions.toggleAttackSelection).toHaveBeenNthCalledWith(1, 'slot-1');
    expect(actions.toggleAttackSelection).toHaveBeenNthCalledWith(2, 'slot-6');
  });

  it('ends the hero turn with the space key', () => {
    const { actions, state } = createInputHarness();
    state.game.phase = PHASES.HERO;

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));

    expect(actions.endHeroPhase).toHaveBeenCalledTimes(1);
  });

  it('does not trigger gameplay shortcuts while typing in inputs', () => {
    const { actions } = createInputHarness();
    actions.getAvailableAttacks.mockReturnValue([{ id: 'slot-1' }]);
    const input = document.createElement('input');
    document.body.append(input);

    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    input.remove();

    expect(actions.toggleAttackSelection).not.toHaveBeenCalled();
    expect(actions.endHeroPhase).not.toHaveBeenCalled();
  });
});
