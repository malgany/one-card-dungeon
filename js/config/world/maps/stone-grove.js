const stoneCells = [
  [4, 4], [5, 4], [6, 4],
  [10, 6], [11, 6],
  [8, 11], [9, 11], [10, 11],
  [14, 13], [15, 13],
];

export const stoneGroveMap = {
  id: 'stone-grove',
  name: 'Bosque de pedra',
  size: { width: 20, height: 20 },
  playerStart: { x: 0, y: 10 },
  biome: 'stonefields',
  defaultTerrain: 'stone',
  terrainPatches: [
    {
      terrain: 'grass',
      cells: [
        [0, 9], [1, 9], [0, 10], [1, 10], [0, 11], [1, 11],
        [6, 14], [7, 14], [6, 15], [7, 15],
      ],
    },
  ],
  objects: [
    ...stoneCells.map(([x, y], index) => {
      return { id: `stone-grove-rock-${index}`, type: 'stone', x, y };
    }),
    { id: 'stone-grove-stump-0', type: 'stump', x: 3, y: 10 },
    { id: 'stone-grove-well-0', type: 'well', x: 12, y: 9 },
  ],
  encounters: [
    { id: 'stone-grove-watch-0', type: 'skeleton', x: 13, y: 8, groupId: 'stone-grove-watch' },
    { id: 'stone-grove-watch-1', type: 'archer', x: 14, y: 8, groupId: 'stone-grove-watch' },
  ],
  connections: [
    {
      id: 'stone-grove-west',
      x: 0,
      y: 10,
      targetMapId: 'open-road',
      spawn: { x: 18, y: 10 },
    },
  ],
};
