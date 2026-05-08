import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_MODES, LEVELS, MONSTER_TEMPLATES, PHASES, START_WORLD_MAP_ID, getWorldMap } from '../../js/config/game-data.js';
import {
  createOverworldMapState,
  createCombatMonsterFromEnemy,
  createDungeonLegacyGame,
  createGame,
  createMonster,
  createOverworldEnemy,
  levelMonsters,
  makeEnergyRoll,
  overworldEnemies,
  randDie,
} from '../../js/game/game-factories.js';
import { getCurrentWorldMapState } from '../../js/game/world-state.js';

describe('game factories', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rolls six-sided dice from Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.999);

    expect(randDie()).toBe(1);
    expect(randDie()).toBe(6);
  });

  it('creates an energy roll with three dice', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.999);

    expect(makeEnergyRoll()).toEqual([1, 4, 6]);
  });

  it('creates monsters from templates and level data', () => {
    const monster = createMonster('skeletonMinion', 4, 0, 0);

    expect(monster).toMatchObject({
      id: 'skeletonMinion-0-4-0',
      type: 'skeletonMinion',
      x: 4,
      y: 0,
      hp: MONSTER_TEMPLATES.skeletonMinion.hp,
      maxHp: MONSTER_TEMPLATES.skeletonMinion.hp,
      xp: MONSTER_TEMPLATES.skeletonMinion.xp,
      xpGranted: false,
      name: MONSTER_TEMPLATES.skeletonMinion.name,
    });
    expect(levelMonsters(LEVELS[0]).map((m) => m.id)).toEqual([
      'skeletonMinion-0-4-0',
      'skeletonMinion-1-5-2',
    ]);
  });

  it('creates overworld enemies with group ids', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = createOverworldEnemy('skeletonMinion', 4, 5, 'skeleton-minions', 0);
    const startMap = getWorldMap('open-road');
    const generatedEnemies = overworldEnemies(startMap);

    expect(enemy).toMatchObject({
      id: 'overworld-skeleton-minions-0',
      type: 'skeletonMinion',
      x: 4,
      y: 5,
      groupId: 'skeleton-minions',
      hp: MONSTER_TEMPLATES.skeletonMinion.hp,
      xp: MONSTER_TEMPLATES.skeletonMinion.xp,
      xpGranted: false,
    });
    expect(generatedEnemies.length).toBeGreaterThanOrEqual(1);
    expect(generatedEnemies.length).toBeLessThanOrEqual(5);
    expect(generatedEnemies[0]).toMatchObject({
      id: 'overworld-open-road-open-road-spawn-0-0-0',
      type: 'skeletonMinion',
      groupId: 'open-road-spawn-0-0',
    });
    expect(createOverworldMapState(startMap).enemies.length).toBeGreaterThanOrEqual(1);
  });

  it('allows maps to disable random overworld enemies', () => {
    const emptyMap = getWorldMap('chao3-grid--1-0');

    expect(emptyMap.randomEncounters).toBe(false);
    expect(overworldEnemies(emptyMap)).toEqual([]);
    expect(createOverworldMapState(emptyMap).enemies).toEqual([]);
  });

  it('scales overworld enemy level and group size by map distance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const farMap = getWorldMap('chao3-grid-7-0');
    const enemies = overworldEnemies(farMap);
    const largestGroup = Math.max(
      ...Object.values(enemies.reduce((counts, enemy) => {
        counts[enemy.groupId] = (counts[enemy.groupId] || 0) + 1;
        return counts;
      }, {})),
    );
    const combatMonster = createCombatMonsterFromEnemy(enemies[0], 5, 0, 0);

    expect(enemies.length).toBe(5);
    expect(largestGroup).toBeGreaterThan(1);
    expect(enemies[0].level).toBe(7);
    expect(enemies[0].attack).toBeGreaterThan(MONSTER_TEMPLATES[enemies[0].type].attack);
    expect(enemies[0].lifeSteal).toBeGreaterThan(0);
    expect(enemies[0].visualScale).toBeGreaterThan(1);
    expect(combatMonster).toMatchObject({
      id: enemies[0].id,
      level: enemies[0].level,
      attack: enemies[0].attack,
      lifeSteal: enemies[0].lifeSteal,
      visualScale: enemies[0].visualScale,
    });
  });

  it('normalizes legacy monster inputs', () => {
    expect(createMonster('spider', 4, 0, 0)).toMatchObject({
      id: 'skeletonMinion-0-4-0',
      type: 'skeletonMinion',
      name: MONSTER_TEMPLATES.skeletonMinion.name,
    });
    expect(createOverworldEnemy('spider', 4, 5, 'nest-a', 0)).toMatchObject({
      id: 'overworld-skeleton-minions-0',
      type: 'skeletonMinion',
      groupId: 'skeleton-minions',
    });
  });

  it('creates the initial game state in the start map', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const game = createGame();
    const startMap = getWorldMap(START_WORLD_MAP_ID);
    const startMapState = getCurrentWorldMapState(game.overworld);

    expect(game.mode).toBe(GAME_MODES.OVERWORLD);
    expect(game.levelIndex).toBe(0);
    expect(game.player).toMatchObject({
      x: startMap.playerStart.x,
      y: startMap.playerStart.y,
      health: 60,
      maxHealth: 60,
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
      apMax: 6,
      speedBase: 3,
      attackSlot: {
        name: 'Golpe',
        element: 'neutral',
        apCost: 5,
        damage: 10,
        lifeSteal: 0,
      },
    });
    expect(game.phase).toBe(PHASES.HERO);
    expect(game.overworld.currentMapId).toBe(startMap.id);
    expect(game.overworld.heroPath).toEqual([startMap.id]);
    expect(game.overworld.mapStates[startMap.id]).toBeDefined();
    expect(startMap.id).toBe(START_WORLD_MAP_ID);
    expect(startMapState.enemies).toHaveLength(1);
    expect(startMapState.enemies.every((enemy) => enemy.type === 'skeletonMinion')).toBe(true);
    expect(game.monsters).toEqual([]);
    expect(game.turnQueue).toEqual(['player']);
    expect(game.banner.title).toBe(startMap.name);
  });

  it('preserves the legacy dungeon factory', () => {
    const game = createDungeonLegacyGame();

    expect(game.mode).toBe(GAME_MODES.DUNGEON_LEGACY);
    expect(game.player).toMatchObject({
      x: LEVELS[0].start.x,
      y: LEVELS[0].start.y,
    });
    expect(game.roll).toEqual([]);
    expect(game.speedRemaining).toBe(3);
    expect(game.apRemaining).toBe(6);
    expect(game.turnQueue).toEqual(['player', ...game.monsters.map((m) => m.id)]);
    expect(game.banner.title).toBe('Sua vez');
  });
});
