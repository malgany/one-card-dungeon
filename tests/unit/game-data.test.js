import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  GAME_MODES,
  LEVELS,
  MONSTER_TEMPLATES,
  OVERWORLD_MAPS,
  PHASES,
  STAT_META,
  TIMING,
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

  it('keeps overworld map data valid and grouped', () => {
    OVERWORLD_MAPS.forEach((map) => {
      expect(map.width).toBeGreaterThan(BOARD_SIZE);
      expect(map.height).toBeGreaterThan(BOARD_SIZE);
      expect(map.playerStart.x).toBeGreaterThanOrEqual(0);
      expect(map.playerStart.x).toBeLessThan(map.width);
      expect(map.playerStart.y).toBeGreaterThanOrEqual(0);
      expect(map.playerStart.y).toBeLessThan(map.height);

      const wallKeys = new Set(map.walls.map(([x, y]) => `${x},${y}`));
      expect(wallKeys.has(`${map.playerStart.x},${map.playerStart.y}`)).toBe(false);

      map.enemies.forEach(([type, x, y, groupId]) => {
        expect(MONSTER_TEMPLATES[type]).toBeDefined();
        expect(groupId).toBeTruthy();
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(map.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(map.height);
        expect(wallKeys.has(`${x},${y}`)).toBe(false);
      });
    });
  });
});
