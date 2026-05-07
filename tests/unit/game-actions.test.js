import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOARD_SIZE, GAME_MODES, LEVELS, PHASES, SAVE_KEY, START_WORLD_MAP_ID, TIMING, getWorldMap } from '../../js/config/game-data.js';
import { createGameActions } from '../../js/game/game-actions.js';
import { dijkstra, levelWallsSet, posKey } from '../../js/game/board-logic.js';
import { CHARACTERS_KEY, SELECTED_CHARACTER_KEY, totalXpForLevel } from '../../js/game/character-progress.js';
import { createDungeonLegacyGame, createGame, createMonster, createOverworldGame } from '../../js/game/game-factories.js';
import { getCurrentWorldEnemies, getCurrentWorldMapState } from '../../js/game/world-state.js';
import {
  NURSERY_INTRO_ID,
  NURSERY_INTRO_LINE_GAP,
  NURSERY_INTRO_MAP_ID,
  NURSERY_INTRO_MIN_LINE_DURATION,
} from '../../js/config/cutscenes/nursery-intro.js';

function createActionHarness(game = createDungeonLegacyGame()) {
  const state = { game };
  return { state, actions: createGameActions(state) };
}

function monsterDeathFinishDelay(damage = 1) {
  return (
    (damage > 0 ? TIMING.ATTACK_BUMP_DURATION + TIMING.PLAYER_DAMAGE_ANIMATION : 0)
    + TIMING.MONSTER_DEATH_ANIMATION
    + TIMING.MONSTER_DEFEAT_EXIT_PAUSE
  );
}

function playerDefeatFinishDelay(damage = 1) {
  return (
    (damage > 0 ? TIMING.ATTACK_BUMP_DURATION + TIMING.PLAYER_DAMAGE_ANIMATION : 0)
    + TIMING.PLAYER_DEATH_ANIMATION
    + TIMING.PLAYER_DEFEAT_EXIT_PAUSE
  );
}

function finishOverworldMapTransition() {
  vi.advanceTimersByTime(TIMING.OVERWORLD_MAP_FADE_IN);
  vi.advanceTimersByTime(TIMING.OVERWORLD_MAP_FADE_HOLD + TIMING.OVERWORLD_MAP_FADE_OUT);
}

function inCombatBoard(cell) {
  return cell.x >= 0 && cell.x < BOARD_SIZE && cell.y >= 0 && cell.y < BOARD_SIZE;
}

function hasClosedWallCorner(walls) {
  const cornerPairs = [
    [[0, -1], [1, 0]],
    [[1, 0], [0, 1]],
    [[0, 1], [-1, 0]],
    [[-1, 0], [0, -1]],
  ];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const key = `${x},${y}`;
      if (walls.has(key)) continue;

      for (const [first, second] of cornerPairs) {
        const firstCell = { x: x + first[0], y: y + first[1] };
        const secondCell = { x: x + second[0], y: y + second[1] };
        if (
          inCombatBoard(firstCell) &&
          inCombatBoard(secondCell) &&
          walls.has(posKey(firstCell)) &&
          walls.has(posKey(secondCell))
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

const LEVEL_3_CLASS_SPELLS = [
  {
    characterType: 'mage',
    spellId: 'mageFireBucket',
    characteristic: 'fire',
    baseDamage: 11,
    apCost: 4,
    rangeLabel: '2~5',
    player: { x: 0, y: 5 },
    reachable: ['0,3', '1,4', '5,5'],
    unreachable: ['0,4', '5,0'],
    target: { x: 0, y: 3 },
    animation: 'Ranged_Magic_Shoot',
    duration: 933,
    projectileModel: 'fireBucket',
    projectileDuration: 420,
  },
  {
    characterType: 'knight',
    spellId: 'knightStoneLance',
    characteristic: 'earth',
    baseDamage: 13,
    apCost: 5,
    rangeLabel: '1~3',
    player: { x: 2, y: 2 },
    reachable: ['2,1', '2,5', '5,2'],
    unreachable: ['3,3'],
    target: { x: 2, y: 1 },
    animation: 'Melee_1H_Attack_Chop',
    duration: 1067,
    projectileModel: 'stoneLance',
    projectileDuration: 260,
  },
  {
    characterType: 'barbarian',
    spellId: 'barbarianBoulderHurl',
    characteristic: 'earth',
    baseDamage: 14,
    apCost: 5,
    rangeLabel: '2~4',
    player: { x: 0, y: 5 },
    reachable: ['0,3', '2,5'],
    unreachable: ['0,4', '5,5'],
    target: { x: 0, y: 3 },
    animation: 'Melee_2H_Attack_Chop',
    duration: 1633,
    projectileModel: 'rollingBoulder',
    projectileDuration: 520,
  },
  {
    characterType: 'ranger',
    spellId: 'rangerVerdantArrow',
    characteristic: 'air',
    baseDamage: 10,
    apCost: 4,
    rangeLabel: '2~6',
    player: { x: 0, y: 5 },
    reachable: ['0,3', '2,5'],
    unreachable: ['0,4', '2,3'],
    target: { x: 0, y: 3 },
    animation: 'Ranged_Bow_Release',
    duration: 1333,
    projectileModel: 'arrowBow',
    projectileDuration: 280,
  },
  {
    characterType: 'rogue',
    spellId: 'rogueTideDagger',
    characteristic: 'water',
    baseDamage: 9,
    apCost: 4,
    rangeLabel: '2~5',
    player: { x: 2, y: 2 },
    reachable: ['4,4', '2,5', '5,2'],
    unreachable: ['3,3', '4,3'],
    target: { x: 4, y: 4 },
    animation: 'Ranged_1H_Shoot',
    duration: 1067,
    projectileModel: 'tideDagger',
    projectileDuration: 260,
  },
];

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

  it('starts the nursery cutscene in the -1,0 map with scripted model actions', () => {
    const { state, actions } = createActionHarness(createGame());

    expect(actions.startNurseryCutscene()).toBe(true);

    expect(state.game.mode).toBe(GAME_MODES.OVERWORLD);
    expect(state.game.overworld.currentMapId).toBe(NURSERY_INTRO_MAP_ID);
    expect(state.game.player).toMatchObject(getWorldMap(NURSERY_INTRO_MAP_ID).playerStart);
    expect(state.game.busy).toBe(true);
    expect(state.game.cutscene).toMatchObject({
      id: NURSERY_INTRO_ID,
      mapId: NURSERY_INTRO_MAP_ID,
      currentLineIndex: 0,
    });
    expect(state.game.cutscene.lines[0].duration).toBeGreaterThanOrEqual(NURSERY_INTRO_MIN_LINE_DURATION);
    expect(state.game.animations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'modelAction',
          entityId: 'player',
          animation: 'Death_B',
          cutsceneId: NURSERY_INTRO_ID,
        }),
        expect.objectContaining({
          type: 'modelAction',
          entityId: 'player',
          animation: 'Spawn_Ground',
          cutsceneId: NURSERY_INTRO_ID,
        }),
      ]),
    );
  });

  it('finishes the nursery cutscene and releases overworld control', () => {
    const { state, actions } = createActionHarness(createGame());

    actions.startNurseryCutscene();
    const endsAt = state.game.cutscene.endsAt;

    expect(actions.tickCutscene(endsAt + 1)).toBe(true);

    expect(state.game.cutscene).toBe(null);
    expect(state.game.busy).toBe(false);
    expect(state.game.overworld.currentMapId).toBe(NURSERY_INTRO_MAP_ID);
    expect(state.game.player).toMatchObject(getWorldMap(NURSERY_INTRO_MAP_ID).playerStart);
    expect(state.game.animations.some((animation) => animation.cutsceneId === NURSERY_INTRO_ID)).toBe(false);
  });

  it('skips the nursery cutscene and releases overworld control', () => {
    const { state, actions } = createActionHarness(createGame());

    actions.startNurseryCutscene();

    expect(actions.skipCutscene()).toBe(true);
    expect(state.game.cutscene).toBe(null);
    expect(state.game.busy).toBe(false);
    expect(state.game.overworld.currentMapId).toBe(NURSERY_INTRO_MAP_ID);
  });

  it('advances the nursery cutscene manually and reschedules future lines', () => {
    const { state, actions } = createActionHarness(createGame());

    actions.startNurseryCutscene();
    const cutscene = state.game.cutscene;
    const now = cutscene.startedAt + 500;
    const oldNextStart = cutscene.lines[1].startTime;
    const spawnAction = state.game.animations.find((animation) => animation.animation === 'Spawn_Ground');
    const oldSpawnStart = spawnAction.startTime;

    expect(actions.advanceCutscene(now)).toBe(true);

    expect(cutscene.currentLineIndex).toBe(1);
    expect(cutscene.lines[0].endTime).toBe(now);
    expect(cutscene.lines[1].startTime).toBe(now + NURSERY_INTRO_LINE_GAP);
    expect(cutscene.lines[1].startTime).toBeLessThan(oldNextStart);
    expect(spawnAction.startTime).toBeLessThan(oldSpawnStart);
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

  it('regenerates one health every two seconds while in the overworld', () => {
    const { state, actions } = createActionHarness(createOverworldGame());

    state.game.player.health = 58;
    state.game.player.maxHealth = 60;

    expect(actions.tickOverworldHealthRegen(1000)).toBe(false);
    expect(state.game.player.health).toBe(58);
    expect(state.game.nextOverworldHealthRegenAt).toBe(3000);

    expect(actions.tickOverworldHealthRegen(2999)).toBe(false);
    expect(state.game.player.health).toBe(58);

    expect(actions.tickOverworldHealthRegen(3000)).toBe(true);
    expect(state.game.player.health).toBe(59);
    expect(state.game.nextOverworldHealthRegenAt).toBe(5000);

    expect(actions.tickOverworldHealthRegen(5000)).toBe(true);
    expect(state.game.player.health).toBe(60);
    expect(state.game.nextOverworldHealthRegenAt).toBe(null);
  });

  it('does not regenerate health outside the overworld', () => {
    const { state, actions } = createActionHarness(createDungeonLegacyGame());

    state.game.player.health = 50;
    state.game.player.maxHealth = 60;
    state.game.nextOverworldHealthRegenAt = 0;

    expect(actions.tickOverworldHealthRegen(10_000)).toBe(false);
    expect(state.game.player.health).toBe(50);
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

  it('plays enemy death before removing a defeated monster', () => {
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
        entityId: 'player',
        animation: 'Throw',
      }),
      expect.objectContaining({
        type: 'modelAction',
        entityId: monster.id,
        animation: 'Hit_B',
      }),
      expect.objectContaining({
        type: 'modelAction',
        entityId: monster.id,
        animation: 'Death_A',
        duration: TIMING.MONSTER_DEATH_ANIMATION + TIMING.MONSTER_DEFEAT_EXIT_PAUSE,
      }),
    ]));

    vi.advanceTimersByTime(TIMING.HERO_ATTACK_WAIT_TIME);
    expect(state.game.monsters).toEqual([monster]);
    expect(state.game.phase).toBe(PHASES.HERO);
    expect(state.game.busy).toBe(true);

    vi.advanceTimersByTime(monsterDeathFinishDelay() - TIMING.HERO_ATTACK_WAIT_TIME);
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
    vi.advanceTimersByTime(monsterDeathFinishDelay());

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

    expect(state.game.overworld.currentMapId).toBe('open-road');
    expect(state.game.mapTransition).toMatchObject({
      type: 'overworldMap',
      fromMapId: 'open-road',
      toMapId: 'stone-grove',
    });
    expect(state.game.busy).toBe(true);

    vi.advanceTimersByTime(TIMING.OVERWORLD_MAP_FADE_IN);

    expect(state.game.overworld.currentMapId).toBe('stone-grove');
    expect(state.game.player).toMatchObject({ x: 1, y: 4, facing: { x: 1, y: 0 } });
    expect(getCurrentWorldMapState(state.game.overworld).enemies.length).toBeGreaterThan(0);
    expect(state.game.busy).toBe(true);

    vi.advanceTimersByTime(TIMING.OVERWORLD_MAP_FADE_HOLD + TIMING.OVERWORLD_MAP_FADE_OUT);

    expect(state.game.mapTransition).toBe(null);
    expect(state.game.busy).toBe(false);

    expect(actions.moveOverworldPlayer({ x: 3, y: 3 })).toBe(false);
    expect(state.game.player).toMatchObject({ x: 1, y: 4 });
  });

  it('enters chao grid maps one tile inside the destination ramp', () => {
    const game = createOverworldGame(getWorldMap('chao3-start'));
    const { state, actions } = createActionHarness(game);

    actions.moveOverworldPlayer({ x: 9, y: 5 });
    const movement = state.game.animations.find((anim) => anim.type === 'movement' && anim.entityId === 'player');

    vi.advanceTimersByTime(movement.totalDuration);
    finishOverworldMapTransition();

    expect(state.game.overworld.currentMapId).toBe('chao3-grid-1-0');
    expect(state.game.overworld.heroPath).toEqual(['chao3-start', 'chao3-grid-1-0']);
    expect(state.game.player).toMatchObject({ x: 1, y: 4, facing: { x: 1, y: 0 } });
    expect(state.game.busy).toBe(false);
  });

  it('blocks returning from the start map to the nursery and shows player speech', () => {
    const game = createOverworldGame(getWorldMap('chao3-start'));
    const { state, actions } = createActionHarness(game);

    actions.moveOverworldPlayer({ x: 0, y: 4 });
    const movement = state.game.animations.find((anim) => anim.type === 'movement' && anim.entityId === 'player');

    vi.advanceTimersByTime(movement.totalDuration);

    expect(state.game.overworld.currentMapId).toBe('chao3-start');
    expect(state.game.player).toMatchObject({ x: 0, y: 4 });
    expect(state.game.mapTransition).toBe(null);
    expect(state.game.busy).toBe(false);
    expect(state.game.lastEvent).toBe('algo está bloqueando o caminho');
    expect(state.game.animations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'speechBubble',
        entityId: 'player',
        text: 'algo está bloqueando o caminho',
      }),
    ]));
  });

  it('can stand on a water-mode connection tile without changing maps', () => {
    const game = createOverworldGame(getWorldMap('chao3-start'));
    const { state, actions } = createActionHarness(game);

    actions.moveOverworldPlayer({ x: 0, y: 4 }, { activateConnection: false });
    const movement = state.game.animations.find((anim) => anim.type === 'movement' && anim.entityId === 'player');

    vi.advanceTimersByTime(movement.totalDuration);

    expect(state.game.overworld.currentMapId).toBe('chao3-start');
    expect(state.game.player).toMatchObject({ x: 0, y: 4 });
    expect(state.game.mapTransition).toBe(null);
    expect(state.game.busy).toBe(false);
  });

  it('activates a bridge connection when already standing on its entry tile', () => {
    const game = createOverworldGame(getWorldMap('chao3-start'));
    game.player.x = 9;
    game.player.y = 5;
    const { state, actions } = createActionHarness(game);

    actions.moveOverworldPlayer({ x: 9, y: 5 }, { activateConnection: true });
    const movement = state.game.animations.find((anim) => anim.type === 'movement' && anim.entityId === 'player');

    expect(movement.totalDuration).toBe(0);
    vi.advanceTimersByTime(0);
    finishOverworldMapTransition();

    expect(state.game.overworld.currentMapId).toBe('chao3-grid-1-0');
    expect(state.game.player).toMatchObject({ x: 1, y: 4, facing: { x: 1, y: 0 } });
    expect(state.game.busy).toBe(false);
  });

  it('starts an overworld encounter with the whole enemy group', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);
    const target = getCurrentWorldEnemies(state.game.overworld)[0];
    const returnPosition = { x: state.game.player.x, y: state.game.player.y };

    actions.startOverworldEncounter(target.id);

    expect(state.game.mode).toBe(GAME_MODES.COMBAT);
    expect(state.game.combatContext).toMatchObject({
      origin: GAME_MODES.OVERWORLD,
      mapId: 'open-road',
      groupId: target.groupId,
      returnPosition,
    });
    expect(state.game.monsters.map((monster) => monster.groupId)).toEqual([target.groupId]);
    expect(state.game.turnQueue).toEqual(['player', ...state.game.monsters.map((monster) => monster.id)]);

    const walls = levelWallsSet(state.game.levelIndex, state.game.combatWalls);
    const reachable = dijkstra(state.game.player, walls).dist;

    expect(state.game.combatWalls).toHaveLength(3);
    expect(walls.size).toBe(3);
    expect(walls.has(posKey(state.game.player))).toBe(false);
    expect(state.game.monsters.every((monster) => !walls.has(posKey(monster)))).toBe(true);
    expect(state.game.monsters.every((monster) => reachable.has(posKey(monster)))).toBe(true);
    expect(reachable.size).toBe((BOARD_SIZE * BOARD_SIZE) - walls.size);
    expect(hasClosedWallCorner(walls)).toBe(false);

    state.game.player.rangeBase = 10;
    state.game.selectedAttackId = state.game.player.attackSlot.id;
    expect(actions.getPlayerAttackTiles().has(posKey(state.game.monsters[0]))).toBe(true);
  });

  it('returns to the overworld and removes the defeated group after map combat', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);
    const target = getCurrentWorldEnemies(state.game.overworld)[0];
    const returnPosition = { x: state.game.player.x, y: state.game.player.y };
    const targetGroupId = target.groupId;

    actions.startOverworldEncounter(target.id);
    state.game.player.attackSlot = {
      ...state.game.player.attackSlot,
      damage: 99,
    };
    state.game.player.rangeBase = 10;
    state.game.apRemaining = 5;
    state.game.selectedAttackId = state.game.player.attackSlot.id;

    actions.attackMonster(target.id);
    vi.advanceTimersByTime(monsterDeathFinishDelay());

    expect(state.game.mode).toBe(GAME_MODES.OVERWORLD);
    expect(state.game.overworld.currentMapId).toBe('open-road');
    expect(state.game.player).toMatchObject(returnPosition);
    expect(state.game.monsters).toEqual([]);
    expect(state.game.combatContext).toBe(null);
    expect(state.game.combatWalls).toBe(null);
    expect(getCurrentWorldEnemies(state.game.overworld).some((enemy) => enemy.groupId === targetGroupId)).toBe(false);
    expect(state.game.phase).toBe(PHASES.HERO);
    expect(state.game.player.experience).toBe(target.xp);
  });

  it('returns to map 0,0 with zero health after losing overworld combat', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);
    const target = getCurrentWorldEnemies(state.game.overworld)[0];
    const targetGroupId = target.groupId;

    actions.startOverworldEncounter(target.id);

    const monster = {
      ...state.game.monsters[0],
      x: 0,
      y: 4,
      attack: 99,
      range: 1,
      speed: 0,
    };
    state.game.monsters = [monster];
    state.game.player = {
      ...state.game.player,
      x: 0,
      y: 5,
      health: 1,
      defenseBase: 0,
    };
    state.game.turnQueue = ['player', monster.id];
    state.game.phase = PHASES.HERO;
    state.game.busy = false;

    actions.endHeroPhase();
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(playerDefeatFinishDelay());

    const startMap = getWorldMap(START_WORLD_MAP_ID);
    expect(startMap.gridPosition).toEqual({ x: 0, y: 0 });
    expect(state.game.mode).toBe(GAME_MODES.OVERWORLD);
    expect(state.game.overworld.currentMapId).toBe(START_WORLD_MAP_ID);
    expect(state.game.player).toMatchObject({
      ...startMap.playerStart,
      health: 0,
    });
    expect(state.game.phase).toBe(PHASES.HERO);
    expect(state.game.monsters).toEqual([]);
    expect(state.game.combatContext).toBe(null);
    expect(state.game.combatWalls).toBe(null);
    expect(state.game.overworld.mapStates['open-road'].enemies.some((enemy) => enemy.groupId === targetGroupId)).toBe(true);
    expect(state.game.banner.title).toBe('Derrota');
  });

  it('grants XP, levels up on the growing curve, and preserves overflow', () => {
    const { state, actions } = createActionHarness(createOverworldGame(getWorldMap('open-road')));
    const firstMonster = { type: 'skeletonMinion', xp: 10, xpGranted: false };
    const secondMonster = { type: 'skeletonMage', xp: 45, xpGranted: false };

    state.game.player.experience = 10;

    expect(actions.grantMonsterExperience(firstMonster)).toMatchObject({
      xp: 10,
      levelsGained: 1,
      pointsGained: 5,
    });
    expect(state.game.player).toMatchObject({
      experience: 20,
      level: 2,
      characteristicPoints: 5,
    });
    expect(actions.getXpProgress(state.game.player)).toMatchObject({
      progressXp: 5,
      requiredXp: 20,
    });

    expect(actions.grantMonsterExperience(secondMonster)).toMatchObject({
      xp: 45,
      levelsGained: 2,
      pointsGained: 10,
    });
    expect(state.game.player).toMatchObject({
      experience: 65,
      level: 4,
      characteristicPoints: 15,
    });
    expect(actions.getXpProgress(state.game.player)).toMatchObject({
      progressXp: 5,
      requiredXp: 30,
    });
  });

  it('persists selected character progress when XP changes', () => {
    const { state, actions } = createActionHarness(createOverworldGame(getWorldMap('open-road')));
    state.game.player.characterId = 'saved-character';
    localStorage.setItem(SELECTED_CHARACTER_KEY, 'saved-character');
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify([{
      id: 'saved-character',
      name: 'Doran',
      type: 'ranger',
      color: '#112233',
      palette: { version: 1, slots: {} },
      createdAt: 1,
    }]));

    actions.grantMonsterExperience({ type: 'skeletonMage', xp: 45, xpGranted: false });

    const [storedCharacter] = JSON.parse(localStorage.getItem(CHARACTERS_KEY));
    expect(storedCharacter.progress).toMatchObject({
      experience: 45,
      level: 3,
      characteristicPoints: 10,
      defenseBase: 0,
    });
  });

  it('applies debug hero level and stat edits using the XP curve', () => {
    const { state, actions } = createActionHarness(createOverworldGame(getWorldMap('open-road')));

    expect(actions.applyDebugHeroConfig({
      level: 10,
      health: 70,
      maxHealth: 80,
      apMax: 8,
      apRemaining: 7,
      speedBase: 5,
      speedRemaining: 4,
      defenseBase: 0,
      rangeBase: 3,
      characteristics: {
        life: 2,
        earth: 1,
        fire: 3,
        air: 4,
        water: 5,
      },
    })).toBe(true);

    expect(state.game.player).toMatchObject({
      level: 10,
      experience: totalXpForLevel(10),
      characteristicPoints: 30,
      health: 70,
      maxHealth: 80,
      apMax: 8,
      speedBase: 5,
      defenseBase: 0,
      rangeBase: 3,
      characteristics: {
        life: 2,
        earth: 1,
        fire: 3,
        air: 4,
        water: 5,
      },
    });
    expect(state.game.apRemaining).toBe(7);
    expect(state.game.speedRemaining).toBe(4);
  });

  it('respawns a new overworld enemy wave after a cleared map delay', () => {
    const game = createOverworldGame(getWorldMap('open-road'));
    const { state, actions } = createActionHarness(game);
    const mapState = getCurrentWorldMapState(state.game.overworld);
    const target = mapState.enemies[0];
    mapState.enemies = [target];

    actions.startOverworldEncounter(target.id);
    state.game.player.attackSlot = {
      ...state.game.player.attackSlot,
      damage: 99,
    };
    state.game.player.rangeBase = 10;
    state.game.apRemaining = 5;
    state.game.selectedAttackId = state.game.player.attackSlot.id;
    actions.attackMonster(target.id);
    vi.advanceTimersByTime(monsterDeathFinishDelay());

    expect(mapState.enemies).toEqual([]);
    expect(mapState.nextRespawnAt).not.toBe(null);

    vi.advanceTimersByTime(TIMING.OVERWORLD_ENEMY_RESPAWN_MIN - 1);
    expect(mapState.enemies).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(mapState.enemies.length).toBeGreaterThanOrEqual(2);
    expect(mapState.enemies.length).toBeLessThanOrEqual(5);
  });

  it('schedules a respawn when loading an empty overworld map', () => {
    const savedGame = createOverworldGame(getWorldMap('open-road'));
    const savedMapState = getCurrentWorldMapState(savedGame.overworld);
    savedMapState.enemies = [];
    savedMapState.enemyWave = 4;
    localStorage.setItem(SAVE_KEY, JSON.stringify(savedGame));

    const { state, actions } = createActionHarness(createOverworldGame(getWorldMap('open-road')));

    actions.loadGame();

    const loadedMapState = getCurrentWorldMapState(state.game.overworld);
    expect(loadedMapState.enemies).toEqual([]);
    expect(loadedMapState.nextRespawnAt).not.toBe(null);

    vi.advanceTimersByTime(TIMING.OVERWORLD_ENEMY_RESPAWN_MIN);
    expect(loadedMapState.enemies.length).toBeGreaterThanOrEqual(2);
    expect(loadedMapState.enemies.length).toBeLessThanOrEqual(5);
    expect(loadedMapState.enemyWave).toBe(5);
  });

  it('allocates life and elemental characteristics without buffing neutral strike', () => {
    const { state, actions } = createActionHarness(createGame());
    state.game.player.health = 40;
    state.game.player.characteristicPoints = 2;

    expect(actions.allocateCharacteristic('life')).toBe(true);
    expect(state.game.player.maxHealth).toBe(65);
    expect(state.game.player.health).toBe(45);
    expect(state.game.player.characteristics.life).toBe(1);
    expect(state.game.player.characteristicPoints).toBe(1);

    expect(actions.allocateCharacteristic('fire')).toBe(true);
    expect(state.game.player.characteristics.fire).toBe(1);
    expect(actions.getElementalDamageBonus('fire')).toBe(1);
    expect(actions.getAttackDamage({ id: 'spark', damage: 5, element: 'fire' })).toBe(6);
    expect(actions.getAttackDamage(state.game.player.attackSlot)).toBe(10);
    expect(actions.allocateCharacteristic('water')).toBe(false);
  });

  it('locks level 3 class spells until level 3 and keeps them out of the combat palette', () => {
    for (const spellCase of LEVEL_3_CLASS_SPELLS) {
      const { state, actions } = createActionHarness(createGame());
      state.game.player.characterType = spellCase.characterType;

      expect(actions.getPlayerSpellbook(state.game.player).map((spell) => ({
        id: spell.id,
        locked: spell.locked,
        unlockLevel: spell.unlockLevel,
      }))).toEqual([
        { id: 'strike', locked: false, unlockLevel: 1 },
        { id: spellCase.spellId, locked: true, unlockLevel: 3 },
      ]);
      expect(actions.getAvailableAttacks(state.game).map((attack) => attack.id)).toEqual(['strike']);

      state.game.player.level = 3;

      expect(actions.getPlayerSpellbook(state.game.player)[1].locked).toBe(false);
      expect(actions.getAvailableAttacks(state.game).map((attack) => attack.id)).toEqual(['strike', spellCase.spellId]);
    }
  });

  it('uses elemental bonuses and class range patterns without changing Golpe', () => {
    for (const spellCase of LEVEL_3_CLASS_SPELLS) {
      const game = createDungeonLegacyGame();
      game.phase = PHASES.HERO;
      game.combatWalls = [];
      game.player = {
        ...game.player,
        characterType: spellCase.characterType,
        level: 3,
        x: spellCase.player.x,
        y: spellCase.player.y,
        characteristics: {
          ...game.player.characteristics,
          [spellCase.characteristic]: 2,
        },
      };
      game.monsters = [];
      game.apRemaining = spellCase.apCost;
      game.selectedAttackId = spellCase.spellId;
      const { actions } = createActionHarness(game);
      const spell = actions.getAvailableAttacks(game).find((attack) => attack.id === spellCase.spellId);
      const attackTiles = actions.getPlayerAttackTiles();

      expect(actions.getAttackDamage(spell)).toBe(spellCase.baseDamage + 2);
      expect(actions.getAttackDamage(game.player.attackSlot)).toBe(10);
      expect(actions.getAttackRangeLabel(spell)).toBe(spellCase.rangeLabel);
      spellCase.reachable.forEach((key) => expect(attackTiles.has(key)).toBe(true));
      spellCase.unreachable.forEach((key) => expect(attackTiles.has(key)).toBe(false));
    }
  });

  it('blocks rogue diagonal water spell when line of sight is blocked', () => {
    const game = createDungeonLegacyGame();
    game.phase = PHASES.HERO;
    game.combatWalls = [[3, 3]];
    game.player = {
      ...game.player,
      characterType: 'rogue',
      level: 3,
      x: 2,
      y: 2,
    };
    game.monsters = [];
    game.apRemaining = 4;
    game.selectedAttackId = 'rogueTideDagger';
    const { actions } = createActionHarness(game);

    expect(actions.getPlayerAttackTiles().has('4,4')).toBe(false);
    expect(actions.getPlayerAttackTiles().has('2,5')).toBe(true);
  });

  it('plays class spell animations and projectiles', () => {
    for (const spellCase of LEVEL_3_CLASS_SPELLS) {
      const monster = createMonster('skeletonMinion', spellCase.target.x, spellCase.target.y, 0);
      monster.hp = 30;
      const game = createDungeonLegacyGame();
      game.phase = PHASES.HERO;
      game.combatWalls = [];
      game.player = {
        ...game.player,
        characterType: spellCase.characterType,
        level: 3,
        x: spellCase.player.x,
        y: spellCase.player.y,
      };
      game.monsters = [monster];
      game.apRemaining = spellCase.apCost;
      game.selectedAttackId = spellCase.spellId;
      const { state, actions } = createActionHarness(game);

      expect(actions.attackTile(spellCase.target)).toBe(true);

      const playerAction = state.game.animations.find((animation) => {
        return animation.type === 'modelAction' && animation.entityId === 'player';
      });

      expect(playerAction).toEqual(expect.objectContaining({
        animation: spellCase.animation,
        duration: spellCase.duration,
        sourceX: spellCase.player.x,
        sourceY: spellCase.player.y,
        targetX: spellCase.target.x,
        targetY: spellCase.target.y,
      }));

      expect(state.game.animations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'projectile',
          entityId: 'player',
          model: spellCase.projectileModel,
          sourceX: spellCase.player.x,
          sourceY: spellCase.player.y,
          targetX: spellCase.target.x,
          targetY: spellCase.target.y,
          duration: spellCase.projectileDuration,
        }),
      ]));

      vi.advanceTimersByTime(Math.max(TIMING.HERO_ATTACK_WAIT_TIME, spellCase.duration));
      expect(state.game.busy).toBe(false);
      vi.clearAllTimers();
    }
  });

  it('keeps basic attacks on Throw without spawning class spell projectiles', () => {
    for (const { characterType } of LEVEL_3_CLASS_SPELLS) {
      const monster = createMonster('skeletonMinion', 1, 5, 0);
      monster.hp = 30;
      const game = createDungeonLegacyGame();
      game.phase = PHASES.HERO;
      game.combatWalls = [];
      game.player = {
        ...game.player,
        characterType,
        level: 3,
        x: 0,
        y: 5,
        rangeBase: 2,
      };
      game.monsters = [monster];
      game.apRemaining = 5;
      game.selectedAttackId = game.player.attackSlot.id;
      const { state, actions } = createActionHarness(game);

      expect(actions.attackTile({ x: 1, y: 5 })).toBe(true);

      expect(state.game.animations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'modelAction',
          entityId: 'player',
          animation: 'Throw',
        }),
      ]));
      expect(state.game.animations.some((animation) => animation.type === 'projectile')).toBe(false);
      vi.advanceTimersByTime(TIMING.PLAYER_ATTACK_ANIMATION);
      vi.clearAllTimers();
    }
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
    state.game.cutscene = { id: NURSERY_INTRO_ID };
    state.game.levelIndex = 999;

    actions.saveGame();
    const savedGame = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(savedGame.menuOpen).toBe(false);
    expect(savedGame.cutscene).toBe(null);

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
      cutscene: { id: NURSERY_INTRO_ID },
      animations: [{ stale: true }],
      banner: { stale: true },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(loaded));

    actions.loadGame();

    expect(state.game.mode).toBe(GAME_MODES.DUNGEON_LEGACY);
    expect(state.game.levelIndex).toBe(LEVELS.length - 1);
    expect(state.game.player.health).toBe(3);
    expect(state.game.player.attackSlot.lifeSteal).toBe(0);
    expect(state.game.player).toMatchObject({
      level: 1,
      experience: 0,
      characteristicPoints: 0,
      characteristics: {
        life: 0,
        earth: 0,
        fire: 0,
        air: 0,
        water: 0,
      },
    });
    expect(Array.isArray(state.game.monsters)).toBe(true);
    expect(state.game.buttons).toEqual([]);
    expect(state.game.draggingDie).toBe(null);
    expect(state.game.menuOpen).toBe(false);
    expect(state.game.activeModal).toBe(null);
    expect(state.game.levelUpNotice).toBe(null);
    expect(state.game.cutscene).toBe(null);
    expect(state.game.busy).toBe(false);
    expect(state.game.animations).toEqual([]);
    expect(state.game.banner.title).toBe('Jogo carregado');
  });

  it('silently saves and reloads the overworld map position', () => {
    const { state, actions } = createActionHarness(createOverworldGame(getWorldMap('open-road')));
    state.game.player.x = 6;
    state.game.player.y = 7;
    state.game.player.facing = { x: 1, y: 0 };
    state.game.menuOpen = true;

    expect(actions.saveGame({ silent: true })).toBe(true);
    expect(state.game.menuOpen).toBe(true);

    state.game = createGame();
    expect(actions.loadGame({ silent: true })).toBe(true);

    expect(state.game.mode).toBe(GAME_MODES.OVERWORLD);
    expect(state.game.overworld.currentMapId).toBe('open-road');
    expect(state.game.player).toMatchObject({
      x: 6,
      y: 7,
      facing: { x: 1, y: 0 },
    });
    expect(state.game.banner).toBe(null);
  });
});
