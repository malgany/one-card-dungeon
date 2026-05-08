import { WORLD_OBJECT_TYPES, getWorldMap } from '../config/world/index.js';

function keyFor(x, y) {
  return `${x},${y}`;
}

export function getCurrentWorldMap(overworld) {
  return getWorldMap(overworld?.currentMapId || overworld?.mapId);
}

export function getCurrentWorldMapState(overworld) {
  const mapId = overworld?.currentMapId || overworld?.mapId;
  if (!mapId) return null;
  return overworld?.mapStates?.[mapId] || null;
}

export function getCurrentWorldBounds(overworld) {
  const map = getCurrentWorldMap(overworld);

  return {
    width: map?.size?.width || overworld?.width || 20,
    height: map?.size?.height || overworld?.height || 20,
  };
}

export function getCurrentWorldEnemies(overworld) {
  return getCurrentWorldMapState(overworld)?.enemies || overworld?.enemies || [];
}

export function getCurrentWorldPickups(overworld) {
  return getCurrentWorldMapState(overworld)?.pickups || [];
}

export function getCurrentWorldObjects(overworld) {
  const map = getCurrentWorldMap(overworld);
  const mapState = getCurrentWorldMapState(overworld);
  const removedIds = new Set(mapState?.removedObjectIds || []);

  return (map?.objects || []).filter((object) => !removedIds.has(object.id));
}

function getWorldObjectType(object) {
  return WORLD_OBJECT_TYPES[object?.type] || null;
}

function getWorldObjectFootprint(object) {
  const type = getWorldObjectType(object);
  return object?.footprint || type?.footprint || [[0, 0]];
}

export function getWorldObjectBlockedKeys(overworld) {
  const blocked = new Set();

  for (const object of getCurrentWorldObjects(overworld)) {
    const type = getWorldObjectType(object);
    if (!type || type.blocksMovement === false) continue;

    for (const [dx, dy] of getWorldObjectFootprint(object)) {
      blocked.add(keyFor(object.x + dx, object.y + dy));
    }
  }

  return blocked;
}

export function getWorldConnectionAt(overworld, cell) {
  const map = getCurrentWorldMap(overworld);
  if (!map || !cell) return null;

  return (map.connections || []).find((connection) => {
    return connection.x === cell.x && connection.y === cell.y;
  }) || null;
}
