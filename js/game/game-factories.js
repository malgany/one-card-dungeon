import {
  ACTION_RULES,
  CARD_SOURCES,
  GAME_MODES,
  LEVELS,
  MONSTER_TEMPLATES,
  PHASES,
  START_WORLD_MAP_ID,
  getWorldMap,
  normalizeEncounterGroupId,
  normalizeMonsterId,
  normalizeMonsterType,
} from '../config/game-data.js';

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

export function overworldEnemies(map) {
  return (map.encounters || []).map((encounter, index) => {
    return createOverworldEnemy(encounter, index, map.id);
  });
}

export function createOverworldMapState(map) {
  return {
    mapId: map.id,
    enemies: overworldEnemies(map),
    removedObjectIds: [],
  };
}

export function createOverworldRuntime(map = getWorldMap(START_WORLD_MAP_ID)) {
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

export function createPlayer(position) {
  return {
    x: position.x,
    y: position.y,
    health: 60,
    maxHealth: 60,
    apMax: ACTION_RULES.BASE_AP,
    speedBase: 3,
    attackSlot: { ...ACTION_RULES.BASIC_ATTACK },
    defenseBase: 2,
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
    selectedAttackId: null,
    selectedEntity: null,
    menuOpen: false,
    animations: [],
    busy: false,
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
      accent: '#34d399',
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
      accent: '#34d399',
    },
    lastEvent: `Sua vez. ${ACTION_RULES.BASE_AP} AP, ${3} movimento.`,
  };
}

export function createGame() {
  return createOverworldGame();
}
