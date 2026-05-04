export const DEFAULT_MAP_COLOR_VALUES = Object.freeze({
  water1: '#f25c05',
  water2: '#f28f16',
  water3: '#f2c641',
  top1: '#733c50',
  top2: '#bf8a9d',
  top3: '#000000',
  top4: '#332640',
  top5: '#000000',
  side1: '#733c50',
  side2: '#bf8a9d',
  side3: '#40251b',
  side4: '#332640',
  side5: '#000000',
});

export const MAP_COLOR_VALUES_BY_MAP = Object.freeze({
});

export function normalizeMapColorValues(values = {}, fallback = DEFAULT_MAP_COLOR_VALUES) {
  return Object.fromEntries(Object.entries(DEFAULT_MAP_COLOR_VALUES).map(([key, defaultColor]) => {
    const value = values?.[key] || fallback?.[key] || defaultColor;
    return [key, /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : defaultColor];
  }));
}

export function getMapColorValuesForMap(mapId) {
  return normalizeMapColorValues(MAP_COLOR_VALUES_BY_MAP[mapId]);
}
