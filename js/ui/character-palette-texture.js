import * as THREE from 'three';
import {
  CHARACTER_TEXTURE_ATLAS,
  getDefaultPaletteSlots,
  normalizeCharacterPalette,
  normalizePaletteSlots,
  paletteSignature,
  parsePaletteSlotId,
} from '../config/character-palettes.js';

const imageCache = new Map();
const textureCache = new Map();

function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Nao foi possivel carregar a textura ${src}.`));
      image.src = src;
    }));
  }

  return imageCache.get(src);
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function configureCharacterTexture(texture) {
  if (!texture) return texture;

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 1;
  texture.needsUpdate = true;
  return texture;
}

function recolorSlot(ctx, slotId, targetHex) {
  const slot = parsePaletteSlotId(slotId);
  if (!slot) return;

  const { cellSize } = CHARACTER_TEXTURE_ATLAS;
  const target = hexToRgb(targetHex);
  const x = slot.column * cellSize;
  const y = slot.row * cellSize;
  const imageData = ctx.getImageData(x, y, cellSize, cellSize);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;

    data[index] = target.r;
    data[index + 1] = target.g;
    data[index + 2] = target.b;
  }

  ctx.putImageData(imageData, x, y);
}

function slotOverrideSignature(typeId, slotOverrides) {
  const normalized = normalizePaletteSlots(typeId, slotOverrides, { pruneDefaults: false });
  const parts = Object.entries(normalized)
    .sort(([slotA], [slotB]) => slotA.localeCompare(slotB))
    .map(([slotId, color]) => `${slotId}:${color}`);

  return {
    normalized,
    signature: parts.length > 0 ? parts.join('|') : 'none',
  };
}

export async function loadCharacterPaletteTexture({ typeId, textureUrl, palette, slotOverrides = null }) {
  const defaultSlots = normalizePaletteSlots(typeId, getDefaultPaletteSlots(typeId), { pruneDefaults: false });
  const normalized = normalizeCharacterPalette(typeId, palette);
  const overrides = slotOverrideSignature(typeId, slotOverrides);
  if (
    Object.keys(defaultSlots).length === 0 &&
    Object.keys(normalized.slots).length === 0 &&
    Object.keys(overrides.normalized).length === 0
  ) {
    return null;
  }

  const defaultSignature = Object.entries(defaultSlots)
    .sort(([slotA], [slotB]) => slotA.localeCompare(slotB))
    .map(([slotId, color]) => `${slotId}:${color}`)
    .join('|');
  const cacheKey = `${textureUrl}|defaults:${defaultSignature}|${paletteSignature(typeId, normalized)}|overrides:${overrides.signature}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);

  const image = await loadImage(textureUrl);
  const canvas = document.createElement('canvas');
  canvas.width = CHARACTER_TEXTURE_ATLAS.size;
  canvas.height = CHARACTER_TEXTURE_ATLAS.size;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const [slotId, color] of Object.entries({
    ...defaultSlots,
    ...normalized.slots,
    ...overrides.normalized,
  })) {
    recolorSlot(ctx, slotId, color);
  }

  const texture = configureCharacterTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}
