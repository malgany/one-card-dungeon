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

export const DEFAULT_MAP_COLOR_MODELS = Object.freeze([
  Object.freeze({
    id: 'model-0-0',
    label: '0,0',
    values: Object.freeze({
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
  }),
  Object.freeze({
    id: 'model-0-1',
    label: '0,1',
    values: Object.freeze({
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
  }),
  Object.freeze({
    id: 'model-0--1',
    label: '0,-1',
    values: Object.freeze({
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
  }),
  Object.freeze({
    id: 'model-1-0',
    label: '1,0',
    values: Object.freeze({
      water1: '#4f724b',
      water2: '#486345',
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
  }),
  Object.freeze({
    id: 'model--1-0',
    label: '-1,0',
    values: Object.freeze({
      water1: '#fff8df',
      water2: '#f4d676',
      water3: '#fff1b8',
      top1: '#fff8df',
      top2: '#f4df99',
      top3: '#fffdf2',
      top4: '#e8c95e',
      top5: '#d6af38',
      side1: '#f7e3a4',
      side2: '#c89d3f',
      side3: '#fff1c7',
      side4: '#b7832f',
      side5: '#6f5521',
    }),
  }),
]);

const LAYERED_MAP_COLOR_VALUES = Object.freeze([
  Object.freeze({
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
  Object.freeze({
    water1: '#22c7d8',
    water2: '#0b7f8e',
    water3: '#b7f4ec',
    top1: '#55c95a',
    top2: '#8ee079',
    top3: '#1e8f3c',
    top4: '#3aaa52',
    top5: '#2e6f3d',
    side1: '#9a6038',
    side2: '#694023',
    side3: '#7f4f2d',
    side4: '#b4835f',
    side5: '#3c281a',
  }),
  Object.freeze({
    water1: '#1b8a86',
    water2: '#0d5f61',
    water3: '#69d8c8',
    top1: '#75a644',
    top2: '#52734d',
    top3: '#5c8f3b',
    top4: '#416b36',
    top5: '#314f2b',
    side1: '#8c5946',
    side2: '#614a3c',
    side3: '#73503a',
    side4: '#9d755c',
    side5: '#3c2d24',
  }),
  Object.freeze({
    water1: '#3b6b73',
    water2: '#294a52',
    water3: '#7fb2b7',
    top1: '#80866f',
    top2: '#a0a58d',
    top3: '#5f6f57',
    top4: '#6d765f',
    top5: '#41483e',
    side1: '#66675e',
    side2: '#484942',
    side3: '#57534b',
    side4: '#8a8173',
    side5: '#282824',
  }),
  Object.freeze({
    water1: '#3b1426',
    water2: '#170911',
    water3: '#7e263c',
    top1: '#451329',
    top2: '#7c1e37',
    top3: '#160711',
    top4: '#a83246',
    top5: '#050306',
    side1: '#331023',
    side2: '#17080f',
    side3: '#5e1b32',
    side4: '#8f2a40',
    side5: '#050306',
  }),
  Object.freeze({
    water1: '#5a1421',
    water2: '#23070b',
    water3: '#a22b38',
    top1: '#541128',
    top2: '#99243a',
    top3: '#1a050a',
    top4: '#c23b48',
    top5: '#060203',
    side1: '#3b0d1f',
    side2: '#1c060c',
    side3: '#702238',
    side4: '#a63245',
    side5: '#050203',
  }),
  Object.freeze({
    water1: '#8d1d23',
    water2: '#35080c',
    water3: '#d13b38',
    top1: '#64102b',
    top2: '#b92938',
    top3: '#1b0509',
    top4: '#e04a4f',
    top5: '#050102',
    side1: '#43091d',
    side2: '#1f050a',
    side3: '#84233a',
    side4: '#bf3347',
    side5: '#050102',
  }),
  Object.freeze({
    water1: '#f25c05',
    water2: '#f28f16',
    water3: '#f2c641',
    top1: '#2a0718',
    top2: '#8c1232',
    top3: '#090207',
    top4: '#c9233c',
    top5: '#000000',
    side1: '#250613',
    side2: '#0b0205',
    side3: '#61142b',
    side4: '#a51e36',
    side5: '#000000',
  }),
]);

export const MAP_COLOR_VALUES_BY_MAP = Object.freeze({
  'chao3-grid--1-0': Object.freeze({
    water1: '#fff8df',
    water2: '#f4d676',
    water3: '#fff1b8',
    top1: '#fff8df',
    top2: '#f4df99',
    top3: '#fffdf2',
    top4: '#e8c95e',
    top5: '#d6af38',
    side1: '#f7e3a4',
    side2: '#c89d3f',
    side3: '#fff1c7',
    side4: '#b7832f',
    side5: '#6f5521',
  }),
  'chao3-grid-0--1': LAYERED_MAP_COLOR_VALUES[1],
  'chao3-grid-0-1': LAYERED_MAP_COLOR_VALUES[1],
  'chao3-grid-1-0': LAYERED_MAP_COLOR_VALUES[1],
  'chao3-start': LAYERED_MAP_COLOR_VALUES[0],
  'open-road': LAYERED_MAP_COLOR_VALUES[2],
  'stone-grove': LAYERED_MAP_COLOR_VALUES[3],
});

export function normalizeMapColorValues(values = {}, fallback = DEFAULT_MAP_COLOR_VALUES) {
  return Object.fromEntries(Object.entries(DEFAULT_MAP_COLOR_VALUES).map(([key, defaultColor]) => {
    const value = values?.[key] || fallback?.[key] || defaultColor;
    return [key, /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : defaultColor];
  }));
}

export function getDefaultNewMapColorValues() {
  return normalizeMapColorValues(DEFAULT_MAP_COLOR_MODELS[0]?.values || DEFAULT_MAP_COLOR_VALUES);
}

function layeredMapCoordinates(mapId) {
  if (mapId === 'chao3-start') return { x: 0, y: 0 };
  const match = /^chao3-grid-(-?\d+)-(-?\d+)$/.exec(String(mapId || ''));
  if (!match) return null;
  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
}

function layeredMapColorValues(mapId) {
  const coordinates = layeredMapCoordinates(mapId);
  if (!coordinates) return null;

  const layer = Math.abs(coordinates.x) + Math.abs(coordinates.y);
  return LAYERED_MAP_COLOR_VALUES[Math.min(layer, LAYERED_MAP_COLOR_VALUES.length - 1)] || null;
}

export function getMapColorValuesForMap(mapId) {
  return normalizeMapColorValues(
    MAP_COLOR_VALUES_BY_MAP[mapId] || layeredMapColorValues(mapId),
    getDefaultNewMapColorValues(),
  );
}
