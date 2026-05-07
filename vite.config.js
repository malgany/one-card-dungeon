import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import {
  buildWorldMapPersistenceSnapshot,
  pruneMapValuesByMap,
  serializeDebugGeneratedWorldMaps,
} from './js/config/world/map-persistence.js';
import { AUTHORED_WORLD_MAPS } from './js/config/world/maps/authored.js';
import { START_WORLD_MAP_ID } from './js/config/world/maps/index.js';

const MAP_COLOR_KEYS = [
  'water1',
  'water2',
  'water3',
  'top1',
  'top2',
  'top3',
  'top4',
  'top5',
  'side1',
  'side2',
  'side3',
  'side4',
  'side5',
];

const VISUAL_SETTINGS_SCHEMA = {
  exposure: { type: 'number', default: 1.0, min: 0.1, max: 3.0 },
  ambientIntensity: { type: 'number', default: 1.05, min: 0, max: 3.0 },
  keyIntensity: { type: 'number', default: 1.75, min: 0, max: 5.0 },
  keyLightDirectionDeg: { type: 'number', default: 84, min: 0, max: 360 },
  fogDensity: { type: 'number', default: 0.0, min: 0, max: 0.1 },
  shadowMapEnabled: { type: 'boolean', default: true },
  showOutlines: { type: 'boolean', default: false },
  showGrid: { type: 'boolean', default: false },
  overworldOrthographicCamera: { type: 'boolean', default: true },
  overworldWater: { type: 'boolean', default: true },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHexColor(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}

function normalizeMapColorValues(values, fallback = {}) {
  const normalizedValues = {};
  for (const key of MAP_COLOR_KEYS) {
    normalizedValues[key] = normalizeHexColor(values?.[key]) || normalizeHexColor(fallback?.[key]) || '#ffffff';
  }
  return normalizedValues;
}

function normalizeMapId(value) {
  if (typeof value !== 'string') return null;
  const mapId = value.trim();
  return /^[a-z0-9:_-]+$/i.test(mapId) ? mapId : null;
}

function normalizeColorModelId(value) {
  if (typeof value !== 'string') return null;
  const modelId = value.trim();
  return /^[a-z0-9:_-]+$/i.test(modelId) ? modelId : null;
}

function normalizeColorModelLabel(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const label = value.trim();
  return label ? label.slice(0, 18) : fallback;
}

function normalizeColorModels(models = [], defaultValues = {}) {
  if (!Array.isArray(models)) return [];

  return models.map((model, index) => {
    if (!model || typeof model !== 'object') return null;
    return {
      id: normalizeColorModelId(model.id) || `model-${index + 1}`,
      label: normalizeColorModelLabel(model.label, `Modelo ${index + 1}`),
      values: normalizeMapColorValues(model.values, defaultValues),
    };
  }).filter(Boolean);
}

function normalizeVisualSettings(values = {}) {
  const normalized = {};

  for (const [key, schema] of Object.entries(VISUAL_SETTINGS_SCHEMA)) {
    if (schema.type === 'boolean') {
      normalized[key] = typeof values?.[key] === 'boolean' ? values[key] : schema.default;
      continue;
    }

    const value = Number(values?.[key]);
    normalized[key] = Number.isFinite(value) ? clamp(value, schema.min, schema.max) : schema.default;
  }

  return normalized;
}

async function readMapColorsConfig(outputPath) {
  try {
    const moduleUrl = `${pathToFileURL(outputPath).href}?t=${Date.now()}`;
    const module = await import(moduleUrl);
    const defaultValues = normalizeMapColorValues(module.DEFAULT_MAP_COLOR_VALUES);
    const mapValuesByMap = {};

    for (const [mapId, values] of Object.entries(module.MAP_COLOR_VALUES_BY_MAP || {})) {
      if (!normalizeMapId(mapId)) continue;
      mapValuesByMap[mapId] = normalizeMapColorValues(values, defaultValues);
    }

    return {
      defaultValues,
      defaultColorModels: normalizeColorModels(module.DEFAULT_MAP_COLOR_MODELS, defaultValues),
      mapValuesByMap,
    };
  } catch {
    return {
      defaultValues: Object.fromEntries(MAP_COLOR_KEYS.map((key) => [key, '#ffffff'])),
      defaultColorModels: [],
      mapValuesByMap: {},
    };
  }
}

async function readVisualSettingsConfig(outputPath) {
  try {
    const moduleUrl = `${pathToFileURL(outputPath).href}?t=${Date.now()}`;
    const module = await import(moduleUrl);
    const defaultValues = normalizeVisualSettings(module.DEFAULT_VISUAL_SETTINGS);
    const mapValuesByMap = {};

    for (const [mapId, values] of Object.entries(module.MAP_VISUAL_SETTINGS_BY_MAP || {})) {
      if (!normalizeMapId(mapId)) continue;
      mapValuesByMap[mapId] = normalizeVisualSettings({ ...defaultValues, ...values });
    }

    return { defaultValues, mapValuesByMap };
  } catch {
    return { defaultValues: normalizeVisualSettings(), mapValuesByMap: {} };
  }
}

function mapColorLines(values, indent = '  ') {
  return MAP_COLOR_KEYS.map((key) => `${indent}${key}: '${values[key]}',`);
}

function quotedString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function visualSettingsLines(values, indent = '  ') {
  return Object.keys(VISUAL_SETTINGS_SCHEMA).map((key) => `${indent}${key}: ${values[key]},`);
}

function serializeMapColorsConfig({ defaultValues, defaultColorModels = [], mapValuesByMap }) {
  const mapIds = Object.keys(mapValuesByMap).sort((a, b) => a.localeCompare(b));
  const lines = [
    'export const DEFAULT_MAP_COLOR_VALUES = Object.freeze({',
    ...mapColorLines(defaultValues),
    '});',
    '',
    'export const DEFAULT_MAP_COLOR_MODELS = Object.freeze([',
  ];

  for (const model of defaultColorModels) {
    lines.push('  Object.freeze({');
    lines.push(`    id: ${quotedString(model.id)},`);
    lines.push(`    label: ${quotedString(model.label)},`);
    lines.push('    values: Object.freeze({');
    lines.push(...mapColorLines(model.values, '      '));
    lines.push('    }),');
    lines.push('  }),');
  }

  lines.push(
    ']);',
    '',
    'export const MAP_COLOR_VALUES_BY_MAP = Object.freeze({',
  );

  for (const mapId of mapIds) {
    lines.push(`  '${mapId}': Object.freeze({`);
    lines.push(...mapColorLines(mapValuesByMap[mapId], '    '));
    lines.push('  }),');
  }

  lines.push(
    '});',
    '',
    'export function normalizeMapColorValues(values = {}, fallback = DEFAULT_MAP_COLOR_VALUES) {',
    '  return Object.fromEntries(Object.entries(DEFAULT_MAP_COLOR_VALUES).map(([key, defaultColor]) => {',
    '    const value = values?.[key] || fallback?.[key] || defaultColor;',
    "    return [key, /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : defaultColor];",
    '  }));',
    '}',
    '',
    'export function getDefaultNewMapColorValues() {',
    '  return normalizeMapColorValues(DEFAULT_MAP_COLOR_MODELS[0]?.values || DEFAULT_MAP_COLOR_VALUES);',
    '}',
    '',
    'export function getMapColorValuesForMap(mapId) {',
    '  return normalizeMapColorValues(MAP_COLOR_VALUES_BY_MAP[mapId], getDefaultNewMapColorValues());',
    '}',
    '',
  );

  return lines.join('\n');
}

function serializeVisualSettingsConfig({ defaultValues, mapValuesByMap = {} }) {
  const mapIds = Object.keys(mapValuesByMap).sort((a, b) => a.localeCompare(b));
  return [
    'export const DEFAULT_VISUAL_SETTINGS = Object.freeze({',
    ...visualSettingsLines(normalizeVisualSettings(defaultValues)),
    '});',
    '',
    'export const MAP_VISUAL_SETTINGS_BY_MAP = Object.freeze({',
    ...mapIds.flatMap((mapId) => [
      `  '${mapId}': Object.freeze({`,
      `    overworldWater: ${mapValuesByMap[mapId].overworldWater},`,
      '  }),',
    ]),
    '});',
    '',
    'export function getOverworldWaterEnabled({ mapId = null, baseValues = DEFAULT_VISUAL_SETTINGS, runtimeValues = null } = {}) {',
    "  if (typeof runtimeValues?.overworldWater === 'boolean') return runtimeValues.overworldWater;",
    '  const mapValues = mapId ? MAP_VISUAL_SETTINGS_BY_MAP[mapId] : null;',
    "  if (typeof mapValues?.overworldWater === 'boolean') return mapValues.overworldWater;",
    '  return baseValues?.overworldWater !== false;',
    '}',
    '',
  ].join('\n');
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('error', reject);
    request.on('end', () => resolve(body));
  });
}

function mapColorsDebugPlugin() {
  return {
    name: 'one-rpg-map-colors-debug',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__debug/map-colors', (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }

        let body = '';
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const values = payload?.values || {};
            const mapId = normalizeMapId(payload?.mapId);
            if (!mapId) {
              response.statusCode = 400;
              response.end('Invalid mapId');
              return;
            }

            for (const key of MAP_COLOR_KEYS) {
              if (!normalizeHexColor(values[key])) {
                response.statusCode = 400;
                response.end(`Invalid color for ${key}`);
                return;
              }
            }

            const outputPath = path.resolve(server.config.root, 'js/config/map-colors.js');
            const colorConfig = await readMapColorsConfig(outputPath);
            colorConfig.mapValuesByMap[mapId] = normalizeMapColorValues(values, colorConfig.defaultValues);
            await writeFile(outputPath, serializeMapColorsConfig(colorConfig), 'utf8');
            server.ws.send({ type: 'full-reload' });

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ ok: true, mapId }));
          } catch (error) {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : 'Unknown error');
          }
        });
      });

      server.middlewares.use('/__debug/world-maps', (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }

        readRequestBody(request).then(async (body) => {
          try {
            const payload = JSON.parse(body || '{}');
            const snapshot = buildWorldMapPersistenceSnapshot({
              maps: payload?.maps,
              authoredMaps: AUTHORED_WORLD_MAPS,
              startMapId: START_WORLD_MAP_ID,
            });
            const existingMapIds = new Set(snapshot.worldMapIds);

            const debugMapsPath = path.resolve(server.config.root, 'js/config/world/maps/debug-generated.js');
            await writeFile(debugMapsPath, serializeDebugGeneratedWorldMaps(snapshot), 'utf8');

            const colorsPath = path.resolve(server.config.root, 'js/config/map-colors.js');
            const colorConfig = await readMapColorsConfig(colorsPath);
            colorConfig.mapValuesByMap = pruneMapValuesByMap(colorConfig.mapValuesByMap, existingMapIds);
            await writeFile(colorsPath, serializeMapColorsConfig(colorConfig), 'utf8');

            const visualsPath = path.resolve(server.config.root, 'js/config/visual-settings.js');
            const visualConfig = await readVisualSettingsConfig(visualsPath);
            visualConfig.mapValuesByMap = pruneMapValuesByMap(visualConfig.mapValuesByMap, existingMapIds);
            await writeFile(visualsPath, serializeVisualSettingsConfig(visualConfig), 'utf8');

            server.ws.send({ type: 'full-reload' });

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({
              ok: true,
              generatedCount: snapshot.generatedMaps.length,
              deletedAuthoredMapIds: snapshot.deletedAuthoredMapIds,
            }));
          } catch (error) {
            response.statusCode = 400;
            response.end(error instanceof Error ? error.message : 'Invalid world maps payload');
          }
        }).catch((error) => {
          response.statusCode = 500;
          response.end(error instanceof Error ? error.message : 'Unknown error');
        });
      });

      server.middlewares.use('/__debug/visual-settings', (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end('Method not allowed');
          return;
        }

        let body = '';
        request.on('data', (chunk) => {
          body += chunk;
        });
        request.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const values = normalizeVisualSettings(payload?.values || {});
            const mapId = normalizeMapId(payload?.mapId);
            const outputPath = path.resolve(server.config.root, 'js/config/visual-settings.js');
            const visualConfig = await readVisualSettingsConfig(outputPath);
            visualConfig.defaultValues = normalizeVisualSettings({
              ...visualConfig.defaultValues,
              ...values,
              overworldWater: mapId ? visualConfig.defaultValues.overworldWater : values.overworldWater,
            });
            if (mapId) {
              visualConfig.mapValuesByMap[mapId] = normalizeVisualSettings({
                ...visualConfig.defaultValues,
                ...visualConfig.mapValuesByMap[mapId],
                overworldWater: values.overworldWater,
              });
            }
            await writeFile(outputPath, serializeVisualSettingsConfig(visualConfig), 'utf8');
            server.ws.send({ type: 'full-reload' });

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ ok: true, mapId, values }));
          } catch (error) {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : 'Unknown error');
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const debugEnabled = env.VITE_ONE_RPG_DEBUG === 'true';

  return {
    plugins: debugEnabled ? [mapColorsDebugPlugin()] : [],
  };
});
