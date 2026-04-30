import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const source = resolve(root, 'assets');
const destination = resolve(root, 'public', 'assets');

async function main() {
  await mkdir(dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true, force: true });
}

main().catch((error) => {
  console.error('Failed to sync assets into public/.');
  console.error(error);
  process.exitCode = 1;
});
