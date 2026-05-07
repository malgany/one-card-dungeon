import { describe, expect, it } from 'vitest';
import {
  ATTACK_PATTERNS,
  BOARD_SIZE,
  BIOMES,
  CARD_SOURCES,
  CHARACTERISTIC_DEFINITIONS,
  GAME_MODES,
  LEVELS,
  MONSTER_TEMPLATES,
  PHASES,
  SPELL_DEFINITIONS,
  SPELL_ELEMENTS,
  START_WORLD_MAP_ID,
  STAT_META,
  TERRAIN_TYPES,
  TIMING,
  WORLD_MAPS,
  WORLD_OBJECT_TYPES,
  XP_RULES,
  getWorldMap,
} from '../../js/config/game-data.js';
import { NURSERY_INTRO_MAP_ID } from '../../js/config/cutscenes/nursery-intro.js';

describe('game data', () => {
  it('defines the phases and stat metadata used by the UI and actions', () => {
    expect(PHASES).toMatchObject({
      ENERGY: 'energy',
      HERO: 'hero',
      LEVELUP: 'levelup',
      WON: 'won',
      LOST: 'lost',
    });
    expect(GAME_MODES).toMatchObject({
      OVERWORLD: 'overworld',
      COMBAT: 'combat',
      DUNGEON_LEGACY: 'dungeonLegacy',
    });
    expect(Object.keys(STAT_META)).toEqual(['ap', 'speed', 'attack', 'defense']);
  });

  it('defines progression data for characteristics and XP', () => {
    expect(XP_RULES).toMatchObject({
      BASE_LEVEL_XP: 15,
      LEVEL_XP_STEP: 5,
      POINTS_PER_LEVEL: 5,
      LIFE_PER_POINT: 5,
      ELEMENT_DAMAGE_PER_POINT: 1,
    });
    expect(Object.keys(CHARACTERISTIC_DEFINITIONS)).toEqual(['life', 'earth', 'fire', 'air', 'water']);
    expect(CHARACTERISTIC_DEFINITIONS.fire.element).toBe(SPELL_ELEMENTS.FIRE);
    Object.values(MONSTER_TEMPLATES).forEach((template) => {
      expect(template.xp).toBeGreaterThan(0);
    });
  });

  it('defines level 3 class spells', () => {
    const expectedSpells = {
      mage: {
        id: 'mageFireBucket',
        name: 'Balde de Fogo',
        element: SPELL_ELEMENTS.FIRE,
        apCost: 4,
        damage: 11,
        minRange: 2,
        maxRange: 5,
        pattern: ATTACK_PATTERNS.PATH,
        iconKey: 'characteristicFire',
      },
      knight: {
        id: 'knightStoneLance',
        name: 'Lança de Pedra',
        element: SPELL_ELEMENTS.EARTH,
        apCost: 5,
        damage: 13,
        minRange: 1,
        maxRange: 3,
        pattern: ATTACK_PATTERNS.CROSS,
        iconKey: 'characteristicEarth',
      },
      barbarian: {
        id: 'barbarianBoulderHurl',
        name: 'Rocha Brutal',
        element: SPELL_ELEMENTS.EARTH,
        apCost: 5,
        damage: 14,
        minRange: 2,
        maxRange: 4,
        pattern: ATTACK_PATTERNS.PATH,
        iconKey: 'characteristicEarth',
      },
      ranger: {
        id: 'rangerVerdantArrow',
        name: 'Flecha Hirvante',
        element: SPELL_ELEMENTS.AIR,
        apCost: 4,
        damage: 10,
        minRange: 2,
        maxRange: 6,
        pattern: ATTACK_PATTERNS.CROSS,
        iconKey: 'spellVerdantArrow',
      },
      rogue: {
        id: 'rogueTideDagger',
        name: 'Adaga da Maré',
        element: SPELL_ELEMENTS.WATER,
        apCost: 4,
        damage: 9,
        minRange: 2,
        maxRange: 5,
        pattern: ATTACK_PATTERNS.LINE_8,
        iconKey: 'characteristicWater',
      },
    };

    for (const [characterType, expectedSpell] of Object.entries(expectedSpells)) {
      expect(SPELL_DEFINITIONS[characterType][0]).toMatchObject({
        ...expectedSpell,
        lifeSteal: 0,
        unlockLevel: 3,
      });
    }

    expect(CARD_SOURCES.spellVerdantArrow).toBe('./assets/ui/actions/ranger-verdant-arrow.png');
  });

  it('keeps all levels inside the board and references known monster templates', () => {
    LEVELS.forEach((level) => {
      expect(level.start.x).toBeGreaterThanOrEqual(0);
      expect(level.start.x).toBeLessThan(BOARD_SIZE);
      expect(level.start.y).toBeGreaterThanOrEqual(0);
      expect(level.start.y).toBeLessThan(BOARD_SIZE);

      const wallKeys = new Set(level.walls.map(([x, y]) => `${x},${y}`));
      expect(wallKeys.has(`${level.start.x},${level.start.y}`)).toBe(false);

      level.walls.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(BOARD_SIZE);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(BOARD_SIZE);
      });

      level.monsters.forEach(([type, x, y]) => {
        expect(MONSTER_TEMPLATES[type]).toBeDefined();
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(BOARD_SIZE);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(BOARD_SIZE);
        expect(wallKeys.has(`${x},${y}`)).toBe(false);
      });
    });
  });

  it('keeps timings positive for animations and turn progression', () => {
    Object.values(TIMING).forEach((value) => {
      expect(value).toBeGreaterThan(0);
    });
  });

  it('keeps world chunk data valid and grouped', () => {
    expect(getWorldMap(START_WORLD_MAP_ID)).toBeDefined();

    const gridKeys = new Set();
    Object.values(WORLD_MAPS).forEach((map) => {
      expect(BIOMES[map.biome]).toBeDefined();
      expect(TERRAIN_TYPES[map.defaultTerrain]).toBeDefined();
      expect(map.size.width).toBe(10);
      expect(map.size.height).toBe(10);
      expect(map.size.width).toBeGreaterThan(BOARD_SIZE);
      expect(map.size.height).toBeGreaterThan(BOARD_SIZE);
      expect(map.playerStart.x).toBeGreaterThanOrEqual(0);
      expect(map.playerStart.x).toBeLessThan(map.size.width);
      expect(map.playerStart.y).toBeGreaterThanOrEqual(0);
      expect(map.playerStart.y).toBeLessThan(map.size.height);
      if (map.gridPosition) {
        const key = `${map.gridPosition.x},${map.gridPosition.y}`;
        expect(gridKeys.has(key)).toBe(false);
        gridKeys.add(key);
      }

      const objectKeys = new Set();
      map.objects.forEach((object) => {
        expect(WORLD_OBJECT_TYPES[object.type]).toBeDefined();
        expect(object.x).toBeGreaterThanOrEqual(0);
        expect(object.x).toBeLessThan(map.size.width);
        expect(object.y).toBeGreaterThanOrEqual(0);
        expect(object.y).toBeLessThan(map.size.height);
        objectKeys.add(`${object.x},${object.y}`);
      });
      expect(objectKeys.has(`${map.playerStart.x},${map.playerStart.y}`)).toBe(false);

      map.terrainPatches.forEach((patch) => {
        expect(TERRAIN_TYPES[patch.terrain]).toBeDefined();
        patch.cells.forEach(([x, y]) => {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(map.size.width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(map.size.height);
        });
      });

      map.encounters.forEach((encounter) => {
        expect(MONSTER_TEMPLATES[encounter.type]).toBeDefined();
        expect(encounter.groupId).toBeTruthy();
        expect(encounter.x).toBeGreaterThanOrEqual(0);
        expect(encounter.x).toBeLessThan(map.size.width);
        expect(encounter.y).toBeGreaterThanOrEqual(0);
        expect(encounter.y).toBeLessThan(map.size.height);
        expect(objectKeys.has(`${encounter.x},${encounter.y}`)).toBe(false);
      });

      map.connections.forEach((connection) => {
        const target = getWorldMap(connection.targetMapId);
        expect(target).toBeDefined();
        expect(connection.x).toBeGreaterThanOrEqual(0);
        expect(connection.x).toBeLessThan(map.size.width);
        expect(connection.y).toBeGreaterThanOrEqual(0);
        expect(connection.y).toBeLessThan(map.size.height);
        expect(connection.spawn.x).toBeGreaterThanOrEqual(0);
        expect(connection.spawn.x).toBeLessThan(target.size.width);
        expect(connection.spawn.y).toBeGreaterThanOrEqual(0);
        expect(connection.spawn.y).toBeLessThan(target.size.height);
      });
    });
  });

  it('places the authored road maps on the world minimap chain', () => {
    expect(getWorldMap('open-road').gridPosition).toEqual({ x: 2, y: 0 });
    expect(getWorldMap('stone-grove').gridPosition).toEqual({ x: 3, y: 0 });
    expect(getWorldMap('stone-grove').defaultTerrain).toBe('debugGrass');

    expect(getWorldMap('chao3-grid-1-0').connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetMapId: 'open-road', x: 9, y: 5 }),
      ]),
    );
    expect(getWorldMap('open-road').connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetMapId: 'chao3-grid-1-0', x: 0, y: 4 }),
        expect.objectContaining({ targetMapId: 'stone-grove', x: 9, y: 5 }),
      ]),
    );
    expect(getWorldMap('stone-grove').connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetMapId: 'open-road', x: 0, y: 4 }),
      ]),
    );
  });

  it('builds a connected generated grid around the start while keeping the nursery isolated', () => {
    const generatedGridMaps = Object.values(WORLD_MAPS).filter((map) => {
      return map.id.startsWith('chao3-grid-') && map.id !== NURSERY_INTRO_MAP_ID;
    });

    expect(generatedGridMaps.length).toBeGreaterThanOrEqual(10);
    expect(getWorldMap('chao3-grid-0-1').connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetMapId: 'chao3-start' }),
        expect.objectContaining({ targetMapId: 'chao3-grid-1-1' }),
      ]),
    );
    expect(getWorldMap('chao3-grid-7-0')).toMatchObject({
      gridPosition: { x: 7, y: 0 },
      enemyLevel: 7,
      dangerDistance: 7,
    });
    expect(getWorldMap('chao3-grid--2-0').connections.some((connection) => {
      return connection.targetMapId === NURSERY_INTRO_MAP_ID;
    })).toBe(false);
  });

  it('configures the nursery room as a safe intro scene with a non-blocking passage', () => {
    const nursery = getWorldMap(NURSERY_INTRO_MAP_ID);
    const portal = nursery.objects.find((object) => object.type === 'nursery-portal');

    expect(nursery).toMatchObject({
      id: NURSERY_INTRO_MAP_ID,
      name: 'O Berçário',
      gridPosition: { x: -1, y: 0 },
      playerStart: { x: 4, y: 6 },
      encounters: [],
      randomEncounters: false,
    });
    expect(nursery.objects.some((object) => object.x === nursery.playerStart.x && object.y === nursery.playerStart.y)).toBe(false);
    expect(portal).toMatchObject({ x: 9, y: 5 });
    expect(WORLD_OBJECT_TYPES[portal.type].blocksMovement).toBe(false);
  });
});
