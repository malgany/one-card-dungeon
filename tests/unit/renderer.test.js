import { describe, expect, it } from 'vitest';
import { GAME_MODES } from '../../js/config/game-data.js';
import {
  getAnimationEndTime,
  getWorldMinimapLayout,
  getWorldMapDeleteStatus,
  shouldDrawWorldMinimap,
  worldGridScreenPosition,
} from '../../js/ui/renderer.js';

describe('renderer animation helpers', () => {
  it('keeps total-duration movement animations alive for overworld paths', () => {
    const animation = {
      type: 'movement',
      startTime: 100,
      path: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      totalDuration: 900,
    };

    expect(getAnimationEndTime(animation)).toBe(1000);
  });

  it('keeps per-tile movement animations alive for combat paths', () => {
    const animation = {
      type: 'movement',
      startTime: 20,
      path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      durationPerTile: 120,
    };

    expect(getAnimationEndTime(animation)).toBe(260);
  });

  it('keeps model action animations alive for their explicit duration', () => {
    const animation = {
      type: 'modelAction',
      startTime: 200,
      duration: 670,
    };

    expect(getAnimationEndTime(animation)).toBe(870);
  });

  it('keeps projectile animations alive for their explicit duration', () => {
    const animation = {
      type: 'projectile',
      startTime: 500,
      duration: 280,
    };

    expect(getAnimationEndTime(animation)).toBe(780);
  });

  it('shows the world minimap in overworld mode without requiring debug UI', () => {
    expect(shouldDrawWorldMinimap({ mode: GAME_MODES.OVERWORLD })).toBe(true);
    expect(shouldDrawWorldMinimap({ mode: GAME_MODES.COMBAT })).toBe(false);
  });

  it('keeps the compact world minimap above the bottom overworld HUD', () => {
    const layout = getWorldMinimapLayout({ compact: true, sw: 390, sh: 844 }, 98);

    expect(layout.cy + layout.radius).toBeLessThanOrEqual(844 - 98);
    expect(layout.cx + layout.radius).toBe(390 - 18);
  });

  it('centers minimap positions relative to the active world room', () => {
    expect(
      worldGridScreenPosition(
        { x: 100, y: 100 },
        { x: 2, y: 0 },
        { x: 2, y: 0 },
        32,
        22,
      ),
    ).toEqual({ x: 100, y: 100 });

    expect(
      worldGridScreenPosition(
        { x: 100, y: 100 },
        { x: 3, y: 0 },
        { x: 2, y: 0 },
        32,
        22,
      ),
    ).toEqual({ x: 132, y: 122 });
  });

  it('only allows deleting endpoint world maps without orphaning the graph', () => {
    const maps = {
      start: {
        id: 'start',
        gridPosition: { x: 0, y: 0 },
        connections: [{ targetMapId: 'middle' }],
      },
      middle: {
        id: 'middle',
        gridPosition: { x: 1, y: 0 },
        connections: [{ targetMapId: 'start' }, { targetMapId: 'end' }],
      },
      end: {
        id: 'end',
        gridPosition: { x: 2, y: 0 },
        connections: [{ targetMapId: 'middle' }],
      },
    };

    expect(getWorldMapDeleteStatus('end', maps, 'start').canDelete).toBe(true);
    expect(getWorldMapDeleteStatus('middle', maps, 'start').canDelete).toBe(false);
    expect(getWorldMapDeleteStatus('start', maps, 'start').canDelete).toBe(false);
  });
});
