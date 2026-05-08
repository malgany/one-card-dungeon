import {
  ACTION_RULES,
  CARD_SOURCES,
  CHARACTERISTIC_DEFINITIONS,
  GAME_MODES,
  LEVELS,
  MONSTER_TEMPLATES,
  PHASES,
  START_WORLD_MAP_ID,
  WORLD_OBJECT_TYPES,
  getWorldMap,
  normalizeEncounterGroupId,
  normalizeMonsterId,
  normalizeMonsterType,
} from '../config/game-data.js';

const OVERWORLD_SPAWN_MIN = 1;
const OVERWORLD_SPAWN_MAX = 5;
const FALLBACK_OVERWORLD_ENEMY_TYPES = ['skeletonMinion', 'skeletonWarrior', 'skeletonRogue', 'skeletonMage'];
const OVERWORLD_MAX_ENEMY_LEVEL = 8;
const OVERWORLD_MIN_ENEMY_SCALE = 0.86;
const OVERWORLD_MAX_ENEMY_SCALE = 1.2;

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function objectFootprint(object) {
  return object?.footprint || WORLD_OBJECT_TYPES[object?.type]?.footprint || [[0, 0]];
}

function spawnBlockedKeys(map) {
  const blocked = new Set();

  if (map?.playerStart) blocked.add(keyFor(map.playerStart.x, map.playerStart.y));
  for (const connection of map?.connections || []) {
    blocked.add(keyFor(connection.x, connection.y));
  }
  for (const object of map?.objects || []) {
    for (const [dx, dy] of objectFootprint(object)) {
      blocked.add(keyFor(object.x + dx, object.y + dy));
    }
  }

  return blocked;
}

function spawnPoolForMap(map) {
  const encounterTypes = (map?.encounters || [])
    .map((encounter) => normalizeMonsterType(encounter.type))
    .filter((type) => MONSTER_TEMPLATES[type]);

  return encounterTypes.length > 0 ? encounterTypes : FALLBACK_OVERWORLD_ENEMY_TYPES;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toPositiveInteger(value, fallback = 1) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function overworldMapDistance(map) {
  if (Number.isFinite(map?.dangerDistance)) return Math.max(0, Math.floor(map.dangerDistance));
  const x = map?.gridPosition?.x;
  const y = map?.gridPosition?.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return Math.abs(Math.floor(x)) + Math.abs(Math.floor(y));
}

export function overworldEnemyLevelForMap(map) {
  if (Number.isFinite(map?.enemyLevel)) {
    return clampNumber(Math.floor(map.enemyLevel), 1, OVERWORLD_MAX_ENEMY_LEVEL);
  }

  return clampNumber(Math.max(1, overworldMapDistance(map)), 1, OVERWORLD_MAX_ENEMY_LEVEL);
}

export function leveledMonsterStats(type, level = 1) {
  const normalizedType = normalizeMonsterType(type);
  const template = MONSTER_TEMPLATES[normalizedType];
  const normalizedLevel = clampNumber(toPositiveInteger(level, 1), 1, OVERWORLD_MAX_ENEMY_LEVEL);
  const tier = normalizedLevel - 1;

  if (!template) {
    return {
      level: normalizedLevel,
      hp: 1,
      maxHp: 1,
      attack: 1,
      defense: 0,
      range: 1,
      speed: 3,
      xp: 1,
      lifeSteal: 0,
      visualScale: 1,
    };
  }

  const mageBonus = normalizedType === 'skeletonMage' ? Math.floor(tier / 2) : 0;
  const warriorBonus = normalizedType === 'skeletonWarrior' ? Math.floor(tier / 3) : 0;
  const hpGrowth = Math.round(template.hp * tier * 0.15) + tier * 4 + mageBonus * 3;

  return {
    level: normalizedLevel,
    hp: template.hp + hpGrowth,
    maxHp: template.hp + hpGrowth,
    attack: template.attack + Math.floor((tier + 1) / 2) + mageBonus,
    defense: template.defense + Math.floor(tier / 3) + warriorBonus,
    range: Math.min(5, template.range + (normalizedType === 'skeletonMage' && tier >= 4 ? 1 : 0)),
    speed: Math.min(4, template.speed + (tier >= 6 ? 1 : 0)),
    xp: template.xp + tier * 6 + mageBonus * 3 + warriorBonus * 2,
    lifeSteal: Math.min(8, Math.floor(tier / 2) + mageBonus),
    visualScale: clampNumber(OVERWORLD_MIN_ENEMY_SCALE + tier * 0.045, OVERWORLD_MIN_ENEMY_SCALE, OVERWORLD_MAX_ENEMY_SCALE),
  };
}

function createEnemyStats(type, level) {
  return leveledMonsterStats(type, level);
}

function randomGroupSize(map, remaining) {
  if (remaining <= 1) return 1;

  const level = overworldEnemyLevelForMap(map);
  const roll = Math.random();
  if (level >= 5 && remaining >= 3 && roll > 0.82) return 3;
  if (level >= 2 && roll > 0.62) return 2;
  return 1;
}

function randomOverworldEnemyCount() {
  const roll = Math.random();
  if (roll < 0.08) return 1;
  if (roll < 0.28) return 2;
  if (roll < 0.6) return 3;
  if (roll < 0.9) return 4;
  return 5;
}

function randomSpawnCell(map, occupied) {
  const width = map?.size?.width || 10;
  const height = map?.size?.height || 10;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = randomInt(0, width - 1);
    const y = randomInt(0, height - 1);
    const key = keyFor(x, y);
    if (!occupied.has(key)) {
      occupied.add(key);
      return { x, y };
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = keyFor(x, y);
      if (!occupied.has(key)) {
        occupied.add(key);
        return { x, y };
      }
    }
  }

  return { x: 0, y: 0 };
}

export function loadCardImages() {
  const images = {};

  for (const [key, src] of Object.entries(CARD_SOURCES)) {
    const image = new Image();
    image.src = src;
    images[key] = image;
  }

  return images;
}

export function randDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export function makeEnergyRoll() {
  return [randDie(), randDie(), randDie()];
}

export function createMonster(type, x, y, index, options = {}) {
  const normalizedType = normalizeMonsterType(type);
  const template = MONSTER_TEMPLATES[normalizedType];
  const stats = createEnemyStats(normalizedType, options.level);

  return {
    id: `${normalizedType}-${index}-${x}-${y}`,
    type: normalizedType,
    x,
    y,
    level: stats.level,
    hp: Number.isFinite(options.hp) ? options.hp : stats.hp,
    maxHp: Number.isFinite(options.maxHp) ? options.maxHp : stats.maxHp,
    attack: Number.isFinite(options.attack) ? options.attack : stats.attack,
    defense: Number.isFinite(options.defense) ? options.defense : stats.defense,
    range: Number.isFinite(options.range) ? options.range : stats.range,
    speed: Number.isFinite(options.speed) ? options.speed : stats.speed,
    xp: Number.isFinite(options.xp) ? options.xp : stats.xp,
    lifeSteal: Number.isFinite(options.lifeSteal) ? options.lifeSteal : stats.lifeSteal,
    visualScale: Number.isFinite(options.visualScale) ? options.visualScale : stats.visualScale,
    xpGranted: false,
    name: template.name,
    emoji: template.emoji,
    tint: template.tint,
  };
}

export function createOverworldEnemy(typeOrEncounter, x, y, groupId, index, mapId = null) {
  let encounter;
  let encounterIndex;
  let activeMapId;

  if (typeOrEncounter && typeof typeOrEncounter === 'object') {
    encounter = typeOrEncounter;
    encounterIndex = Number.isInteger(x) ? x : 0;
    activeMapId = y || encounter.mapId || null;
  } else {
    encounter = { type: typeOrEncounter, x, y, groupId };
    encounterIndex = Number.isInteger(index) ? index : 0;
    activeMapId = mapId;
  }

  const normalizedType = normalizeMonsterType(encounter.type);
  const template = MONSTER_TEMPLATES[normalizedType];
  const group = normalizeEncounterGroupId(encounter.groupId || encounter.id || `${normalizedType}-${encounterIndex}`);
  const idPrefix = activeMapId ? `overworld-${activeMapId}` : 'overworld';
  const activeMap = activeMapId ? getWorldMap(activeMapId) : null;
  const stats = createEnemyStats(
    normalizedType,
    encounter.level || overworldEnemyLevelForMap(activeMap),
  );

  return {
    id: `${idPrefix}-${group}-${encounterIndex}`,
    encounterId: normalizeMonsterId(encounter.id || `${group}-${encounterIndex}`),
    mapId: activeMapId,
    type: normalizedType,
    x: encounter.x,
    y: encounter.y,
    groupId: group,
    level: stats.level,
    hp: Number.isFinite(encounter.hp) ? encounter.hp : stats.hp,
    maxHp: Number.isFinite(encounter.maxHp) ? encounter.maxHp : stats.maxHp,
    attack: Number.isFinite(encounter.attack) ? encounter.attack : stats.attack,
    defense: Number.isFinite(encounter.defense) ? encounter.defense : stats.defense,
    range: Number.isFinite(encounter.range) ? encounter.range : stats.range,
    speed: Number.isFinite(encounter.speed) ? encounter.speed : stats.speed,
    xp: Number.isFinite(encounter.xp) ? encounter.xp : stats.xp,
    lifeSteal: Number.isFinite(encounter.lifeSteal) ? encounter.lifeSteal : stats.lifeSteal,
    visualScale: Number.isFinite(encounter.visualScale) ? encounter.visualScale : stats.visualScale,
    xpGranted: false,
    name: template.name,
    emoji: template.emoji,
    tint: template.tint,
  };
}

export function createCombatMonsterFromEnemy(enemy, x, y, index) {
  const monster = createMonster(enemy.type, x, y, index, {
    level: enemy.level,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    attack: enemy.attack,
    defense: enemy.defense,
    range: enemy.range,
    speed: enemy.speed,
    xp: enemy.xp,
    lifeSteal: enemy.lifeSteal,
    visualScale: enemy.visualScale,
  });

  return {
    ...monster,
    id: enemy.id,
    groupId: enemy.groupId,
    overworldEnemyId: enemy.id,
  };
}

export function levelMonsters(level) {
  return level.monsters.map((monster, index) => {
    return createMonster(monster[0], monster[1], monster[2], index);
  });
}

export function overworldEnemies(map, wave = 0) {
  if (map?.randomEncounters === false) return [];

  const count = Math.max(OVERWORLD_SPAWN_MIN, Math.min(OVERWORLD_SPAWN_MAX, randomOverworldEnemyCount()));
  const pool = spawnPoolForMap(map);
  const occupied = spawnBlockedKeys(map);
  const enemies = [];
  let groupIndex = 0;

  while (enemies.length < count) {
    const groupSize = Math.min(randomGroupSize(map, count - enemies.length), count - enemies.length);
    const groupId = `${map.id}-spawn-${wave}-${groupIndex}`;

    for (let memberIndex = 0; memberIndex < groupSize; memberIndex += 1) {
      const index = enemies.length;
      const type = pool[(randomInt(0, pool.length - 1) + memberIndex + groupIndex) % pool.length];
      const cell = randomSpawnCell(map, occupied);
      const encounter = {
        id: `${groupId}-${memberIndex}`,
        type,
        level: overworldEnemyLevelForMap(map),
        x: cell.x,
        y: cell.y,
        groupId,
      };

      enemies.push(createOverworldEnemy(encounter, index, map.id));
    }

    groupIndex += 1;
  }

  return enemies;
}

export function createOverworldMapState(map) {
  return {
    mapId: map.id,
    enemies: overworldEnemies(map, 0),
    enemyWave: 1,
    nextRespawnAt: null,
    pendingRespawnEnemies: [],
    pickups: [],
    pickupCounter: 0,
    removedObjectIds: [],
    debugColors: null,
  };
}

function createOverworldRuntime(map = getWorldMap(START_WORLD_MAP_ID)) {
  return {
    currentMapId: map.id,
    heroPath: [map.id],
    mapStates: {
      [map.id]: createOverworldMapState(map),
    },
  };
}

export function ensureOverworldMapState(overworld, mapId) {
  if (!overworld || !mapId) return null;
  if (!overworld.mapStates) overworld.mapStates = {};
  if (overworld.mapStates[mapId]) return overworld.mapStates[mapId];

  const map = getWorldMap(mapId);
  if (!map) return null;

  overworld.mapStates[mapId] = createOverworldMapState(map);
  return overworld.mapStates[mapId];
}

function createPlayer(position) {
  return {
    x: position.x,
    y: position.y,
    facing: { x: 0, y: 1 },
    level: 1,
    experience: 0,
    characteristicPoints: 0,
    characteristics: Object.fromEntries(
      Object.keys(CHARACTERISTIC_DEFINITIONS).map((key) => [key, 0])
    ),
    health: 60,
    maxHealth: 60,
    apMax: ACTION_RULES.BASE_AP,
    speedBase: 3,
    attackSlot: { ...ACTION_RULES.BASIC_ATTACK },
    defenseBase: 0,
    rangeBase: 2,
  };
}

function createBaseUiState() {
  return {
    roll: [],
    energyAssigned: { speed: null, attack: null, defense: null },
    assignment: { speed: 0, attack: 0, defense: 0 },
    buttons: [],
    diceRects: [],
    dropZones: [],
    draggingDie: null,
    draggingControl: null,
    selectedAttackId: null,
    selectedEntity: null,
    activeModal: null,
    levelUpNotice: null,
    mapTransition: null,
    menuOpen: false,
    menuView: 'main',
    optionsTab: 'how-to',
    cutscene: null,
    animations: [],
    busy: false,
    heroTurnStartedAt: null,
    heroTurnEndsAt: null,
    nextOverworldHealthRegenAt: null,
  };
}

export function createOverworldGame(map = getWorldMap(START_WORLD_MAP_ID)) {
  const player = createPlayer(map.playerStart);

  return {
    mode: GAME_MODES.OVERWORLD,
    levelIndex: 0,
    player,
    monsters: [],
    overworld: createOverworldRuntime(map),
    combatContext: null,
    combatWalls: null,
    phase: PHASES.HERO,
    ...createBaseUiState(),
    speedRemaining: player.speedBase,
    apRemaining: player.apMax,
    turnCount: 0,
    turnQueue: ['player'],
    banner: {
      title: map.name,
      subtitle: 'Clique para andar. Clique em inimigos para lutar.',
      until: performance.now() + 1400,
      cardKey: 'player',
      accent: '#5f8f54',
    },
    lastEvent: 'Explore o mapa aberto.',
    eventLog: ['Explore o mapa aberto.'],
  };
}

export function createDungeonLegacyGame() {
  const level = LEVELS[0];
  const monsters = levelMonsters(level);

  return {
    mode: GAME_MODES.DUNGEON_LEGACY,
    levelIndex: 0,
    player: createPlayer(level.start),
    monsters,
    overworld: null,
    combatContext: null,
    combatWalls: null,
    phase: PHASES.HERO,
    ...createBaseUiState(),
    speedRemaining: 3,
    apRemaining: ACTION_RULES.BASE_AP,
    turnCount: 1,
    turnQueue: ['player', ...monsters.map(m => m.id)],
    banner: {
      title: 'Sua vez',
      subtitle: `${ACTION_RULES.BASE_AP} AP para agir`,
      until: performance.now() + 1200,
      cardKey: 'player',
      accent: '#5f8f54',
    },
    lastEvent: `Sua vez. ${ACTION_RULES.BASE_AP} AP, ${3} movimento.`,
  };
}

export function createGame() {
  return createOverworldGame();
}
