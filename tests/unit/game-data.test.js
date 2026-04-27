import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, LEVELS, MONSTER_TEMPLATES, PHASES, STAT_META, TIMING } from '../../js/config/game-data.js';

describe('game data', () => {
  it('defines the phases and stat metadata used by the UI and actions', () => {
    expect(PHASES).toMatchObject({
      ENERGY: 'energy',
      HERO: 'hero',
      LEVELUP: 'levelup',
      WON: 'won',
      LOST: 'lost',
    });
    expect(Object.keys(STAT_META)).toEqual(['speed', 'attack', 'defense']);
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
});
