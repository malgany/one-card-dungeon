import { openRoadMap } from './open-road.js';
import { stoneGroveMap } from './stone-grove.js';

export const START_WORLD_MAP_ID = openRoadMap.id;

export const WORLD_MAPS = {
  [openRoadMap.id]: openRoadMap,
  [stoneGroveMap.id]: stoneGroveMap,
};

export function getWorldMap(id = START_WORLD_MAP_ID) {
  return WORLD_MAPS[id] || null;
}
