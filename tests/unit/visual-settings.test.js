import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VISUAL_SETTINGS,
  getOverworldWaterEnabled,
} from '../../js/config/visual-settings.js';

describe('visual settings config', () => {
  it('provides the persisted debug visual defaults', () => {
    expect(DEFAULT_VISUAL_SETTINGS).toMatchObject({
      exposure: 1.0,
      ambientIntensity: 1.05,
      keyIntensity: 1.75,
      keyLightDirectionDeg: 111.25,
      fogDensity: 0.0,
      shadowMapEnabled: true,
      showOutlines: false,
      showGrid: false,
      overworldOrthographicCamera: true,
      overworldWater: true,
    });
  });

  it('lets the current map runtime value override the global water setting', () => {
    expect(getOverworldWaterEnabled({
      mapId: 'chao3-start',
      baseValues: { overworldWater: true },
      runtimeValues: { overworldWater: false },
    })).toBe(false);

    expect(getOverworldWaterEnabled({
      mapId: 'chao3-start',
      baseValues: { overworldWater: false },
      runtimeValues: { overworldWater: true },
    })).toBe(true);
  });
});
