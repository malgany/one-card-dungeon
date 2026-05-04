import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

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

    return { defaultValues, mapValuesByMap };
  } catch {
    return {
      defaultValues: Object.fromEntries(MAP_COLOR_KEYS.map((key) => [key, '#ffffff'])),
      mapValuesByMap: {},
    };
  }
}

function mapColorLines(values, indent = '  ') {
  return MAP_COLOR_KEYS.map((key) => `${indent}${key}: '${values[key]}',`);
}

function serializeMapColorsConfig({ defaultValues, mapValuesByMap }) {
  const mapIds = Object.keys(mapValuesByMap).sort((a, b) => a.localeCompare(b));
  const lines = [
    'export const DEFAULT_MAP_COLOR_VALUES = Object.freeze({',
    ...mapColorLines(defaultValues),
    '});',
    '',
    'export const MAP_COLOR_VALUES_BY_MAP = Object.freeze({',
  ];

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
    'export function getMapColorValuesForMap(mapId) {',
    '  return normalizeMapColorValues(MAP_COLOR_VALUES_BY_MAP[mapId]);',
    '}',
    '',
  );

  return lines.join('\n');
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
