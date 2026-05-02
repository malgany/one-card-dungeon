export const CHARACTER_PALETTE_VERSION = 1;

export const CHARACTER_TEXTURE_ATLAS = {
  size: 1024,
  rows: 8,
  columns: 8,
  cellSize: 128,
};

const CHARACTER_DEFINITION_MAP = {
  mage: {
    id: 'mage',
    label: 'Mago',
    image: '/assets/characters/mage.png',
    summary: 'Arcano equilibrado',
    modelUrl: '/assets/models/adventurers/characters/mage.glb',
    textureUrl: '/assets/models/adventurers/textures/mage_texture.png',
    usedSlots: ['r2c0', 'r2c2', 'r2c3', 'r2c7', 'r3c0', 'r3c2', 'r3c3', 'r4c0', 'r4c1', 'r4c2', 'r4c7', 'r5c0', 'r5c1', 'r5c2', 'r5c7', 'r6c0', 'r6c1', 'r6c3', 'r6c4', 'r6c5', 'r7c0', 'r7c1', 'r7c2', 'r7c3', 'r7c4', 'r7c5'],
    paletteGroups: [
      ['r4c0', 'r4c1', 'r5c0', 'r5c1'],
      ['r6c1', 'r7c1'],
      ['r4c2', 'r5c2'],
      ['r6c5', 'r7c5'],
    ],
    defaultSlots: {
      r2c0: '#605B8C',
      r2c2: '#BF1963',
      r2c3: '#9BA7AD',
      r2c7: '#38355C',
      r3c0: '#2E2B4E',
      r3c2: '#891B51',
      r3c3: '#687075',
      r4c0: '#EAEDEF',
      r4c1: '#BF1963',
      r4c2: '#2B7C80',
      r4c7: '#F7C7A5',
      r5c0: '#BFCACE',
      r5c1: '#891B51',
      r5c2: '#325D67',
      r5c7: '#F3B189',
      r6c0: '#FBC05B',
      r6c1: '#D46E31',
      r6c3: '#597B97',
      r6c4: '#F04824',
      r6c5: '#E2BC8D',
      r7c0: '#F79442',
      r7c1: '#944221',
      r7c2: '#BA7835',
      r7c3: '#415D6E',
      r7c4: '#C4112E',
      r7c5: '#D2A06D',
    },
  },
  barbarian: {
    id: 'barbarian',
    label: 'Barbaro',
    image: '/assets/characters/barbarian.png',
    summary: 'Forca bruta',
    modelUrl: '/assets/models/adventurers/characters/barbarian.glb',
    textureUrl: '/assets/models/adventurers/textures/barbarian_texture.png',
    usedSlots: ['r0c1', 'r1c1', 'r2c3', 'r2c7', 'r3c3', 'r3c7', 'r4c0', 'r4c2', 'r4c5', 'r4c6', 'r4c7', 'r5c0', 'r5c2', 'r5c3', 'r5c5', 'r5c6', 'r5c7', 'r6c0', 'r6c1', 'r6c2', 'r6c3', 'r6c6', 'r6c7', 'r7c0', 'r7c1', 'r7c2', 'r7c3', 'r7c6', 'r7c7'],
    defaultSlots: {
      r0c1: '#A29B94',
      r1c1: '#7D726C',
      r2c3: '#9BA7AD',
      r2c7: '#A29B94',
      r3c3: '#687075',
      r3c7: '#7D726C',
      r4c0: '#EAEDEF',
      r4c2: '#597B97',
      r4c5: '#A29B94',
      r4c6: '#C6C6C6',
      r4c7: '#A29B94',
      r5c0: '#BFCACE',
      r5c2: '#415D6E',
      r5c3: '#5C4F48',
      r5c5: '#7D726C',
      r5c6: '#565654',
      r5c7: '#7D726C',
      r6c0: '#C6C6C6',
      r6c1: '#F3E6D9',
      r6c2: '#C6C6C6',
      r6c3: '#C6C6C6',
      r6c6: '#C6C6C6',
      r6c7: '#C6C6C6',
      r7c0: '#565654',
      r7c1: '#DCB58F',
      r7c2: '#565654',
      r7c3: '#565654',
      r7c6: '#565654',
      r7c7: '#565654',
    },
  },
  knight: {
    id: 'knight',
    label: 'Cavaleiro',
    image: '/assets/characters/knight.png',
    summary: 'Defesa firme',
    modelUrl: '/assets/models/adventurers/characters/knight.glb',
    textureUrl: '/assets/models/adventurers/textures/knight_texture.png',
    usedSlots: ['r4c0', 'r4c1', 'r4c2', 'r4c7', 'r5c0', 'r5c1', 'r5c2', 'r5c7', 'r6c0', 'r6c1', 'r6c2', 'r6c3', 'r6c4', 'r6c6', 'r6c7', 'r7c0', 'r7c1', 'r7c2', 'r7c3', 'r7c4', 'r7c6', 'r7c7'],
    defaultSlots: {
      r4c0: '#EAEDEF',
      r4c1: '#A29B94',
      r4c2: '#E95659',
      r4c7: '#C6C6C6',
      r5c0: '#BFCACE',
      r5c1: '#7D726C',
      r5c2: '#A61F33',
      r5c7: '#565654',
      r6c0: '#C6C6C6',
      r6c1: '#C6C6C6',
      r6c2: '#C6C6C6',
      r6c3: '#C6C6C6',
      r6c4: '#C6C6C6',
      r6c6: '#C6C6C6',
      r6c7: '#C6C6C6',
      r7c0: '#565654',
      r7c1: '#565654',
      r7c2: '#565654',
      r7c3: '#565654',
      r7c4: '#565654',
      r7c6: '#565654',
      r7c7: '#565654',
    },
  },
  ranger: {
    id: 'ranger',
    label: 'Patrulheiro',
    image: '/assets/characters/ranger.png',
    summary: 'Ataque a distancia',
    modelUrl: '/assets/models/adventurers/characters/ranger.glb',
    textureUrl: '/assets/models/adventurers/textures/ranger_texture.png',
    usedSlots: ['r2c3', 'r2c7', 'r3c3', 'r3c7', 'r4c0', 'r4c1', 'r4c6', 'r4c7', 'r5c0', 'r5c1', 'r5c5', 'r5c6', 'r5c7', 'r6c0', 'r6c1', 'r6c2', 'r6c3', 'r6c5', 'r6c6', 'r6c7', 'r7c0', 'r7c1', 'r7c2', 'r7c3', 'r7c5', 'r7c6', 'r7c7'],
    defaultSlots: {
      r2c3: '#9BA7AD',
      r2c7: '#7A6A5E',
      r3c3: '#687075',
      r3c7: '#5C4F48',
      r4c0: '#EAEDEF',
      r4c1: '#289ED7',
      r4c6: '#C6C6C6',
      r4c7: '#936A53',
      r5c0: '#BFCACE',
      r5c1: '#215096',
      r5c5: '#7D726C',
      r5c6: '#565654',
      r5c7: '#694B3F',
      r6c0: '#C6C6C6',
      r6c1: '#C6C6C6',
      r6c2: '#C6C6C6',
      r6c3: '#C6C6C6',
      r6c5: '#C6C6C6',
      r6c6: '#C6C6C6',
      r6c7: '#C6C6C6',
      r7c0: '#565654',
      r7c1: '#565654',
      r7c2: '#565654',
      r7c3: '#565654',
      r7c5: '#565654',
      r7c6: '#565654',
      r7c7: '#565654',
    },
  },
  rogue: {
    id: 'rogue',
    label: 'Ladino',
    image: '/assets/characters/rogue.png',
    summary: 'Agil e preciso',
    modelUrl: '/assets/models/adventurers/characters/rogue.glb',
    textureUrl: '/assets/models/adventurers/textures/rogue_texture.png',
    usedSlots: ['r2c3', 'r2c7', 'r3c3', 'r3c7', 'r4c0', 'r4c1', 'r4c7', 'r5c0', 'r5c1', 'r5c7', 'r6c0', 'r6c1', 'r6c3', 'r6c5', 'r6c6', 'r7c0', 'r7c1', 'r7c2', 'r7c3', 'r7c5', 'r7c6'],
    defaultSlots: {
      r2c3: '#9BA7AD',
      r2c7: '#7A6A5E',
      r3c3: '#687075',
      r3c7: '#5C4F48',
      r4c0: '#F3E6D9',
      r4c1: '#009958',
      r4c7: '#A9684D',
      r5c0: '#DCB58F',
      r5c1: '#006E4F',
      r5c7: '#884835',
      r6c0: '#9DCC5B',
      r6c1: '#FFC121',
      r6c3: '#02EAF1',
      r6c5: '#E2BC8D',
      r6c6: '#F7C7A5',
      r7c0: '#359A84',
      r7c1: '#D1560A',
      r7c2: '#7105B2',
      r7c3: '#1071A2',
      r7c5: '#D2A06D',
      r7c6: '#EE9469',
    },
  },
};

export const CHARACTER_DEFINITIONS = Object.freeze(CHARACTER_DEFINITION_MAP);

export const CHARACTER_TYPES = Object.freeze(
  Object.values(CHARACTER_DEFINITIONS).map(({ id, label, image, summary }) => ({
    id,
    label,
    image,
    summary,
  })),
);

export const DEFAULT_CHARACTER_TYPE_ID = CHARACTER_TYPES[0].id;

export function getCharacterDefinition(typeId) {
  return CHARACTER_DEFINITIONS[typeId] || CHARACTER_DEFINITIONS[DEFAULT_CHARACTER_TYPE_ID];
}

export function getCharacterType(typeId) {
  const definition = getCharacterDefinition(typeId);
  return {
    id: definition.id,
    label: definition.label,
    image: definition.image,
    summary: definition.summary,
  };
}

export function normalizeHexColor(value) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const shortMatch = trimmed.match(/^#?([0-9a-f]{3})$/i);
  if (shortMatch) {
    return `#${shortMatch[1].split('').map((char) => `${char}${char}`).join('')}`.toUpperCase();
  }

  const fullMatch = trimmed.match(/^#?([0-9a-f]{6})$/i);
  return fullMatch ? `#${fullMatch[1].toUpperCase()}` : null;
}

export function parsePaletteSlotId(slotId) {
  if (typeof slotId !== 'string') return null;

  const match = slotId.match(/^r([0-7])c([0-7])$/);
  if (!match) return null;

  return {
    row: Number(match[1]),
    column: Number(match[2]),
  };
}

export function getDefaultPaletteSlots(typeId) {
  return { ...getCharacterDefinition(typeId).defaultSlots };
}

export function getUsedPaletteSlots(typeId) {
  return [...getCharacterDefinition(typeId).usedSlots];
}

export function getPaletteSlotGroups(typeId) {
  const definition = getCharacterDefinition(typeId);
  const groupBySlot = new Map();
  const emittedSlots = new Set();
  const groups = [];

  for (const group of definition.paletteGroups || []) {
    const validGroup = group.filter((slotId) => definition.usedSlots.includes(slotId));
    if (validGroup.length === 0) continue;

    for (const slotId of validGroup) groupBySlot.set(slotId, validGroup);
  }

  for (const slotId of definition.usedSlots) {
    if (emittedSlots.has(slotId)) continue;

    const group = groupBySlot.get(slotId) || [slotId];
    for (const groupedSlotId of group) emittedSlots.add(groupedSlotId);
    groups.push(group);
  }

  return groups.map((group) => [...group]);
}

export function getPaletteSlotsForControl(typeId, controlSlotId) {
  const group = getPaletteSlotGroups(typeId).find((slots) => slots.includes(controlSlotId));
  return group ? [...group] : [];
}

function paletteSlotSource(palette) {
  if (!palette || typeof palette !== 'object') return {};
  if (palette.slots && typeof palette.slots === 'object') return palette.slots;
  return palette;
}

export function normalizePaletteSlots(typeId, slots, { pruneDefaults = true } = {}) {
  const definition = getCharacterDefinition(typeId);
  const usedSlots = new Set(definition.usedSlots);
  const normalized = {};

  for (const [slotId, color] of Object.entries(paletteSlotSource(slots))) {
    if (!usedSlots.has(slotId)) continue;

    const hex = normalizeHexColor(color);
    if (!hex) continue;
    if (pruneDefaults && hex === definition.defaultSlots[slotId]) continue;

    normalized[slotId] = hex;
  }

  return normalized;
}

export function normalizeCharacterPalette(typeId, palette) {
  return {
    version: CHARACTER_PALETTE_VERSION,
    slots: normalizePaletteSlots(typeId, palette),
  };
}

export function createPaletteDraft(typeId, palette = null) {
  return {
    ...getDefaultPaletteSlots(typeId),
    ...normalizePaletteSlots(typeId, palette, { pruneDefaults: false }),
  };
}

export function serializePaletteDraft(typeId, draftSlots) {
  return normalizeCharacterPalette(typeId, draftSlots);
}

export function paletteSignature(typeId, palette) {
  const definition = getCharacterDefinition(typeId);
  const normalized = normalizeCharacterPalette(typeId, palette);
  const parts = definition.usedSlots
    .filter((slotId) => normalized.slots[slotId])
    .map((slotId) => `${slotId}:${normalized.slots[slotId]}`);

  return parts.length > 0 ? `${definition.id}|${parts.join('|')}` : `${definition.id}|default`;
}

export function characterAccentColor(typeId, palette = null, fallbackColor = null) {
  const fallback = normalizeHexColor(fallbackColor);
  if (fallback) return fallback;

  const definition = getCharacterDefinition(typeId);
  const normalized = normalizeCharacterPalette(definition.id, palette);
  const firstEditedSlot = definition.usedSlots.find((slotId) => normalized.slots[slotId]);

  return firstEditedSlot
    ? normalized.slots[firstEditedSlot]
    : definition.defaultSlots[definition.usedSlots[0]];
}

export function normalizeCharacterRecord(character, index = 0) {
  const type = getCharacterDefinition(character?.type);
  const name = typeof character?.name === 'string' && character.name.trim()
    ? character.name.trim().slice(0, 24)
    : `${type.label} ${index + 1}`;
  const palette = normalizeCharacterPalette(type.id, character?.palette);

  return {
    id: typeof character?.id === 'string' && character.id
      ? character.id
      : `character-${Date.now()}-${index}`,
    name,
    type: type.id,
    typeLabel: type.label,
    color: characterAccentColor(type.id, palette, character?.color),
    palette,
    image: type.image,
    createdAt: Number.isFinite(character?.createdAt) ? character.createdAt : Date.now(),
  };
}
