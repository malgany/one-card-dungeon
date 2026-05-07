import { createChao3GridConnections } from './chao3-start.js';

const stoneCells = [
  [3, 3], [4, 3], [5, 3],
  [2, 6], [3, 6],
  [6, 8], [7, 8], [8, 8],
];

export const stoneGroveMap = {
  id: 'stone-grove',
  name: 'Bosque de pedra',
  size: { width: 10, height: 10 },
  gridPosition: { x: 3, y: 0 },
  playerStart: { x: 0, y: 5 },
  biome: 'stonefields',
  defaultTerrain: 'debugGrass',
  terrainPatches: [
    {
      terrain: 'grass',
      cells: [
        [0, 4], [1, 4], [0, 5], [1, 5], [0, 6], [1, 6],
      ],
    },
  ],
  objects: [
    ...stoneCells.map(([x, y], index) => {
      return { id: `stone-grove-rock-${index}`, type: 'forest-rock', x, y };
    }),
    { id: 'stone-grove-dead-tree-0', type: 'dead-tree', x: 3, y: 7 },
    { id: 'stone-grove-bush-0', type: 'forest-bush', x: 7, y: 4 },
    { id: 'stone-grove-tree-0', type: 'forest-tree', x: 1, y: 8 },
  ],
  encounters: [
    { id: 'skeleton-warrior-watch-0', type: 'skeletonWarrior', x: 8, y: 2, groupId: 'skeleton-warrior-watch' },
  ],
  connections: [
    ...createChao3GridConnections({ x: 3, y: 0 }),
  ],
  enemyLevel: 3,
  dangerDistance: 3,
};
