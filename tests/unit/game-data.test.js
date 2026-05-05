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

  it('defines the ranger level 3 air spell', () => {
    expect(SPELL_DEFINITIONS.ranger[0]).toMatchObject({
      id: 'rangerVerdantArrow',
      name: 'Flecha Hirvante',
      element: SPELL_ELEMENTS.AIR,
      apCost: 4,
      damage: 10,
      minRange: 2,
      maxRange: 6,
      pattern: ATTACK_PATTERNS.CROSS,
      unlockLevel: 3,
      iconKey: 'spellVerdantArrow',
    });
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
});
