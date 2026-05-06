import {
  ACTION_RULES,
  CHARACTERISTIC_DEFINITIONS,
  XP_RULES,
} from '../config/game-data.js';

export const CHARACTERS_KEY = 'one-rpg-characters-v1';
export const SELECTED_CHARACTER_KEY = 'one-rpg-selected-character-v1';

function storageAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function toNonNegativeInteger(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function characteristicKeys() {
  return Object.keys(CHARACTERISTIC_DEFINITIONS);
}

function createDefaultCharacteristics() {
  return Object.fromEntries(characteristicKeys().map((key) => [key, 0]));
}

export function levelXpRequirement(level) {
  const normalizedLevel = Math.max(1, Math.floor(level || 1));
  return XP_RULES.BASE_LEVEL_XP + (normalizedLevel - 1) * XP_RULES.LEVEL_XP_STEP;
}

export function totalXpForLevel(level) {
  const normalizedLevel = Math.max(1, Math.floor(level || 1));
  let total = 0;

  for (let currentLevel = 1; currentLevel < normalizedLevel; currentLevel += 1) {
    total += levelXpRequirement(currentLevel);
  }

  return total;
}

export function levelFromExperience(experience) {
  const totalExperience = toNonNegativeInteger(experience);
  let level = 1;
  let threshold = levelXpRequirement(level);
  let spentExperience = 0;

  while (totalExperience >= spentExperience + threshold) {
    spentExperience += threshold;
    level += 1;
    threshold = levelXpRequirement(level);
  }

  return level;
}

function normalizeCharacteristics(values = {}) {
  const characteristics = createDefaultCharacteristics();
  for (const key of characteristicKeys()) {
    characteristics[key] = toNonNegativeInteger(values?.[key]);
  }
  return characteristics;
}

export function normalizeCharacterProgress(progress = {}, fallback = {}) {
  const source = progress && typeof progress === 'object' ? progress : {};
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {};
  const characteristics = normalizeCharacteristics(source.characteristics || fallbackSource.characteristics);
  const experience = toNonNegativeInteger(source.experience, toNonNegativeInteger(fallbackSource.experience));
  const level = Math.max(
    toNonNegativeInteger(source.level, toNonNegativeInteger(fallbackSource.level, 1)) || 1,
    levelFromExperience(experience),
  );
  const lifeFloor = 60 + characteristics.life * XP_RULES.LIFE_PER_POINT;
  const maxHealth = Math.max(
    lifeFloor,
    toNonNegativeInteger(source.maxHealth, toNonNegativeInteger(fallbackSource.maxHealth, lifeFloor)),
  );

  return {
    level,
    experience,
    characteristicPoints: toNonNegativeInteger(
      source.characteristicPoints,
      toNonNegativeInteger(fallbackSource.characteristicPoints),
    ),
    characteristics,
    health: Math.max(0, Math.min(
      maxHealth,
      toNonNegativeInteger(source.health, toNonNegativeInteger(fallbackSource.health, maxHealth)),
    )),
    maxHealth,
    apMax: toNonNegativeInteger(source.apMax, toNonNegativeInteger(fallbackSource.apMax, ACTION_RULES.BASE_AP)),
    speedBase: toNonNegativeInteger(source.speedBase, toNonNegativeInteger(fallbackSource.speedBase, 3)),
    defenseBase: toNonNegativeInteger(source.defenseBase, toNonNegativeInteger(fallbackSource.defenseBase, 0)),
    rangeBase: toNonNegativeInteger(source.rangeBase, toNonNegativeInteger(fallbackSource.rangeBase, 2)),
  };
}

export function characterProgressFromPlayer(player) {
  return normalizeCharacterProgress(player);
}

export function applyCharacterProgressToPlayer(player, progress) {
  if (!player || !progress || typeof progress !== 'object') return player;
  Object.assign(player, normalizeCharacterProgress(progress, player));
  return player;
}

export function readStoredCharacters() {
  if (!storageAvailable()) return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHARACTERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeStoredCharacters(characters) {
  if (!storageAvailable()) return false;

  try {
    window.localStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters));
    return true;
  } catch {
    return false;
  }
}

export function selectedStoredCharacterId() {
  if (!storageAvailable()) return null;

  try {
    return window.localStorage.getItem(SELECTED_CHARACTER_KEY);
  } catch {
    return null;
  }
}

export function persistPlayerProgress(player) {
  const characterId = player?.characterId || selectedStoredCharacterId();
  if (!characterId) return false;

  const characters = readStoredCharacters();
  const index = characters.findIndex((character) => character?.id === characterId);
  if (index < 0) return false;

  characters[index] = {
    ...characters[index],
    progress: characterProgressFromPlayer(player),
  };
  return writeStoredCharacters(characters);
}
