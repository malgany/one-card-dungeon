import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVELS, PHASES, SAVE_KEY, TIMING } from '../../js/config/game-data.js';
import { createGameActions } from '../../js/game/game-actions.js';
import { createGame, createMonster } from '../../js/game/game-factories.js';

function createActionHarness(game = createGame()) {
  const state = { game };
  return { state, actions: createGameActions(state) };
}

describe('game actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    localStorage.clear();
  });

  it('starts a hero turn with fixed movement and AP', () => {
    const { state, actions } = createActionHarness();

    state.game.speedRemaining = 0;
    state.game.apRemaining = 0;
    state.game.selectedAttackId = 'strike';
    actions.startHeroTurn('prepare');

    expect(state.game.phase).toBe(PHASES.HERO);
    expect(state.game.roll).toEqual([]);
    expect(state.game.assignment).toEqual({ speed: 0, attack: 0, defense: 0 });
    expect(state.game.speedRemaining).toBe(state.game.player.speedBase);
    expect(state.game.apRemaining).toBe(state.game.player.apMax);
    expect(state.game.selectedAttackId).toBe(null);
  });

  it('returns reachable player tiles within remaining speed', () => {
    const { state, actions } = createActionHarness();
    state.game.phase = PHASES.HERO;
    state.game.monsters = [];
    state.game.player = { ...state.game.player, x: 0, y: 5 };
    state.game.speedRemaining = 1;

    const reachable = actions.getReachableTiles();

    expect(reachable.has('0,4')).toBe(true);
    expect(reachable.get('0,4').cost).toBe(1);
    expect(reachable.has('1,4')).toBe(false);
    expect(reachable.has('0,5')).toBe(false);
  });

  it('moves the player and releases busy state after movement timing', () => {
    const { state, actions } = createActionHarness();
    state.game.phase = PHASES.HERO;
    state.game.monsters = [];
    state.game.player = { ...state.game.player, x: 0, y: 5 };
    state.game.speedRemaining = 1;

    actions.movePlayer({ x: 0, y: 4 });

    expect(state.game.player).toMatchObject({ x: 0, y: 4 });
    expect(state.game.speedRemaining).toBe(0);
    expect(state.game.busy).toBe(true);
    expect(state.game.animations.some((anim) => anim.type === 'movement')).toBe(true);

    vi.advanceTimersByTime(TIMING.PLAYER_MOVE_SPEED);
    expect(state.game.busy).toBe(false);
  });

  it('attacks a reachable monster and removes it when defeated', () => {
    const monster = createMonster('spider', 1, 5, 0);
    monster.hp = 4;
    const game = createGame();
    game.phase = PHASES.HERO;
    game.player = { ...game.player, x: 0, y: 5, health: 59, rangeBase: 2 };
    game.monsters = [monster];
    game.apRemaining = 5;
    game.selectedAttackId = game.player.attackSlot.id;
    const { state, actions } = createActionHarness(game);

    expect(actions.getAttackableMonsters()).toEqual(new Set([monster.id]));

    actions.attackMonster(monster.id);

    expect(state.game.apRemaining).toBe(0);
    expect(state.game.player.health).toBe(60);
    expect(monster.hp).toBe(0);
    expect(state.game.busy).toBe(true);
    expect(state.game.selectedAttackId).toBe(null);

    vi.advanceTimersByTime(TIMING.HERO_ATTACK_WAIT_TIME);
    expect(state.game.monsters).toEqual([]);
    expect(state.game.phase).toBe(PHASES.LEVELUP);
  });

  it('requires selecting the equipped attack before targeting monsters', () => {
    const monster = createMonster('spider', 1, 5, 0);
    const game = createGame();
    game.phase = PHASES.HERO;
    game.player = { ...game.player, x: 0, y: 5, rangeBase: 2 };
    game.monsters = [monster];
    game.apRemaining = 5;
    const { state, actions } = createActionHarness(game);

    expect(actions.getAttackableMonsters()).toEqual(new Set());

    actions.toggleAttackSelection();
    expect(state.game.selectedAttackId).toBe(game.player.attackSlot.id);
    expect(actions.getAttackableMonsters()).toEqual(new Set([monster.id]));

    actions.toggleAttackSelection();
    expect(state.game.selectedAttackId).toBe(null);
  });

  it('attacks empty cells in range and keeps movement locked while aiming', () => {
    const game = createGame();
    game.phase = PHASES.HERO;
    game.monsters = [];
    game.player = { ...game.player, x: 0, y: 5, rangeBase: 2 };
    game.apRemaining = 5;
    game.selectedAttackId = game.player.attackSlot.id;
    const { state, actions } = createActionHarness(game);

    expect(actions.getReachableTiles()).toEqual(new Map());
    expect(actions.getPlayerAttackTiles().has('0,4')).toBe(true);

    actions.movePlayer({ x: 0, y: 4 });
    expect(state.game.player).toMatchObject({ x: 0, y: 5 });
    expect(state.game.apRemaining).toBe(5);

    actions.attackTile({ x: 0, y: 4 });

    expect(state.game.apRemaining).toBe(0);
    expect(state.game.selectedAttackId).toBe(null);
    expect(state.game.busy).toBe(true);
    expect(state.game.animations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'bumpAttack', entityId: 'player', targetX: 0, targetY: 4 }),
    ]));
  });

  it('wins the game when the final level monster is defeated', () => {
    const monster = createMonster('boss', 1, 5, 0);
    monster.hp = 1;
    monster.defense = 1;
    const game = createGame();
    game.levelIndex = LEVELS.length - 1;
    game.phase = PHASES.HERO;
    game.player = { ...game.player, x: 0, y: 5, rangeBase: 2 };
    game.monsters = [monster];
    game.apRemaining = 5;
    game.selectedAttackId = game.player.attackSlot.id;
    const { state, actions } = createActionHarness(game);

    actions.attackMonster(monster.id);
    vi.advanceTimersByTime(TIMING.HERO_ATTACK_WAIT_TIME);

    expect(state.game.monsters).toEqual([]);
    expect(state.game.phase).toBe(PHASES.WON);
    expect(state.game.banner.title).toMatch(/^Vit/);
  });

  it('reports monster movement and attack tiles without including occupied blockers', () => {
    const monster = createMonster('spider', 3, 5, 0);
    monster.speed = 2;
    const blocker = createMonster('skeleton', 2, 5, 1);
    const game = createGame();
    game.busy = false;
    game.levelIndex = 0;
    game.player = { ...game.player, x: 0, y: 5 };
    game.monsters = [monster, blocker];
    const { actions } = createActionHarness(game);

    const reachable = actions.getMonsterReachableTiles(monster.id);
    expect(reachable.has('2,5')).toBe(false);
    expect(reachable.has('3,4')).toBe(true);

    const attackTiles = actions.getMonsterAttackTiles(monster.id);
    expect(attackTiles.has('0,5')).toBe(false);
    expect(attackTiles.has('1,5')).toBe(false);
    expect(attackTiles.has('3,4')).toBe(true);
  });

  it('applies level rewards and starts the next level', () => {
    const { state, actions } = createActionHarness();
    state.game.phase = PHASES.LEVELUP;
    state.game.player.health = 2;

    actions.applyReward('heal');

    expect(state.game.levelIndex).toBe(1);
    expect(state.game.player.health).toBe(state.game.player.maxHealth);
    expect(state.game.player).toMatchObject(LEVELS[1].start);
    expect(state.game.phase).toBe(PHASES.HERO);
    expect(state.game.turnQueue).toEqual(['player', ...state.game.monsters.map((m) => m.id)]);
  });

  it('saves and loads a normalized game without transient UI state', () => {
    const { state, actions } = createActionHarness();
    state.game.menuOpen = true;
    state.game.buttons = [{ x: 1, y: 1, w: 1, h: 1, onClick() {} }];
    state.game.draggingDie = { dieIndex: 0 };
    state.game.levelIndex = 999;

    actions.saveGame();
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)).menuOpen).toBe(false);

    const loaded = {
      levelIndex: 999,
      player: { health: 3 },
      monsters: 'invalid',
      roll: [1],
      turnQueue: [],
      buttons: [{ stale: true }],
      draggingDie: { stale: true },
      menuOpen: true,
      busy: true,
      animations: [{ stale: true }],
      banner: { stale: true },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(loaded));

    actions.loadGame();

    expect(state.game.levelIndex).toBe(LEVELS.length - 1);
    expect(state.game.player.health).toBe(3);
    expect(Array.isArray(state.game.monsters)).toBe(true);
    expect(state.game.buttons).toEqual([]);
    expect(state.game.draggingDie).toBe(null);
    expect(state.game.menuOpen).toBe(false);
    expect(state.game.busy).toBe(false);
    expect(state.game.animations).toEqual([]);
    expect(state.game.banner.title).toBe('Jogo carregado');
  });
});
