const grassBlockCells = [
  [1, 1], [2, 1], [3, 1], [7, 1], [8, 1],
  [1, 2], [8, 2],
  [1, 3], [4, 3], [5, 3], [8, 3],
  [1, 7], [8, 7],
  [1, 8], [4, 8], [5, 8], [8, 8],
];

const stoneRoadCells = [
  [8, 5], [9, 5],
];

export const openRoadMap = {
  id: 'open-road',
  name: 'Estrada aberta',
  size: { width: 10, height: 10 },
  playerStart: { x: 2, y: 8 },
  biome: 'meadow',
  defaultTerrain: 'grass',
  terrainPatches: [
    { terrain: 'stone', cells: stoneRoadCells },
  ],
  objects: [
    ...grassBlockCells.map(([x, y], index) => {
      return { id: `open-road-grass-${index}`, type: 'grass-block', x, y };
    }),
  ],
  encounters: [
    { id: 'nest-a-0', type: 'spider', x: 4, y: 4, groupId: 'nest-a' },
    { id: 'ruins-b-0', type: 'skeleton', x: 7, y: 3, groupId: 'ruins-b' },
    { id: 'stone-c-0', type: 'golem', x: 8, y: 6, groupId: 'stone-c' },
  ],
  connections: [
    {
      id: 'open-road-east',
      x: 9,
      y: 5,
      targetMapId: 'stone-grove',
      spawn: { x: 0, y: 5 },
    },
  ],
};
