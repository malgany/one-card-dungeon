import { chao3StartMap } from './chao3-start.js';
import { openRoadMap } from './open-road.js';
import { stoneGroveMap } from './stone-grove.js';

export const START_WORLD_MAP_ID = chao3StartMap.id;

export const WORLD_MAPS = {
  [chao3StartMap.id]: chao3StartMap,
  [openRoadMap.id]: openRoadMap,
  [stoneGroveMap.id]: stoneGroveMap,
};

export function getWorldMap(id = START_WORLD_MAP_ID) {
  return WORLD_MAPS[id] || null;
}
