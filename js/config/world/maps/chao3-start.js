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

function createChao3GridMap({
  id,
  name,
  gridPosition,
  playerStart,
  defaultTerrain = baseChao3Map.defaultTerrain,
  objects = baseChao3Map.objects,
  connections = [],
  encounters = [],
  randomEncounters = true,
}) {
  return {
    ...baseChao3Map,
    id,
    name,
    gridPosition,
    defaultTerrain,
    playerStart: playerStart || baseChao3Map.playerStart,
    objects,
    encounters,
    randomEncounters,
    connections,
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
  connections: [
    {
      id: 'chao3-grid-0-1-back',
      ...GRID_EXITS.lowerLeft,
      targetMapId: 'chao3-start',
      spawn: GRID_EXITS.upperRight,
    },
  ],
});

const chao3SoutheastMap = createChao3GridMap({
  id: 'chao3-grid-1-0',
  name: 'Campo novo 1,0',
  gridPosition: { x: 1, y: 0 },
  playerStart: GRID_EXITS.upperLeft,
  connections: [
    {
      id: 'chao3-grid-1-0-back',
      ...GRID_EXITS.upperLeft,
      targetMapId: 'chao3-start',
      spawn: GRID_EXITS.lowerRight,
    },
    {
      id: 'chao3-grid-1-0-open-road',
      ...GRID_EXITS.lowerRight,
      targetMapId: 'open-road',
      spawn: GRID_EXITS.upperLeft,
    },
  ],
});

const chao3SouthwestMap = createChao3GridMap({
  id: 'chao3-grid-0--1',
  name: 'Campo novo 0,-1',
  gridPosition: { x: 0, y: -1 },
  playerStart: GRID_EXITS.upperRight,
  connections: [
    {
      id: 'chao3-grid-0--1-back',
      ...GRID_EXITS.upperRight,
      targetMapId: 'chao3-start',
      spawn: GRID_EXITS.lowerLeft,
    },
  ],
});

export const chao3GridMaps = [
  chao3NorthwestMap,
  chao3NortheastMap,
  chao3SoutheastMap,
  chao3SouthwestMap,
];
