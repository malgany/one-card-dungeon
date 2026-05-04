import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_COLOR_VALUES,
  getMapColorValuesForMap,
  normalizeMapColorValues,
} from '../../js/config/map-colors.js';

describe('map color config', () => {
  it('normalizes a partial map palette without leaking missing values', () => {
    const normalized = normalizeMapColorValues({
      water1: '#123ABC',
      top1: 'invalid',
    });

    expect(normalized.water1).toBe('#123abc');
    expect(normalized.top1).toBe(DEFAULT_MAP_COLOR_VALUES.top1);
    expect(normalized.side1).toBe(DEFAULT_MAP_COLOR_VALUES.side1);
  });

  it('falls back to defaults for maps without an override', () => {
    expect(getMapColorValuesForMap('missing-map')).toEqual(DEFAULT_MAP_COLOR_VALUES);
  });
});
