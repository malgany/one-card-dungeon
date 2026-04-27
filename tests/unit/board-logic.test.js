import { describe, expect, it } from 'vitest';
import {
  dijkstra,
  distanceBetween,
  hasLineOfSight,
  inBounds,
  levelWallsSet,
  lineCells,
  monsterOccupiedKeys,
  neighbors,
  parseKey,
  posKey,
  reconstructPath,
  samePos,
  stepCost,
} from '../../js/game/board-logic.js';

describe('board logic', () => {
  it('serializes positions and compares coordinates', () => {
    expect(posKey({ x: 2, y: 4 })).toBe('2,4');
    expect(parseKey('3,5')).toEqual({ x: 3, y: 5 });
    expect(samePos({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(samePos({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe(false);
  });

  it('checks board bounds and movement costs', () => {
    expect(inBounds({ x: 0, y: 0 })).toBe(true);
    expect(inBounds({ x: 5, y: 5 })).toBe(true);
    expect(inBounds({ x: 6, y: 0 })).toBe(false);
    expect(inBounds({ x: -1, y: 0 })).toBe(false);
    expect(stepCost({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(2);
    expect(stepCost({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(3);
  });

  it('returns valid neighbors for corners and center cells', () => {
    expect(neighbors({ x: 0, y: 0 })).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(neighbors({ x: 3, y: 3 })).toHaveLength(8);
  });

  it('builds wall and monster occupancy sets', () => {
    expect(levelWallsSet(0).has('2,1')).toBe(true);
    expect(monsterOccupiedKeys([
      { id: 'a', x: 1, y: 1, hp: 1 },
      { id: 'b', x: 2, y: 2, hp: 0 },
      { id: 'c', x: 3, y: 3, hp: 2 },
    ], 'c')).toEqual(new Set(['1,1']));
  });

  it('finds cheapest paths without crossing blocked cells', () => {
    const blocked = new Set(['1,0', '1,1']);
    const { dist, prev } = dijkstra({ x: 0, y: 0 }, blocked);

    expect(dist.get('0,1')).toBe(2);
    expect(dist.has('1,0')).toBe(false);
    expect(dist.get('2,0')).toBe(10);
    expect(reconstructPath(prev, { x: 2, y: 0 })).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]);
  });

  it('can optionally allow a blocked target when measuring distance', () => {
    const blocked = new Set(['1,0']);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 1, y: 0 }, blocked)).toBe(Number.POSITIVE_INFINITY);
    expect(distanceBetween({ x: 0, y: 0 }, { x: 1, y: 0 }, blocked, true)).toBe(2);
  });

  it('detects line-of-sight blocks from walls and units', () => {
    expect(lineCells({ x: 0, y: 0 }, { x: 3, y: 0 })).toContainEqual({ x: 1, y: 0 });
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 3, y: 0 }, new Set(['1,0']))).toBe(false);
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 3, y: 0 }, new Set(), new Set(['2,0']))).toBe(false);
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 3, y: 0 }, new Set(), new Set())).toBe(true);
  });
});
