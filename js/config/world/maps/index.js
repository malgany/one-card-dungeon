import { CAMPAIGN_START } from './campaign.js';
import { AUTHORED_WORLD_MAPS } from './authored.js';
import {
  DEBUG_DELETED_WORLD_MAP_IDS,
  DEBUG_GENERATED_WORLD_MAPS,
  DEBUG_WORLD_MAP_CONNECTION_PATCHES,
} from './debug-generated.js';

export const START_WORLD_MAP_ID = CAMPAIGN_START;

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

WORLD_MAPS['chao3-grid--1-0'] = { ...WORLD_MAPS['chao3-grid--1-0'], connections: [{ id: 'nursery-to-refuge', x: 9, y: 5, targetMapId: CAMPAIGN_START, spawn: { x: 10, y: 19 } }] };
