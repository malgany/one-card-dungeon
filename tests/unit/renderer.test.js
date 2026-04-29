import { describe, expect, it } from 'vitest';
import { getAnimationEndTime } from '../../js/ui/renderer.js';

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
});
