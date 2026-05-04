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
  'chao3-grid--1-0': Object.freeze({
    water1: '#00d5ff',
    water2: '#017f98',
    water3: '#abeaf7',
    top1: '#38e22c',
    top2: '#ffffff',
    top3: '#0ba300',
    top4: '#1eba1c',
    top5: '#2b552b',
    side1: '#ab6130',
    side2: '#6f3915',
    side3: '#89502a',
    side4: '#b89984',
    side5: '#000000',
  }),
  'chao3-grid-0--1': Object.freeze({
    water1: '#121212',
    water2: '#1a1a1a',
    water3: '#575757',
    top1: '#828282',
    top2: '#828282',
    top3: '#000000',
    top4: '#828282',
    top5: '#828282',
    side1: '#828282',
    side2: '#828282',
    side3: '#828282',
    side4: '#828282',
    side5: '#828282',
  }),
  'chao3-grid-0-1': Object.freeze({
    water1: '#003670',
    water2: '#003670',
    water3: '#2072cb',
    top1: '#ffffff',
    top2: '#ffffff',
    top3: '#ffffff',
    top4: '#ffffff',
    top5: '#ffffff',
    side1: '#1ae8ff',
    side2: '#1ae8ff',
    side3: '#1ae8ff',
    side4: '#1ae8ff',
    side5: '#1ae8ff',
  }),
  'chao3-grid-1-0': Object.freeze({
    water1: '#4f724b',
    water2: '#4f724b',
    water3: '#81ab7c',
    top1: '#75a644',
    top2: '#52734d',
    top3: '#75a644',
    top4: '#52734d',
    top5: '#52734d',
    side1: '#8c5946',
    side2: '#614a3c',
    side3: '#614a3c',
    side4: '#9d755c',
    side5: '#614a3c',
  }),
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
