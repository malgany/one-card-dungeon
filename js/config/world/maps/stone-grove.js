const stoneCells = [
  [3, 3], [4, 3], [5, 3],
  [2, 6], [3, 6],
  [6, 8], [7, 8], [8, 8],
];

export const stoneGroveMap = {
  id: 'stone-grove',
  name: 'Bosque de pedra',
  size: { width: 10, height: 10 },
  playerStart: { x: 0, y: 5 },
  biome: 'stonefields',
  defaultTerrain: 'stone',
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
      return { id: `stone-grove-rock-${index}`, type: 'stone', x, y };
    }),
    { id: 'stone-grove-stump-0', type: 'stump', x: 3, y: 7 },
    { id: 'stone-grove-well-0', type: 'well', x: 7, y: 4 },
  ],
  encounters: [
    { id: 'stone-grove-watch-0', type: 'skeleton', x: 8, y: 2, groupId: 'stone-grove-watch' },
  ],
  connections: [
    {
      id: 'stone-grove-west',
      x: 0,
      y: 5,
      targetMapId: 'open-road',
      spawn: { x: 8, y: 5 },
    },
  ],
};
