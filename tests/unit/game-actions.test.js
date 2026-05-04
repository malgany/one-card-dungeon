import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_MODES, LEVELS, PHASES, SAVE_KEY, TIMING, getWorldMap } from '../../js/config/game-data.js';
import { createGameActions } from '../../js/game/game-actions.js';
import { createDungeonLegacyGame, createGame, createMonster, createOverworldGame } from '../../js/game/game-factories.js';
import { getCurrentWorldEnemies, getCurrentWorldMapState } from '../../js/game/world-state.js';

function createActionHarness(game = createDungeonLegacyGame()) {
  const state = { game };
  return { state, actions: createGameActions(state) };
}

describe('game actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
    expect(state.game.heroTurnStartedAt).not.toBe(null);
    expect(state.game.heroTurnEndsAt - state.game.heroTurnStartedAt).toBe(TIMING.HERO_TURN_DURATION);
  });

  it('automatically ends the hero turn after 50 seconds and advances to the next turn', () => {
    const game = createDungeonLegacyGame();
    game.monsters = [];
    game.turnQueue = ['player'];
    const { state, actions } = createActionHarness(game);

    actions.startHeroTurn('prepare');

    expect(state.game.heroTurnStartedAt).not.toBe(null);
    expect(state.game.heroTurnEndsAt - state.game.heroTurnStartedAt).toBe(TIMING.HERO_TURN_DURATION);

    vi.advanceTimersByTime(TIMING.HERO_TURN_DURATION);

    expect(state.game.phase).toBe(PHASES.HERO);
    expect(state.game.turnCount).toBe(2);
    expect(state.game.busy).toBe(false);
    expect(state.game.banner?.title).not.toBe('Fim da vez');
    expect(state.game.heroTurnStartedAt).not.toBe(null);
    expect(state.game.heroTurnEndsAt - state.game.heroTurnStartedAt).toBe(TIMING.HERO_TURN_DURATION);
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

  it('attacks a reachable monster without healing and removes it when defeated', () => {
    const monster = createMonster('skeletonMinion', 1, 5, 0);
    monster.hp = 4;
    const game = createDungeonLegacyGame();
    game.phase = PHASES.HERO;
    game.player = { ...game.player, x: 0, y: 5, health: 59, rangeBase: 2 };
    game.monsters = [monster];
    game.apRemaining = 5;
    game.selectedAttackId = game.player.attackSlot.id;
    const { state, actions } = createActionHarness(game);

    expect(actions.getAttackableMonsters()).toEqual(new Set([monster.id]));

    actions.attackMonster(monster.id);

    expect(state.game.apRemaining).toBe(0);
    expect(state.game.player.health).toBe(59);
    expect(monster.hp).toBe(0);
    expect(state.game.busy).toBe(true);
    expect(state.game.selectedAttackId).toBe(null);
    expect(state.game.animations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'modelAction',
        entityId: monster.id,
        animation: 'Hit_B',
      }),
    ]));

    vi.advanceTimersByTime(TIMING.HERO_ATTACK_WAIT_TIME);
    expect(state.game.monsters).toEqual([]);
    expect(state.game.phase).toBe(PHASES.LEVELUP);
  });

  it('requires selecting the equipped attack before targeting monsters', () => {
    const monster = createMonster('skeletonMinion', 1, 5, 0);
    const game = createDungeonLegacyGame();
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

  it('does not spend AP on empty cells while aiming', () => {
    const game = createDungeonLegacyGame();
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

    expect(state.game.apRemaining).toBe(5);
    expect(state.game.selectedAttackId).toBe(game.player.attackSlot.id);
    expect(state.game.busy).toBe(false);
    expect(state.game.lastEvent).toBe('Golpe: nenhum inimigo nessa celula.');
    expect(state.game.animations.some((animation) => {
      return animation.type === 'modelAction' && animation.entityId === 'player';
    })).toBe(false);
    expect(state.game.animations.some((animation) => {
      return animation.type === 'bumpAttack' && animation.entityId === 'player';
    })).toBe(false);
  });

  it('plays the player damage reaction instead of shaking the player when hit by a monster', () => {
    const monster = createMonster('skeletonMinion', 0, 4, 0);
    monster.attack = 5;
    monster.speed = 0;
    const game = createDungeonLegacyGame();
    game.phase = PHASES.HERO;
    game.player = { ...game.player, x: 0, y: 5, defenseBase: 1 };
    game.monsters = [monster];
    game.turnQueue = ['player', monster.id];
    const { state, actions } = createActionHarness(game);
    const windowTimer = vi.spyOn(window, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback === 'function') callback();
      return 0;
    });

    actions.endHeroPhase();
    windowTimer.mockRestore();
    vi.advanceTimersByTime(TIMING.TURN_BANNER + TIMING.POST_BANNER_PAUSE);

    expect(state.game.player.health).toBe(56);
    expect(state.game.animations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'modelAction',
        entityId: monster.id,
        animation: 'Hit_A',
        sourceX: 0,
        sourceY: 4,
        targetX: 0,
        targetY: 5,
      }),
      expect.objectContaining({
        type: 'modelAction',
        entityId: 'player',
        animation: 'Hit_B',
        sourceX: 0,
        sourceY: 5,
        targetX: 0,
        targetY: 4,
      }),
    ]));
    expect(state.game.animations.some((animation) => {
      return animation.type === 'damageShake' && animation.entityId === 'player';
    })).toBe(false);
  });

  it('plays the player death animation before entering the defeat phase', () => {
    const monster = createMonster('skeletonMinion', 0, 4, 0);
    monster.attack = 5;
    monster.speed = 0;
    const game = createDungeonLegacyGame();
    game.phase = PHASES.HERO;
    game.player = { ...game.player, x: 0, y: 5, health: 3, defenseBase: 0 };
    game.monsters = [monster];
    game.turnQueue = ['player', monster.id];
    const { state, actions } = createActionHarness(game);

    actions.endHeroPhase();
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(1);

    const deathAction = state.game.animations.find((animation) => {
      return animation.type === 'modelAction' && animation.entityId === 'player' && animation.animation === 'Death_A';
    });

    expect(state.game.player.health).toBe(0);
    expect(state.game.phase).toBe(PHASES.MONSTER_TURN);
    expect(state.game.busy).toBe(true);
    expect(deathAction).toMatchObject({
      sourceX: 0,
      sourceY: 5,
      targetX: 0,
      targetY: 4,
      duration: TIMING.PLAYER_DEATH_ANIMATION + TIMING.PLAYER_DEFEAT_EXIT_PAUSE,
    });

    const defeatDelay = TIMING.ATTACK_BUMP_DURATION
      + TIMING.PLAYER_DAMAGE_ANIMATION
      + TIMING.PLAYER_DEATH_ANIMATION
      + TIMING.PLAYER_DEFEAT_EXIT_PAUSE;
    vi.advanceTimersByTime(defeatDelay - 1);

    expect(state.game.phase).toBe(PHASES.MONSTER_TURN);
    expect(state.game.banner?.title).not.toBe('Derrota');

    vi.advanceTimersByTime(1);

    expect(state.game.phase).toBe(PHASES.LOST);
    expect(state.game.busy).toBe(false);
    expect(state.game.banner.title).toBe('Derrota');
  });

  it('wins the game when the final level monster is defeated', () => {
    const monster = createMonster('boss', 1, 5, 0);
    monster.hp = 1;
    monster.defense = 1;
    const game = createDungeonLegacyGame();
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
    const monster = createMonster('skeletonMinion', 3, 5, 0);
    monster.speed = 2;
    const blocker = createMonster('skeletonWarrior', 2, 5, 1);
    const game = createDungeonLegacyGame();
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

  it('moves on the overworld without spending combat resources', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);
    const startingAp = state.game.apRemaining;
    const startingSpeed = state.game.speedRemaining;
    const start = { x: state.game.player.x, y: state.game.player.y };

    actions.moveOverworldPlayer({ x: 2, y: 9 });

    const movement = state.game.animations.find((anim) => anim.type === 'movement' && anim.entityId === 'player');
    expect(state.game.mode).toBe(GAME_MODES.OVERWORLD);
    expect(state.game.player).toMatchObject({ x: 2, y: 9 });
    expect(state.game.apRemaining).toBe(startingAp);
    expect(state.game.speedRemaining).toBe(startingSpeed);
    expect(state.game.busy).toBe(true);
    expect(movement.path[0]).toEqual(start);
    expect(movement.path[movement.path.length - 1]).toEqual({ x: 2, y: 9 });
    expect(movement.totalDuration).toBe((movement.path.length - 1) * TIMING.OVERWORLD_PLAYER_MOVE_SPEED);

    vi.advanceTimersByTime(movement.totalDuration);
    expect(state.game.busy).toBe(false);
  });

  it('moves diagonally on the overworld when the direct path is clear', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);

    actions.moveOverworldPlayer({ x: 3, y: 9 });

    const movement = state.game.animations.find((anim) => anim.type === 'movement' && anim.entityId === 'player');
    expect(state.game.player).toMatchObject({ x: 3, y: 9 });
    expect(movement.path).toEqual([
      { x: 2, y: 8 },
      { x: 3, y: 9 },
    ]);
    expect(movement.totalDuration).toBeCloseTo(Math.SQRT2 * TIMING.OVERWORLD_PLAYER_MOVE_SPEED);
  });

  it('transitions between world chunks and blocks round objects by grid cell', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);

    actions.moveOverworldPlayer({ x: 9, y: 5 });
    const movement = state.game.animations.find((anim) => anim.type === 'movement' && anim.entityId === 'player');

    vi.advanceTimersByTime(movement.totalDuration);

    expect(state.game.overworld.currentMapId).toBe('stone-grove');
    expect(state.game.player).toMatchObject({ x: 0, y: 5 });
    expect(getCurrentWorldMapState(state.game.overworld).enemies.length).toBeGreaterThan(0);
    expect(state.game.busy).toBe(false);

    expect(actions.moveOverworldPlayer({ x: 3, y: 3 })).toBe(false);
    expect(state.game.player).toMatchObject({ x: 0, y: 5 });
  });

  it('starts an overworld encounter with the whole enemy group', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);
    const target = getCurrentWorldEnemies(state.game.overworld).find((enemy) => enemy.groupId === 'skeleton-minions');
    const returnPosition = { x: state.game.player.x, y: state.game.player.y };

    actions.startOverworldEncounter(target.id);

    expect(state.game.mode).toBe(GAME_MODES.COMBAT);
    expect(state.game.combatContext).toMatchObject({
      origin: GAME_MODES.OVERWORLD,
      mapId: 'open-road',
      groupId: 'skeleton-minions',
      returnPosition,
    });
    expect(state.game.monsters.map((monster) => monster.groupId)).toEqual(['skeleton-minions']);
    expect(state.game.turnQueue).toEqual(['player', ...state.game.monsters.map((monster) => monster.id)]);
  });

  it('returns to the overworld and removes the defeated group after map combat', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);
    const target = getCurrentWorldEnemies(state.game.overworld).find((enemy) => enemy.groupId === 'skeleton-mages');
    const returnPosition = { x: state.game.player.x, y: state.game.player.y };

    actions.startOverworldEncounter(target.id);
    state.game.player.attackSlot = {
      ...state.game.player.attackSlot,
      damage: 99,
    };
    state.game.player.rangeBase = 10;
    state.game.apRemaining = 5;
    state.game.selectedAttackId = state.game.player.attackSlot.id;

    actions.attackMonster(target.id);
    vi.advanceTimersByTime(TIMING.HERO_ATTACK_WAIT_TIME);

    expect(state.game.mode).toBe(GAME_MODES.OVERWORLD);
    expect(state.game.overworld.currentMapId).toBe('open-road');
    expect(state.game.player).toMatchObject(returnPosition);
    expect(state.game.monsters).toEqual([]);
    expect(state.game.combatContext).toBe(null);
    expect(getCurrentWorldEnemies(state.game.overworld).some((enemy) => enemy.groupId === 'skeleton-mages')).toBe(false);
    expect(state.game.phase).toBe(PHASES.HERO);
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

  it('migrates old enemy save data to skeleton enemy types', () => {
    const { state, actions } = createActionHarness(createGame());
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      mode: GAME_MODES.COMBAT,
      levelIndex: 0,
      player: { ...state.game.player, x: 0, y: 5 },
      monsters: [{
        id: 'spider-0-1-5',
        type: 'spider',
        x: 1,
        y: 5,
        hp: 7,
        maxHp: 20,
        groupId: 'nest-a',
        overworldEnemyId: 'overworld-open-road-nest-a-0',
      }],
      turnQueue: ['player', 'spider-0-1-5'],
      combatContext: {
        origin: GAME_MODES.OVERWORLD,
        mapId: 'open-road',
        groupId: 'stone-c',
        enemyIds: ['overworld-open-road-stone-c-0'],
      },
      overworld: {
        currentMapId: 'open-road',
        mapStates: {
          'open-road': {
            mapId: 'open-road',
            enemies: [{
              id: 'overworld-open-road-nest-a-0',
              encounterId: 'nest-a-0',
              type: 'spider',
              x: 4,
              y: 4,
              groupId: 'nest-a',
              hp: 5,
              maxHp: 20,
            }],
            removedObjectIds: [],
          },
        },
      },
    }));

    actions.loadGame();

    expect(state.game.monsters[0]).toMatchObject({
      id: 'skeletonMinion-0-1-5',
      type: 'skeletonMinion',
      groupId: 'skeleton-minions',
      overworldEnemyId: 'overworld-open-road-skeleton-minions-0',
      name: 'Esqueleto Minion',
      hp: 7,
    });
    expect(state.game.turnQueue).toEqual(['player', 'skeletonMinion-0-1-5']);
    expect(state.game.combatContext).toMatchObject({
      groupId: 'skeleton-mages',
      enemyIds: ['overworld-open-road-skeleton-mages-0'],
    });
    expect(getCurrentWorldEnemies(state.game.overworld)[0]).toMatchObject({
      id: 'overworld-open-road-skeleton-minions-0',
      encounterId: 'skeleton-minions-0',
      type: 'skeletonMinion',
      groupId: 'skeleton-minions',
    });
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
      player: { health: 3, attackSlot: { id: 'strike', lifeSteal: 10 } },
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

    expect(state.game.mode).toBe(GAME_MODES.DUNGEON_LEGACY);
    expect(state.game.levelIndex).toBe(LEVELS.length - 1);
    expect(state.game.player.health).toBe(3);
    expect(state.game.player.attackSlot.lifeSteal).toBe(0);
    expect(Array.isArray(state.game.monsters)).toBe(true);
    expect(state.game.buttons).toEqual([]);
    expect(state.game.draggingDie).toBe(null);
    expect(state.game.menuOpen).toBe(false);
    expect(state.game.busy).toBe(false);
    expect(state.game.animations).toEqual([]);
    expect(state.game.banner.title).toBe('Jogo carregado');
  });
});
