import { describe, expect, it } from 'vitest';
import {
  buildWorldMapPersistenceSnapshot,
  pruneMapValuesByMap,
  serializeDebugGeneratedWorldMaps,
} from '../../js/config/world/map-persistence.js';

const startMap = {
  id: 'start',
  name: 'Start',
  size: { width: 10, height: 10 },
  gridPosition: { x: 0, y: 0 },
  playerStart: { x: 2, y: 8 },
  biome: 'meadow',
  defaultTerrain: 'debugGrass',
  terrainPatches: [],
  objects: [],
  encounters: [],
  connections: [],
};

const authoredMaps = {
  start: startMap,
  end: {
    ...startMap,
    id: 'end',
    name: 'End',
    gridPosition: { x: 1, y: 0 },
    playerStart: { x: 0, y: 4 },
    connections: [
      { id: 'end-start', x: 0, y: 4, targetMapId: 'start', spawn: { x: 9, y: 5 } },
    ],
  },
};

describe('world map persistence', () => {
  it('serializes generated maps and authored connection patches deterministically', () => {
    const maps = [
      {
        ...startMap,
        connections: [
          { id: 'start-debug', x: 9, y: 5, targetMapId: 'debug-map-1-0', spawn: { x: 0, y: 4 } },
        ],
      },
      {
        ...startMap,
        id: 'debug-map-1-0',
        name: 'Campo novo 1,0',
        gridPosition: { x: 1, y: 0 },
        playerStart: { x: 0, y: 4 },
        debugGenerated: true,
        sourceMapId: 'start',
        createdFromDirection: 'east',
        connections: [
          { id: 'debug-back', x: 0, y: 4, targetMapId: 'start', spawn: { x: 9, y: 5 } },
        ],
      },
    ];

    const snapshot = buildWorldMapPersistenceSnapshot({ maps, authoredMaps: { start: startMap }, startMapId: 'start' });
    const serialized = serializeDebugGeneratedWorldMaps(snapshot);

    expect(snapshot.generatedMaps).toHaveLength(1);
    expect(snapshot.authoredConnectionPatches.start).toHaveLength(1);
    expect(serialized).toContain('DEBUG_GENERATED_WORLD_MAPS');
    expect(serialized).toContain("id: 'debug-map-1-0'");
    expect(serialized).toContain("'start': [");
  });

  it('records deleted authored endpoints and prunes orphaned settings', () => {
    const snapshot = buildWorldMapPersistenceSnapshot({
      maps: [{ ...startMap }],
      authoredMaps,
      startMapId: 'start',
    });

    expect(snapshot.deletedAuthoredMapIds).toEqual(['end']);
    expect(pruneMapValuesByMap({ start: { color: true }, end: { color: true } }, new Set(snapshot.worldMapIds))).toEqual({
      start: { color: true },
    });
  });

  it('rejects central deletions that disconnect remaining maps', () => {
    const maps = [
      {
        ...startMap,
        connections: [{ id: 'start-middle', x: 9, y: 5, targetMapId: 'middle', spawn: { x: 0, y: 4 } }],
      },
      {
        ...startMap,
        id: 'tail',
        name: 'Tail',
        gridPosition: { x: 2, y: 0 },
        connections: [],
      },
    ];

    expect(() => buildWorldMapPersistenceSnapshot({ maps, authoredMaps: {}, startMapId: 'start' }))
      .toThrow(/Invalid connection target|disconnected/);
  });

  it('rejects connections to missing maps', () => {
    const maps = [
      {
        ...startMap,
        connections: [{ id: 'missing', x: 9, y: 5, targetMapId: 'missing-map', spawn: { x: 0, y: 4 } }],
      },
    ];

    expect(() => buildWorldMapPersistenceSnapshot({ maps, authoredMaps: { start: startMap }, startMapId: 'start' }))
      .toThrow(/Invalid connection target/);
  });
});
