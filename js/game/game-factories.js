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

const OVERWORLD_SPAWN_MIN = 2;
const OVERWORLD_SPAWN_MAX = 5;
const FALLBACK_OVERWORLD_ENEMY_TYPES = ['skeletonMinion', 'skeletonWarrior', 'skeletonRogue', 'skeletonMage'];

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

export function createMonster(type, x, y, index) {
  const normalizedType = normalizeMonsterType(type);
  const template = MONSTER_TEMPLATES[normalizedType];

  return {
    id: `${normalizedType}-${index}-${x}-${y}`,
    type: normalizedType,
    x,
    y,
    hp: template.hp,
    maxHp: template.hp,
    attack: template.attack,
    defense: template.defense,
    range: template.range,
    speed: template.speed,
    xp: template.xp,
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

  return {
    id: `${idPrefix}-${group}-${encounterIndex}`,
    encounterId: normalizeMonsterId(encounter.id || `${group}-${encounterIndex}`),
    mapId: activeMapId,
    type: normalizedType,
    x: encounter.x,
    y: encounter.y,
    groupId: group,
    hp: template.hp,
    maxHp: template.hp,
    xp: template.xp,
    xpGranted: false,
    name: template.name,
    emoji: template.emoji,
    tint: template.tint,
  };
}

export function createCombatMonsterFromEnemy(enemy, x, y, index) {
  const monster = createMonster(enemy.type, x, y, index);

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

  const count = randomInt(OVERWORLD_SPAWN_MIN, OVERWORLD_SPAWN_MAX);
  const pool = spawnPoolForMap(map);
  const occupied = spawnBlockedKeys(map);

  return Array.from({ length: count }, (_, index) => {
    const type = pool[randomInt(0, pool.length - 1)];
    const cell = randomSpawnCell(map, occupied);
    const encounter = {
      id: `${map.id}-spawn-${wave}-${index}`,
      type,
      x: cell.x,
      y: cell.y,
      groupId: `${map.id}-spawn-${wave}-${index}`,
    };

    return createOverworldEnemy(encounter, index, map.id);
  });
}

export function createOverworldMapState(map) {
  return {
    mapId: map.id,
    enemies: overworldEnemies(map, 0),
    enemyWave: 1,
    nextRespawnAt: null,
    removedObjectIds: [],
    debugColors: null,
  };
}

function createOverworldRuntime(map = getWorldMap(START_WORLD_MAP_ID)) {
  return {
    currentMapId: map.id,
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
