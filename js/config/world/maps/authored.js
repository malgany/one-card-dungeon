import { chao3GridMaps, chao3StartMap } from './chao3-start.js';
import { openRoadMap } from './open-road.js';
import { stoneGroveMap } from './stone-grove.js';

export const AUTHORED_WORLD_MAPS = {
  [chao3StartMap.id]: chao3StartMap,
  ...Object.fromEntries(chao3GridMaps.map((map) => [map.id, map])),
  [openRoadMap.id]: openRoadMap,
  [stoneGroveMap.id]: stoneGroveMap,
};
