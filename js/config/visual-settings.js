export const DEFAULT_VISUAL_SETTINGS = Object.freeze({
  exposure: 1,
  ambientIntensity: 1.05,
  keyIntensity: 1.75,
  keyLightDirectionDeg: 111.25,
  fogDensity: 0,
  shadowMapEnabled: true,
  showOutlines: false,
  showGrid: false,
  overworldOrthographicCamera: true,
  overworldWater: true,
});

export const MAP_VISUAL_SETTINGS_BY_MAP = Object.freeze({
  'chao3-grid--1-0': Object.freeze({
    overworldWater: false,
  }),
  'chao3-start': Object.freeze({
    overworldWater: true,
  }),
});

export function getOverworldWaterEnabled({ mapId = null, baseValues = DEFAULT_VISUAL_SETTINGS, runtimeValues = null } = {}) {
  if (typeof runtimeValues?.overworldWater === 'boolean') return runtimeValues.overworldWater;
  const mapValues = mapId ? MAP_VISUAL_SETTINGS_BY_MAP[mapId] : null;
  if (typeof mapValues?.overworldWater === 'boolean') return mapValues.overworldWater;
  return baseValues?.overworldWater !== false;
}
