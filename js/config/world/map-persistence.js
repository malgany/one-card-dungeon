function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return /^[a-z0-9:_-]+$/i.test(id) ? id : null;
}

function finiteInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function quote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function objectKeyOrder(map) {
  const position = map.gridPosition || {};
  return `${String(position.x).padStart(8, '0')}:${String(position.y).padStart(8, '0')}:${map.id}`;
}

function cloneCell(cell, fieldName) {
  if (!isPlainObject(cell)) throw new Error(`Invalid ${fieldName}`);
  const x = finiteInteger(cell.x);
  const y = finiteInteger(cell.y);
  if (x === null || y === null) throw new Error(`Invalid ${fieldName}`);
  return { x, y };
}

function normalizeConnection(connection, mapId, knownIds, index) {
  if (!isPlainObject(connection)) throw new Error(`Invalid connection in ${mapId}`);
  const targetMapId = normalizeId(connection.targetMapId);
  if (!targetMapId || !knownIds.has(targetMapId)) {
    throw new Error(`Invalid connection target in ${mapId}`);
  }

  const x = finiteInteger(connection.x);
  const y = finiteInteger(connection.y);
  if (x === null || y === null) throw new Error(`Invalid connection cell in ${mapId}`);

  return {
    id: normalizeId(connection.id) || `${mapId}-${targetMapId}-${index}`,
    x,
    y,
    targetMapId,
    spawn: cloneCell(connection.spawn, `spawn in ${mapId}`),
  };
}

function normalizeMap(rawMap, knownIds) {
  if (!isPlainObject(rawMap)) throw new Error('Invalid map');
  const id = normalizeId(rawMap.id);
  if (!id) throw new Error('Map without valid id');

  const name = typeof rawMap.name === 'string' && rawMap.name.trim() ? rawMap.name.trim() : null;
  const defaultTerrain = normalizeId(rawMap.defaultTerrain);
  const biome = normalizeId(rawMap.biome) || 'meadow';
  if (!name || !defaultTerrain) throw new Error(`Invalid map ${id}`);

  const width = finiteInteger(rawMap.size?.width);
  const height = finiteInteger(rawMap.size?.height);
  if (!width || !height || width < 1 || height < 1) throw new Error(`Invalid size in ${id}`);

  const gridPosition = cloneCell(rawMap.gridPosition, `gridPosition in ${id}`);
  const playerStart = cloneCell(rawMap.playerStart, `playerStart in ${id}`);
  const terrainPatches = Array.isArray(rawMap.terrainPatches) ? rawMap.terrainPatches : [];
  const objects = Array.isArray(rawMap.objects) ? rawMap.objects : [];
  const encounters = Array.isArray(rawMap.encounters) ? rawMap.encounters : [];
  const connections = (Array.isArray(rawMap.connections) ? rawMap.connections : [])
    .map((connection, index) => normalizeConnection(connection, id, knownIds, index))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    id,
    name,
    size: { width, height },
    gridPosition,
    playerStart,
    biome,
    defaultTerrain,
    terrainPatches,
    objects,
    encounters,
    randomEncounters: rawMap.randomEncounters !== false,
    debugGenerated: rawMap.debugGenerated === true,
    sourceMapId: normalizeId(rawMap.sourceMapId),
    createdFromDirection: normalizeId(rawMap.createdFromDirection),
    connections,
  };
}

function connectionSignature(connections = []) {
  return JSON.stringify((connections || []).map((connection) => ({
    id: connection.id,
    x: connection.x,
    y: connection.y,
    targetMapId: connection.targetMapId,
    spawn: connection.spawn,
  })).sort((a, b) => a.id.localeCompare(b.id)));
}

function neighborIds(mapId, maps) {
  const neighbors = new Set();
  Object.values(maps).forEach((map) => {
    for (const connection of map.connections || []) {
      if (!maps[connection.targetMapId]) continue;
      if (map.id === mapId) neighbors.add(connection.targetMapId);
      if (connection.targetMapId === mapId) neighbors.add(map.id);
    }
  });
  return [...neighbors];
}

function reachableIds(startMapId, maps) {
  const reached = new Set();
  const stack = [startMapId];
  while (stack.length > 0) {
    const mapId = stack.pop();
    if (!mapId || reached.has(mapId) || !maps[mapId]) continue;
    reached.add(mapId);
    neighborIds(mapId, maps).forEach((neighborId) => stack.push(neighborId));
  }
  return reached;
}

export function buildWorldMapPersistenceSnapshot({
  maps = [],
  authoredMaps = {},
  startMapId,
} = {}) {
  const authoredMapIds = new Set(Object.keys(authoredMaps));
  const rawMaps = Array.isArray(maps) ? maps : [];
  const knownIds = new Set();

  for (const rawMap of rawMaps) {
    const id = normalizeId(rawMap?.id);
    if (!id) throw new Error('Map without valid id');
    if (knownIds.has(id)) throw new Error(`Duplicate map id ${id}`);
    knownIds.add(id);
  }

  const normalizedMaps = rawMaps.map((map) => normalizeMap(map, knownIds));
  const gridKeys = new Set();
  normalizedMaps.forEach((map) => {
    const key = `${map.gridPosition.x},${map.gridPosition.y}`;
    if (gridKeys.has(key)) throw new Error(`Duplicate grid position ${key}`);
    gridKeys.add(key);
  });

  const normalizedMapById = Object.fromEntries(normalizedMaps.map((map) => [map.id, map]));
  if (!normalizedMapById[startMapId]) throw new Error('Start map cannot be removed');

  const reached = reachableIds(startMapId, normalizedMapById);
  const unreachable = normalizedMaps.find((map) => !reached.has(map.id));
  if (unreachable) throw new Error(`Map ${unreachable.id} is disconnected`);

  const generatedMaps = normalizedMaps
    .filter((map) => map.debugGenerated)
    .sort((a, b) => objectKeyOrder(a).localeCompare(objectKeyOrder(b)));
  const deletedAuthoredMapIds = [...authoredMapIds]
    .filter((mapId) => mapId !== startMapId && !normalizedMapById[mapId])
    .sort((a, b) => a.localeCompare(b));

  const authoredConnectionPatches = {};
  normalizedMaps
    .filter((map) => authoredMapIds.has(map.id))
    .forEach((map) => {
      const original = authoredMaps[map.id];
      if (connectionSignature(map.connections) !== connectionSignature(original?.connections || [])) {
        authoredConnectionPatches[map.id] = map.connections;
      }
    });

  return {
    generatedMaps,
    deletedAuthoredMapIds,
    authoredConnectionPatches,
    worldMapIds: normalizedMaps.map((map) => map.id).sort((a, b) => a.localeCompare(b)),
  };
}

function serializeCell(cell) {
  return `{ x: ${cell.x}, y: ${cell.y} }`;
}

function serializeConnection(connection, indent = '      ') {
  return [
    `${indent}{`,
    `${indent}  id: ${quote(connection.id)},`,
    `${indent}  x: ${connection.x},`,
    `${indent}  y: ${connection.y},`,
    `${indent}  targetMapId: ${quote(connection.targetMapId)},`,
    `${indent}  spawn: ${serializeCell(connection.spawn)},`,
    `${indent}},`,
  ];
}

function serializeMap(map) {
  const lines = [
    '  Object.freeze({',
    `    id: ${quote(map.id)},`,
    `    name: ${quote(map.name)},`,
    `    size: { width: ${map.size.width}, height: ${map.size.height} },`,
    `    gridPosition: ${serializeCell(map.gridPosition)},`,
    `    playerStart: ${serializeCell(map.playerStart)},`,
    `    biome: ${quote(map.biome)},`,
    `    defaultTerrain: ${quote(map.defaultTerrain)},`,
    '    terrainPatches: [],',
    '    objects: [],',
    '    encounters: [],',
    `    randomEncounters: ${map.randomEncounters !== false},`,
    '    debugGenerated: true,',
  ];

  if (map.sourceMapId) lines.push(`    sourceMapId: ${quote(map.sourceMapId)},`);
  if (map.createdFromDirection) lines.push(`    createdFromDirection: ${quote(map.createdFromDirection)},`);

  lines.push('    connections: [');
  map.connections.forEach((connection) => lines.push(...serializeConnection(connection)));
  lines.push('    ],');
  lines.push('  }),');
  return lines;
}

export function serializeDebugGeneratedWorldMaps({
  generatedMaps = [],
  deletedAuthoredMapIds = [],
  authoredConnectionPatches = {},
} = {}) {
  const mapLines = generatedMaps.flatMap((map) => serializeMap(map));
  const deletedIds = [...deletedAuthoredMapIds].sort((a, b) => a.localeCompare(b));
  const patchIds = Object.keys(authoredConnectionPatches).sort((a, b) => a.localeCompare(b));

  return [
    'export const DEBUG_GENERATED_WORLD_MAPS = Object.freeze([',
    ...mapLines,
    ']);',
    '',
    'export const DEBUG_DELETED_WORLD_MAP_IDS = Object.freeze([',
    ...deletedIds.map((id) => `  ${quote(id)},`),
    ']);',
    '',
    'export const DEBUG_WORLD_MAP_CONNECTION_PATCHES = Object.freeze({',
    ...patchIds.flatMap((mapId) => [
      `  ${quote(mapId)}: [`,
      ...authoredConnectionPatches[mapId].flatMap((connection) => serializeConnection(connection, '    ')),
      '  ],',
    ]),
    '});',
    '',
  ].join('\n');
}

export function pruneMapValuesByMap(mapValuesByMap = {}, existingMapIds = new Set()) {
  return Object.fromEntries(Object.entries(mapValuesByMap).filter(([mapId]) => existingMapIds.has(mapId)));
}
