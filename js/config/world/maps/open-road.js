const grassBlockCells = [
  [4, 2], [5, 2], [6, 2], [11, 2], [12, 2],
  [4, 3], [12, 3], [15, 3],
  [1, 4], [2, 4], [8, 4], [9, 4], [15, 4],
  [8, 5], [15, 5], [16, 5],
  [5, 7], [6, 7], [7, 7], [12, 7],
  [12, 8], [3, 9], [12, 9],
  [3, 10], [9, 10], [10, 10], [11, 10],
  [3, 11], [15, 11], [16, 11],
];

const stoneRoadCells = [
  [16, 9], [17, 9], [18, 9], [19, 9],
  [16, 10], [17, 10], [18, 10], [19, 10],
];

export const openRoadMap = {
  id: 'open-road',
  name: 'Estrada aberta',
  size: { width: 20, height: 20 },
  playerStart: { x: 5, y: 15 },
  biome: 'meadow',
  defaultTerrain: 'grass',
  terrainPatches: [
    { terrain: 'stone', cells: stoneRoadCells },
  ],
  objects: grassBlockCells.map(([x, y], index) => {
    return { id: `open-road-grass-${index}`, type: 'grass-block', x, y };
  }),
  encounters: [
    { id: 'nest-a-0', type: 'spider', x: 7, y: 9, groupId: 'nest-a' },
    { id: 'nest-a-1', type: 'spider', x: 8, y: 9, groupId: 'nest-a' },
    { id: 'ruins-b-0', type: 'skeleton', x: 13, y: 4, groupId: 'ruins-b' },
    { id: 'ruins-b-1', type: 'archer', x: 14, y: 4, groupId: 'ruins-b' },
    { id: 'stone-c-0', type: 'golem', x: 14, y: 10, groupId: 'stone-c' },
    { id: 'grave-h-0', type: 'specter', x: 15, y: 15, groupId: 'grave-h' },
    { id: 'ruins-j-0', type: 'skeleton', x: 5, y: 5, groupId: 'ruins-j' },
  ],
  connections: [
    {
      id: 'open-road-east',
      x: 19,
      y: 10,
      targetMapId: 'stone-grove',
      spawn: { x: 0, y: 10 },
    },
  ],
};
