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
  gridPosition: { x: 2, y: 0 },
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
    { id: 'skeleton-minions-0', type: 'skeletonMinion', x: 4, y: 4, groupId: 'skeleton-minions' },
    { id: 'skeleton-warriors-0', type: 'skeletonWarrior', x: 7, y: 3, groupId: 'skeleton-warriors' },
    { id: 'skeleton-mages-0', type: 'skeletonMage', x: 8, y: 6, groupId: 'skeleton-mages' },
  ],
  connections: [
    {
      id: 'open-road-west',
      x: 0,
      y: 4,
      targetMapId: 'chao3-grid-1-0',
      spawn: { x: 9, y: 5 },
    },
    {
      id: 'open-road-east',
      x: 9,
      y: 5,
      targetMapId: 'stone-grove',
      spawn: { x: 0, y: 5 },
    },
  ],
};
