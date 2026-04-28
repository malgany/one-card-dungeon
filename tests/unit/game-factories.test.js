import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEVELS, MONSTER_TEMPLATES, PHASES } from '../../js/config/game-data.js';
import {
  createGame,
  createMonster,
  levelMonsters,
  makeEnergyRoll,
  randDie,
} from '../../js/game/game-factories.js';

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
    const monster = createMonster('spider', 4, 0, 0);

    expect(monster).toMatchObject({
      id: 'spider-0-4-0',
      type: 'spider',
      x: 4,
      y: 0,
      hp: MONSTER_TEMPLATES.spider.hp,
      maxHp: MONSTER_TEMPLATES.spider.hp,
      name: MONSTER_TEMPLATES.spider.name,
    });
    expect(levelMonsters(LEVELS[0]).map((m) => m.id)).toEqual(['spider-0-4-0', 'spider-1-5-2']);
  });

  it('creates the initial game state for level one', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const game = createGame();

    expect(game.levelIndex).toBe(0);
    expect(game.player).toMatchObject({
      x: LEVELS[0].start.x,
      y: LEVELS[0].start.y,
      health: 60,
      maxHealth: 60,
      apMax: 6,
      speedBase: 4,
      attackSlot: {
        name: 'Golpe',
        apCost: 5,
        damage: 5,
        lifeSteal: 1,
      },
    });
    expect(game.phase).toBe(PHASES.HERO);
    expect(game.roll).toEqual([]);
    expect(game.speedRemaining).toBe(4);
    expect(game.apRemaining).toBe(6);
    expect(game.turnQueue).toEqual(['player', ...game.monsters.map((m) => m.id)]);
    expect(game.banner.title).toBe('Sua vez');
  });
});
