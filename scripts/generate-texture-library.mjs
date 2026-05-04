import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const texturesRoot = path.resolve(root, 'assets', 'textures');
const outputPath = path.resolve(root, 'js', 'config', 'world', 'texture-library.js');
const textureExtensions = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function textureId(parts) {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function collectTextureFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTextureFiles(absolutePath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!textureExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    files.push(absolutePath);
  }

  return files;
}

function textureItem(absolutePath) {
  const relativePath = toPosixPath(path.relative(texturesRoot, absolutePath));
  const relativeParts = relativePath.split('/');
  const pathParts = ['textures', ...relativeParts];
  const folderParts = pathParts.slice(0, -1);

  return {
    id: textureId(pathParts),
    name: relativeParts.at(-1),
    path: pathParts,
    folder: folderParts.join('/'),
    url: `./assets/textures/${relativePath}`,
  };
}

function serializeLibrary(items) {
  const lines = [
    '// Generated from assets/textures. Runtime URLs point at public/assets after asset sync.',
    'export const TEXTURE_LIBRARY = [',
  ];

  items.forEach((item, index) => {
    const serialized = JSON.stringify(item, null, 2)
      .split('\n')
      .map((line) => `  ${line}`);
    if (index < items.length - 1) serialized[serialized.length - 1] += ',';
    lines.push(...serialized);
  });

  lines.push('];', '');
  return lines.join('\n');
}

async function main() {
  const files = await collectTextureFiles(texturesRoot);
  const items = files
    .map(textureItem)
    .sort((a, b) => a.url.localeCompare(b.url));

  await writeFile(outputPath, serializeLibrary(items), 'utf8');
}

main().catch((error) => {
  console.error('Failed to generate texture library.');
  console.error(error);
  process.exitCode = 1;
});
