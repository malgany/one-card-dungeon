const baseChao3Map = {
  size: { width: 10, height: 10 },
  playerStart: { x: 2, y: 8 },
  biome: 'meadow',
  defaultTerrain: 'debugGrass',
  terrainPatches: [],
  objects: [],
};

const GRID_EXITS = {
  upperLeft: { x: 0, y: 4 },
  upperRight: { x: 5, y: 0 },
  lowerRight: { x: 9, y: 5 },
  lowerLeft: { x: 4, y: 9 },
};

const CHAO3_GRID_RADIUS = 7;
const INACCESSIBLE_GRID_KEYS = new Set(['-1,0']);
const SPECIAL_GRID_MAP_IDS = Object.freeze({
  '0,0': 'chao3-start',
  '-1,0': 'chao3-grid--1-0',
  '2,0': 'open-road',
  '3,0': 'stone-grove',
});
const GRID_DIRECTIONS = Object.freeze([
  { id: 'west', dx: -1, dy: 0, exit: 'upperLeft', spawn: 'lowerRight' },
  { id: 'north', dx: 0, dy: 1, exit: 'upperRight', spawn: 'lowerLeft' },
  { id: 'east', dx: 1, dy: 0, exit: 'lowerRight', spawn: 'upperLeft' },
  { id: 'south', dx: 0, dy: -1, exit: 'lowerLeft', spawn: 'upperRight' },
]);
const ENCOUNTER_ANCHORS = Object.freeze([
  { x: 4, y: 4 },
  { x: 6, y: 3 },
  { x: 7, y: 6 },
  { x: 3, y: 7 },
]);
const DECOR_ANCHORS = Object.freeze([
  { x: 2, y: 2 },
  { x: 7, y: 2 },
  { x: 2, y: 7 },
  { x: 7, y: 7 },
  { x: 5, y: 5 },
]);

function gridKey(x, y) {
  return `${x},${y}`;
}

export function chao3GridDistance(gridPosition) {
  return Math.abs(gridPosition?.x || 0) + Math.abs(gridPosition?.y || 0);
}

export function chao3MapIdForGrid(x, y) {
  return SPECIAL_GRID_MAP_IDS[gridKey(x, y)] || `chao3-grid-${x}-${y}`;
}

function isInsideGeneratedGrid(x, y) {
  const distance = chao3GridDistance({ x, y });
  return distance <= CHAO3_GRID_RADIUS && !INACCESSIBLE_GRID_KEYS.has(gridKey(x, y));
}

function targetMapIdForGrid(x, y) {
  if (!isInsideGeneratedGrid(x, y)) return null;
  return chao3MapIdForGrid(x, y);
}

export function createChao3GridConnections(gridPosition) {
  const sourceId = chao3MapIdForGrid(gridPosition.x, gridPosition.y);

  return GRID_DIRECTIONS.flatMap((direction) => {
    const targetX = gridPosition.x + direction.dx;
    const targetY = gridPosition.y + direction.dy;
    const targetMapId = targetMapIdForGrid(targetX, targetY);
    if (!targetMapId) return [];

    return [{
      id: `${sourceId}-${direction.id}`,
      ...GRID_EXITS[direction.exit],
      targetMapId,
      spawn: GRID_EXITS[direction.spawn],
    }];
  });
}

function defaultTerrainForGrid(distance) {
  if (distance >= 4) return 'corrupted';
  if (distance >= 3) return 'debugGrass';
  return 'grass';
}

function biomeForGrid(distance) {
  return distance >= 4 ? 'stonefields' : 'meadow';
}

function encounterTypesForGrid(x, y) {
  const distance = chao3GridDistance({ x, y });
  const parity = Math.abs((x * 13) + (y * 7)) % 2;

  if (distance <= 1) return ['skeletonMinion', 'skeletonRogue'];
  if (distance <= 2) return parity === 0
    ? ['skeletonRogue', 'skeletonWarrior', 'specter']
    : ['skeletonWarrior', 'skeletonRogue', 'specter'];
  if (distance <= 4) return parity === 0
    ? ['skeletonWarrior', 'specter', 'skeletonMage']
    : ['specter', 'skeletonWarrior', 'skeletonMage'];
  return parity === 0
    ? ['skeletonMage', 'skeletonWarrior', 'specter']
    : ['skeletonWarrior', 'skeletonMage', 'specter'];
}

function createGridEncounters(x, y) {
  const mapId = chao3MapIdForGrid(x, y);

  return encounterTypesForGrid(x, y).map((type, index) => {
    const anchor = ENCOUNTER_ANCHORS[index % ENCOUNTER_ANCHORS.length];
    return {
      id: `${mapId}-pool-${index}`,
      type,
      x: anchor.x,
      y: anchor.y,
      groupId: `${mapId}-pool-${index}`,
    };
  });
}

function createGridTerrainPatches(x, y) {
  const distance = chao3GridDistance({ x, y });
  if (distance <= 1) return [];

  const offset = Math.abs((x * 5) + (y * 3)) % 2;
  const stoneCells = offset === 0
    ? [[1, 3], [2, 3], [6, 6], [7, 6]]
    : [[6, 2], [7, 2], [3, 6], [4, 6]];
  const dirtCells = offset === 0
    ? [[4, 2], [5, 2], [4, 7], [5, 7]]
    : [[2, 5], [3, 5], [7, 4], [8, 4]];

  if (distance >= 5) {
    return [
      { terrain: 'dirt', cells: dirtCells },
      { terrain: 'stone', cells: stoneCells },
    ];
  }

  return [
    { terrain: distance >= 3 ? 'stone' : 'dirt', cells: stoneCells },
  ];
}

function createGridObjects(x, y) {
  const distance = chao3GridDistance({ x, y });
  const count = Math.min(DECOR_ANCHORS.length, 1 + Math.floor(distance / 2));
  const objectTypes = distance >= 5
    ? ['forest-rock', 'dead-tree', 'forest-rock', 'forest-bush']
    : distance >= 3
      ? ['forest-rock', 'forest-bush', 'dead-tree', 'forest-rock']
      : ['grass-block', 'forest-bush', 'forest-rock'];
  const mapId = chao3MapIdForGrid(x, y);

  return DECOR_ANCHORS.slice(0, count).map((cell, index) => {
    return {
      id: `${mapId}-decor-${index}`,
      type: objectTypes[index % objectTypes.length],
      x: cell.x,
      y: cell.y,
    };
  });
}

function createLayeredGridMap(x, y) {
  const distance = chao3GridDistance({ x, y });
  const id = chao3MapIdForGrid(x, y);

  return createChao3GridMap({
    id,
    name: `Campo ${x},${y}`,
    gridPosition: { x, y },
    playerStart: baseChao3Map.playerStart,
    biome: biomeForGrid(distance),
    defaultTerrain: defaultTerrainForGrid(distance),
    terrainPatches: createGridTerrainPatches(x, y),
    objects: createGridObjects(x, y),
    encounters: createGridEncounters(x, y),
    connections: createChao3GridConnections({ x, y }),
    enemyLevel: Math.max(1, distance),
    dangerDistance: distance,
  });
}

function createChao3GridMap({
  id,
  name,
  gridPosition,
  playerStart,
  biome = baseChao3Map.biome,
  defaultTerrain = baseChao3Map.defaultTerrain,
  terrainPatches = baseChao3Map.terrainPatches,
  objects = baseChao3Map.objects,
  connections = [],
  encounters = [],
  randomEncounters = true,
  enemyLevel = 1,
  dangerDistance = chao3GridDistance(gridPosition),
}) {
  return {
    ...baseChao3Map,
    id,
    name,
    gridPosition,
    biome,
    defaultTerrain,
    terrainPatches,
    playerStart: playerStart || baseChao3Map.playerStart,
    objects,
    encounters,
    randomEncounters,
    connections,
    enemyLevel,
    dangerDistance,
  };
}

export const chao3StartMap = createChao3GridMap({
  id: 'chao3-start',
  name: 'Campo novo',
  gridPosition: { x: 0, y: 0 },
  encounters: [
    { id: 'starter-skeleton-minion-0', type: 'skeletonMinion', x: 5, y: 4, groupId: 'starter-skeleton-minion-0' },
    { id: 'starter-skeleton-minion-1', type: 'skeletonMinion', x: 7, y: 7, groupId: 'starter-skeleton-minion-1' },
  ],
  connections: [
    {
      id: 'chao3-start-northwest',
      ...GRID_EXITS.upperLeft,
      targetMapId: 'chao3-grid--1-0',
      spawn: GRID_EXITS.lowerRight,
      blocked: true,
      blockedMessage: 'algo está bloqueando o caminho',
    },
    {
      id: 'chao3-start-northeast',
      ...GRID_EXITS.upperRight,
      targetMapId: 'chao3-grid-0-1',
      spawn: GRID_EXITS.lowerLeft,
    },
    {
      id: 'chao3-start-southeast',
      ...GRID_EXITS.lowerRight,
      targetMapId: 'chao3-grid-1-0',
      spawn: GRID_EXITS.upperLeft,
    },
    {
      id: 'chao3-start-southwest',
      ...GRID_EXITS.lowerLeft,
      targetMapId: 'chao3-grid-0--1',
      spawn: GRID_EXITS.upperRight,
    },
  ],
});

const chao3NorthwestMap = createChao3GridMap({
  id: 'chao3-grid--1-0',
  name: 'O Berçário',
  gridPosition: { x: -1, y: 0 },
  playerStart: { x: 4, y: 6 },
  randomEncounters: false,
  objects: [
    { id: 'nursery-pillar-0', type: 'nursery-pillar', x: 1, y: 2 },
    { id: 'nursery-pillar-1', type: 'nursery-pillar', x: 8, y: 2 },
    { id: 'nursery-pillar-broken-0', type: 'nursery-pillar-broken', x: 2, y: 7 },
    { id: 'nursery-pillar-broken-1', type: 'nursery-pillar-broken', x: 7, y: 7 },
    { id: 'nursery-rubble-0', type: 'nursery-rubble', x: 2, y: 3 },
    { id: 'nursery-rubble-1', type: 'nursery-rubble', x: 6, y: 2 },
    { id: 'nursery-rubble-2', type: 'nursery-rubble', x: 7, y: 8 },
    { id: 'nursery-portal-0', type: 'nursery-portal', x: 9, y: 5 },
  ],
  connections: [
    {
      id: 'chao3-grid--1-0-back',
      ...GRID_EXITS.lowerRight,
      targetMapId: 'chao3-start',
      spawn: GRID_EXITS.upperLeft,
    },
  ],
});

const chao3NortheastMap = createChao3GridMap({
  id: 'chao3-grid-0-1',
  name: 'Campo novo 0,1',
  gridPosition: { x: 0, y: 1 },
  playerStart: GRID_EXITS.lowerLeft,
  defaultTerrain: defaultTerrainForGrid(1),
  encounters: createGridEncounters(0, 1),
  connections: createChao3GridConnections({ x: 0, y: 1 }),
  enemyLevel: 1,
  dangerDistance: 1,
});

const chao3SoutheastMap = createChao3GridMap({
  id: 'chao3-grid-1-0',
  name: 'Campo novo 1,0',
  gridPosition: { x: 1, y: 0 },
  playerStart: GRID_EXITS.upperLeft,
  defaultTerrain: defaultTerrainForGrid(1),
  encounters: createGridEncounters(1, 0),
  connections: createChao3GridConnections({ x: 1, y: 0 }),
  enemyLevel: 1,
  dangerDistance: 1,
});

const chao3SouthwestMap = createChao3GridMap({
  id: 'chao3-grid-0--1',
  name: 'Campo novo 0,-1',
  gridPosition: { x: 0, y: -1 },
  playerStart: GRID_EXITS.upperRight,
  defaultTerrain: defaultTerrainForGrid(1),
  encounters: createGridEncounters(0, -1),
  connections: createChao3GridConnections({ x: 0, y: -1 }),
  enemyLevel: 1,
  dangerDistance: 1,
});

const generatedChao3GridMaps = [];
for (let y = -CHAO3_GRID_RADIUS; y <= CHAO3_GRID_RADIUS; y += 1) {
  for (let x = -CHAO3_GRID_RADIUS; x <= CHAO3_GRID_RADIUS; x += 1) {
    const key = gridKey(x, y);
    if (!isInsideGeneratedGrid(x, y)) continue;
    if (SPECIAL_GRID_MAP_IDS[key]) continue;
    if (key === '0,1' || key === '1,0' || key === '0,-1') continue;

    generatedChao3GridMaps.push(createLayeredGridMap(x, y));
  }
}

export const chao3GridMaps = [
  chao3NorthwestMap,
  chao3NortheastMap,
  chao3SoutheastMap,
  chao3SouthwestMap,
  ...generatedChao3GridMaps,
];
