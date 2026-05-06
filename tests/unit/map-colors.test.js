import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_COLOR_MODELS,
  DEFAULT_MAP_COLOR_VALUES,
  MAP_COLOR_VALUES_BY_MAP,
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

  it('keeps reusable color models independent from map overrides', () => {
    const whiteModel = DEFAULT_MAP_COLOR_MODELS.find((model) => model.label === '0,1');

    expect(whiteModel.values).not.toBe(MAP_COLOR_VALUES_BY_MAP['chao3-grid-0-1']);
    expect(whiteModel.values.top1).toBe('#ffffff');
    expect(whiteModel.values.side1).toBe('#1ae8ff');
  });
});
