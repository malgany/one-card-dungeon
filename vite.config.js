import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';

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
            const normalizedValues = {};

            for (const key of MAP_COLOR_KEYS) {
              const color = normalizeHexColor(values[key]);
              if (!color) {
                response.statusCode = 400;
                response.end(`Invalid color for ${key}`);
                return;
              }
              normalizedValues[key] = color;
            }

            const lines = [
              'export const DEFAULT_MAP_COLOR_VALUES = Object.freeze({',
              ...MAP_COLOR_KEYS.map((key) => `  ${key}: '${normalizedValues[key]}',`),
              '});',
              '',
            ];
            const outputPath = path.resolve(server.config.root, 'js/config/map-colors.js');
            await writeFile(outputPath, lines.join('\n'), 'utf8');
            server.ws.send({ type: 'full-reload' });

            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ ok: true }));
          } catch (error) {
            response.statusCode = 500;
            response.end(error instanceof Error ? error.message : 'Unknown error');
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [mapColorsDebugPlugin()],
});
