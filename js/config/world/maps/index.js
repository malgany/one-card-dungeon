import { chao3StartMap } from './chao3-start.js';
import { AUTHORED_WORLD_MAPS } from './authored.js';
import {
  DEBUG_DELETED_WORLD_MAP_IDS,
  DEBUG_GENERATED_WORLD_MAPS,
  DEBUG_WORLD_MAP_CONNECTION_PATCHES,
} from './debug-generated.js';

export const START_WORLD_MAP_ID = chao3StartMap.id;

const deletedWorldMapIds = new Set(DEBUG_DELETED_WORLD_MAP_IDS);
const authoredWorldMaps = Object.fromEntries(
  Object.entries(AUTHORED_WORLD_MAPS).filter(([mapId]) => !deletedWorldMapIds.has(mapId)),
);
const generatedWorldMaps = Object.fromEntries(DEBUG_GENERATED_WORLD_MAPS.map((map) => [map.id, map]));

export const WORLD_MAPS = {
  ...authoredWorldMaps,
  ...generatedWorldMaps,
};

Object.entries(DEBUG_WORLD_MAP_CONNECTION_PATCHES).forEach(([mapId, connections]) => {
  if (!WORLD_MAPS[mapId]) return;
  WORLD_MAPS[mapId] = {
    ...WORLD_MAPS[mapId],
    connections,
  };
});

export function getWorldMap(id = START_WORLD_MAP_ID) {
  return WORLD_MAPS[id] || null;
}
