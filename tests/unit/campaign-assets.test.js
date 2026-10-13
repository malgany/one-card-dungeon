import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('imported campaign models', () => {
  it('ships textured, skinned GLBs with every animation used by the game', () => {
    let totalBytes = 0;
    for (const name of ['moss-slime', 'root-guardian', 'eclipse-warden']) {
      const bytes = readFileSync(resolve('assets/models/quaternius-monsters', `${name}.glb`));
      expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      const jsonLength = bytes.readUInt32LE(12);
      const data = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
      expect(data.skins[0].joints.length).toBeGreaterThan(0);
      expect(data.images[0].mimeType).toBe('image/png');
      expect(data.animations.map(a => a.name)).toEqual(expect.arrayContaining(['Idle_A', 'Walking_A', 'Hit_A', 'Hit_B', 'Death_A']));
      for (const view of data.bufferViews) expect((view.byteOffset || 0) + view.byteLength).toBeLessThanOrEqual(data.buffers[0].byteLength);
      totalBytes += bytes.length;
    }
    expect(totalBytes).toBeLessThan(1_500_000);
  });
});
