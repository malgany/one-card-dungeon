import {
  ACTION_RULES,
  ATTACK_PATTERNS,
  BOARD_SIZE,
  CHARACTERISTIC_DEFINITIONS,
  GAME_MODES,
  LEVELS,
  MONSTER_TEMPLATES,
  PHASES,
  SAVE_KEY,
  START_WORLD_MAP_ID,
  SPELL_DEFINITIONS,
  SPELL_ELEMENTS,
  TIMING,
  XP_RULES,
  getWorldMap,
  normalizeEncounterGroupId,
  normalizeMonsterId,
  normalizeMonsterType,
} from '../config/game-data.js';
import {
  NURSERY_INTRO_ID,
  NURSERY_INTRO_LINE_GAP,
  NURSERY_INTRO_MAP_ID,
  activeNurseryIntroLine,
  createNurseryIntroCutscene,
} from '../config/cutscenes/nursery-intro.js';
import {
  coordinatePairsToSet,
  dijkstra,
  distanceBetween,
  hasLineOfSight,
  levelWallsSet,
  monsterOccupiedKeys,
  parseKey,
  posKey,
  reconstructPath,
  samePos,
} from './board-logic.js';
import {
  createCombatMonsterFromEnemy,
  createDungeonLegacyGame,
  createGame,
  createOverworldGame,
  ensureOverworldMapState,
  levelMonsters,
  leveledMonsterStats,
  overworldEnemies,
} from './game-factories.js';
import {
  SELECTED_CHARACTER_KEY,
  levelFromExperience,
  levelXpRequirement,
  persistPlayerProgress,
  totalXpForLevel,
} from './character-progress.js';
import {
  getCurrentWorldBounds,
  getCurrentWorldEnemies,
  getCurrentWorldMap,
  getCurrentWorldMapState,
  getCurrentWorldPickups,
  getWorldConnectionAt,
  getWorldObjectBlockedKeys,
} from './world-state.js';
import {
  getOverworldMusicVolume,
  playCombatMusic,
  playOverworldMusic,
  setOverworldMusicVolume,
  stopCombatMusic,
  stopOverworldMusic,
} from './audio.js';

let heroTurnTimeoutId = null;
const PLAYER_ATTACK_ANIMATION = 'Throw';
const CHARACTER_SAVE_KEY_PREFIX = `${SAVE_KEY}:character:`;
const PLAYER_SPELL_MODEL_ACTIONS = Object.freeze({
  mageFireBucket: {
    animation: 'Ranged_Magic_Shoot',
    duration: 933,
    impactDelay: 780,
    projectile: {
      model: 'fireBucket',
      startDelay: 360,
      duration: 420,
    },
  },
  mageFonteCinzas: {
    animation: 'Ranged_Magic_Shoot',
    duration: 933,
    impactDelay: 760,
    projectile: {
      model: 'fireBucket',
      startDelay: 340,
      duration: 420,
    },
  },
  mageAmpulhetaMare: {
    animation: 'Ranged_Magic_Shoot',
    duration: 933,
    impactDelay: 760,
    projectile: {
      model: 'waterHourglass',
      startDelay: 340,
      duration: 420,
    },
  },
  knightStoneLance: {
    animation: 'Melee_1H_Attack_Chop',
    duration: 1067,
    impactDelay: 690,
    projectile: {
      model: 'stoneLance',
      startDelay: 430,
      duration: 260,
    },
  },
  knightCorteVendaval: {
    animation: 'Melee_1H_Attack_Chop',
    duration: 1067,
    impactDelay: 690,
    projectile: {
      model: 'windSlash',
      startDelay: 430,
      duration: 300,
    },
  },
  knightQuebraBaluarte: {
    animation: 'Melee_1H_Attack_Chop',
    duration: 1067,
    impactDelay: 690,
    projectile: {
      model: 'stoneLance',
      startDelay: 430,
      duration: 260,
    },
  },
  barbarianBoulderHurl: {
    animation: 'Melee_2H_Attack_Chop',
    duration: 1633,
    impactDelay: 1140,
    projectile: {
      model: 'rollingBoulder',
      startDelay: 620,
      duration: 520,
    },
  },
  barbarianTremorPedra: {
    animation: 'Melee_2H_Attack_Chop',
    duration: 1633,
    impactDelay: 1080,
    projectile: {
      model: 'rollingBoulder',
      startDelay: 560,
      duration: 470,
    },
  },
  barbarianRugidoBrasa: {
    animation: 'Melee_2H_Attack_Chop',
    duration: 1633,
    impactDelay: 960,
    projectile: {
      model: 'fireBucket',
      startDelay: 520,
      duration: 390,
    },
  },
  rangerVerdantArrow: {
    animation: 'Ranged_Bow_Release',
    duration: 1333,
    impactDelay: 900,
    projectile: {
      model: 'arrowBow',
      startDelay: 620,
      duration: 280,
    },
  },
  rangerFlechaIncendiaria: {
    animation: 'Ranged_Bow_Release',
    duration: 1333,
    impactDelay: 900,
    projectile: {
      model: 'flameArrow',
      startDelay: 620,
      duration: 280,
    },
  },
  rangerDisparoCiclone: {
    animation: 'Ranged_Bow_Release',
    duration: 1333,
    impactDelay: 900,
    projectile: {
      model: 'cycloneArrow',
      startDelay: 620,
      duration: 320,
    },
  },
  rogueTideDagger: {
    animation: 'Ranged_1H_Shoot',
    duration: 1067,
    impactDelay: 690,
    projectile: {
      model: 'tideDagger',
      startDelay: 430,
      duration: 260,
    },
  },
  rogueCorteRessaca: {
    animation: 'Ranged_1H_Shoot',
    duration: 1067,
    impactDelay: 690,
    projectile: {
      model: 'tideDagger',
      startDelay: 430,
      duration: 260,
    },
  },
  rogueEspelhoAfogado: {
    animation: 'Ranged_1H_Shoot',
    duration: 1067,
    impactDelay: 690,
    projectile: {
      model: 'waterMirror',
      startDelay: 430,
      duration: 300,
    },
  },
});

function normalizeCharacterSaveId(characterId) {
  return typeof characterId === 'string' && characterId ? characterId : null;
}

function characterSaveKey(characterId) {
  const normalized = normalizeCharacterSaveId(characterId);
  return normalized ? `${CHARACTER_SAVE_KEY_PREFIX}${encodeURIComponent(normalized)}` : SAVE_KEY;
}

function readLocalStorageText(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function selectedStoredCharacterId() {
  return normalizeCharacterSaveId(readLocalStorageText(SELECTED_CHARACTER_KEY));
}

function savedSnapshotCharacterId(snapshot) {
  return normalizeCharacterSaveId(snapshot?.player?.characterId)
    || normalizeCharacterSaveId(snapshot?.selectedCharacter?.id);
}

function readSavedGameRaw(characterId) {
  const requestedCharacterId = normalizeCharacterSaveId(characterId);
  if (!requestedCharacterId) return readLocalStorageText(SAVE_KEY);

  const scopedRaw = readLocalStorageText(characterSaveKey(requestedCharacterId));
  if (scopedRaw) return scopedRaw;

  const legacyRaw = readLocalStorageText(SAVE_KEY);
  if (!legacyRaw) return null;

  try {
    const legacySnapshot = JSON.parse(legacyRaw);
    const legacyCharacterId = savedSnapshotCharacterId(legacySnapshot);
    return !legacyCharacterId || legacyCharacterId === requestedCharacterId ? legacyRaw : null;
  } catch {
    return null;
  }
}
const OVERWORLD_COMBAT_WALL_COUNT = 3;
const COMBAT_WALL_GENERATION_ATTEMPTS = 80;
const COMBAT_ARENA_BOUNDS = { width: BOARD_SIZE, height: BOARD_SIZE };
const NURSERY_WAKE_ANIMATION = 'Spawn_Ground';
const NURSERY_IDLE_TALK_ANIMATION = 'Idle_B';
const NURSERY_GESTURE_ANIMATION = 'Interact';
const NURSERY_FALLEN_ANIMATION = 'Death_B';
const NURSERY_WAKE_ANIMATION_DURATION = 1300;
const NURSERY_GESTURE_ANIMATION_DURATION = 1300;
const OVERWORLD_BLOCKED_CONNECTION_SPEECH_DURATION = 2200;
const OVERWORLD_ENEMY_WANDER_MIN_COST = 1.5;
const OVERWORLD_ENEMY_WANDER_MAX_COST = 3.25;
const OVERWORLD_ENEMY_WANDER_ENTITY_STAGGER = 850;
const OVERWORLD_PICKUP_DROP_RADIUS = 1;
const OVERWORLD_PICKUP_LIFETIME = 15 * 1000;
const OFFLINE_HEALTH_FULL_REGEN_TIME = 3 * 60 * 1000;
const OVERWORLD_PICKUP_DEFINITIONS = Object.freeze({
  apple: { label: 'Maca', healAmount: 10 },
  bread: { label: 'Pao', healAmount: 20 },
  goldenApple: { label: 'Maca dourada', healAmount: 35 },
  goldenBread: { label: 'Pao dourado', healAmount: 60 },
});

function mapBounds(map) {
  return {
    width: map?.size?.width || BOARD_SIZE,
    height: map?.size?.height || BOARD_SIZE,
  };
}

function clampToBoard(value, max) {
  return Math.max(0, Math.min(max - 1, value));
}

function directionIntoMapFromSpawn(spawn, map) {
  const { width, height } = mapBounds(map);

  if (spawn.x <= 0) return { x: 1, y: 0 };
  if (spawn.x >= width - 1) return { x: -1, y: 0 };
  if (spawn.y <= 0) return { x: 0, y: 1 };
  if (spawn.y >= height - 1) return { x: 0, y: -1 };

  return { x: 0, y: 0 };
}

function entryFromConnectionSpawn(spawn, map) {
  const { width, height } = mapBounds(map);
  const facing = directionIntoMapFromSpawn(spawn, map);

  return {
    x: clampToBoard(spawn.x + facing.x, width),
    y: clampToBoard(spawn.y + facing.y, height),
    facing,
  };
}

function finalDirectionFromPath(path) {
  if (!Array.isArray(path) || path.length < 2) return null;

  const from = path[path.length - 2];
  const to = path[path.length - 1];

  return {
    x: to.x - from.x,
    y: to.y - from.y,
  };
}

function pathDistance(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const p1 = path[i];
    const p2 = path[i + 1];
    total += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
  return total;
}

function overworldMapTransitionDuration() {
  return TIMING.OVERWORLD_MAP_FADE_IN + TIMING.OVERWORLD_MAP_FADE_HOLD + TIMING.OVERWORLD_MAP_FADE_OUT;
}

function shouldActivateOverworldConnection(options = {}) {
  return options.activateConnection !== false;
}

function connectionBlockedMessage(connection) {
  if (!connection) return null;
  if (typeof connection.blockedMessage === 'string' && connection.blockedMessage.trim()) {
    return connection.blockedMessage;
  }
  return connection.blocked ? 'algo está bloqueando o caminho' : null;
}

function lineUsesGestureAnimation(line) {
  const text = String(line?.text || '');
  return text.includes('?') || text.length <= 34;
}

function playerCutsceneAnimationForLine(line, firstPlayerLineIndex) {
  if (line?.actor !== 'player') return null;
  if (line.index === firstPlayerLineIndex) {
    return {
      animation: NURSERY_WAKE_ANIMATION,
      duration: NURSERY_WAKE_ANIMATION_DURATION,
    };
  }

  if (lineUsesGestureAnimation(line)) {
    return {
      animation: NURSERY_GESTURE_ANIMATION,
      duration: Math.min(NURSERY_GESTURE_ANIMATION_DURATION, line.duration || NURSERY_GESTURE_ANIMATION_DURATION),
    };
  }

  return {
    animation: NURSERY_IDLE_TALK_ANIMATION,
    duration: line.duration || NURSERY_GESTURE_ANIMATION_DURATION,
  };
}

function characteristicKeys() {
  return Object.keys(CHARACTERISTIC_DEFINITIONS);
}

function createDefaultCharacteristics() {
  return Object.fromEntries(characteristicKeys().map((key) => [key, 0]));
}

function toNonNegativeInteger(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function randomBetween(min, max) {
  return min + Math.random() * Math.max(0, max - min);
}

function playerLevel(player) {
  return Math.max(1, Math.floor(player?.level || 1));
}

function playerCharacterType(player) {
  return player?.characterType || player?.type || 'mage';
}

function boardKey(x, y) {
  return `${x},${y}`;
}

function isInsideCombatArena(cell, bounds = COMBAT_ARENA_BOUNDS) {
  return (
    Number.isInteger(cell?.x) &&
    Number.isInteger(cell?.y) &&
    cell.x >= 0 &&
    cell.x < bounds.width &&
    cell.y >= 0 &&
    cell.y < bounds.height
  );
}

function combatNeighborCells(cell, bounds = COMBAT_ARENA_BOUNDS) {
  return [
    { x: cell.x, y: cell.y - 1 },
    { x: cell.x + 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x - 1, y: cell.y },
  ].filter((neighbor) => isInsideCombatArena(neighbor, bounds));
}

function reserveCombatStartArea(reserved, cell, bounds = COMBAT_ARENA_BOUNDS) {
  if (!isInsideCombatArena(cell, bounds)) return;

  reserved.add(posKey(cell));
  combatNeighborCells(cell, bounds).forEach((neighbor) => reserved.add(posKey(neighbor)));
}

function combatWallReservedKeys(playerStart, monsterPositions, bounds = COMBAT_ARENA_BOUNDS) {
  const reserved = new Set();
  reserveCombatStartArea(reserved, playerStart, bounds);
  monsterPositions.forEach((position) => reserveCombatStartArea(reserved, position, bounds));
  return reserved;
}

function combatWallCandidates(reserved, bounds = COMBAT_ARENA_BOUNDS) {
  const candidates = [];

  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const key = boardKey(x, y);
      if (!reserved.has(key)) candidates.push([x, y]);
    }
  }

  return candidates;
}

function hasClosedWallCorner(wallKeys, bounds = COMBAT_ARENA_BOUNDS) {
  const cornerPairs = [
    [[0, -1], [1, 0]],
    [[1, 0], [0, 1]],
    [[0, 1], [-1, 0]],
    [[-1, 0], [0, -1]],
  ];

  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const key = boardKey(x, y);
      if (wallKeys.has(key)) continue;

      for (const [first, second] of cornerPairs) {
        const firstCell = { x: x + first[0], y: y + first[1] };
        const secondCell = { x: x + second[0], y: y + second[1] };
        if (
          isInsideCombatArena(firstCell, bounds) &&
          isInsideCombatArena(secondCell, bounds) &&
          wallKeys.has(posKey(firstCell)) &&
          wallKeys.has(posKey(secondCell))
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function combatWallsKeepArenaOpen(wallKeys, requiredCells, bounds = COMBAT_ARENA_BOUNDS) {
  const start = requiredCells.find((cell) => isInsideCombatArena(cell, bounds));
  if (!start || wallKeys.has(posKey(start))) return false;

  const { dist } = dijkstra(start, wallKeys, bounds);
  const openCellCount = (bounds.width * bounds.height) - wallKeys.size;

  if (dist.size !== openCellCount) return false;
  return requiredCells.every((cell) => !isInsideCombatArena(cell, bounds) || dist.has(posKey(cell)));
}

function combatWallsKeepSpawnLinesOpen(wallKeys, requiredCells) {
  const [playerStart, ...monsterPositions] = requiredCells;
  if (!playerStart) return false;

  return monsterPositions.every((position) => hasLineOfSight(playerStart, position, wallKeys, new Set()));
}

function isValidCombatWallLayout(wallPairs, reservedKeys, requiredCells, bounds = COMBAT_ARENA_BOUNDS) {
  const wallKeys = coordinatePairsToSet(wallPairs);
  if (wallKeys.size !== wallPairs.length) return false;

  for (const [x, y] of wallPairs) {
    const cell = { x, y };
    if (!isInsideCombatArena(cell, bounds)) return false;
    if (reservedKeys.has(posKey(cell))) return false;
  }

  if (hasClosedWallCorner(wallKeys, bounds)) return false;
  if (!combatWallsKeepSpawnLinesOpen(wallKeys, requiredCells)) return false;
  return combatWallsKeepArenaOpen(wallKeys, requiredCells, bounds);
}

function normalizeCombatWallPairs(walls) {
  if (!Array.isArray(walls)) return null;

  const result = [];
  const seen = new Set();

  for (const wall of walls) {
    if (!Array.isArray(wall) || wall.length < 2) continue;
    const x = Math.floor(wall[0]);
    const y = Math.floor(wall[1]);
    const cell = { x, y };
    const key = posKey(cell);
    if (!isInsideCombatArena(cell) || seen.has(key)) continue;
    seen.add(key);
    result.push([x, y]);
    if (result.length >= OVERWORLD_COMBAT_WALL_COUNT) break;
  }

  return result.length > 0 ? result : null;
}

function generateRandomCombatWalls(level, monsterPositions) {
  const requiredCells = [level.start, ...monsterPositions];
  const reservedKeys = combatWallReservedKeys(level.start, monsterPositions);
  const candidates = combatWallCandidates(reservedKeys);

  for (let attempt = 0; attempt < COMBAT_WALL_GENERATION_ATTEMPTS; attempt += 1) {
    const available = [...candidates];
    const walls = [];

    while (walls.length < OVERWORLD_COMBAT_WALL_COUNT && available.length > 0) {
      const index = Math.min(available.length - 1, Math.floor(Math.random() * available.length));
      const [candidate] = available.splice(index, 1);
      const nextWalls = [...walls, candidate];

      if (isValidCombatWallLayout(nextWalls, reservedKeys, requiredCells)) {
        walls.push(candidate);
      }
    }

    if (walls.length === OVERWORLD_COMBAT_WALL_COUNT) return walls;
  }

  const fallbackWalls = (level.walls || [])
    .filter(([x, y]) => !reservedKeys.has(boardKey(x, y)))
    .slice(0, OVERWORLD_COMBAT_WALL_COUNT);

  return isValidCombatWallLayout(fallbackWalls, reservedKeys, requiredCells)
    ? fallbackWalls.map(([x, y]) => [x, y])
    : [];
}

function basicAttackForPlayer(player) {
  const equipped = {
    ...ACTION_RULES.BASIC_ATTACK,
    ...(player?.attackSlot || {}),
  };

  if (equipped.id === ACTION_RULES.BASIC_ATTACK.id) {
    equipped.element = ACTION_RULES.BASIC_ATTACK.element;
    equipped.lifeSteal = ACTION_RULES.BASIC_ATTACK.lifeSteal;
    equipped.iconKey = ACTION_RULES.BASIC_ATTACK.iconKey;
    equipped.pattern = ACTION_RULES.BASIC_ATTACK.pattern;
    equipped.minRange = ACTION_RULES.BASIC_ATTACK.minRange;
  }

  return equipped;
}

function spellBookForPlayer(player) {
  const level = playerLevel(player);
  const characterType = playerCharacterType(player);
  const classSpells = SPELL_DEFINITIONS[characterType] || [];

  return [
    {
      ...basicAttackForPlayer(player),
      unlockLevel: 1,
      locked: false,
      source: 'basic',
    },
    ...classSpells.map((spell) => ({
      ...spell,
      unlockLevel: toNonNegativeInteger(spell.unlockLevel, 1) || 1,
      locked: level < (toNonNegativeInteger(spell.unlockLevel, 1) || 1),
      source: characterType,
    })),
  ];
}

function playerAttackModelActionFor(attack) {
  const spellAction = PLAYER_SPELL_MODEL_ACTIONS[attack?.id];
  if (spellAction) {
    return {
      ...spellAction,
      projectile: spellAction.projectile ? { ...spellAction.projectile } : null,
    };
  }

  return {
    animation: PLAYER_ATTACK_ANIMATION,
    duration: TIMING.PLAYER_ATTACK_ANIMATION,
    impactDelay: TIMING.ATTACK_BUMP_DURATION,
  };
}

export function createGameActions(state) {

  function getGame() {
    return state.game;
  }

  function setGame(nextGame) {
    clearOverworldRespawnTimers(state.game);

    if (heroTurnTimeoutId !== null) {
      window.clearTimeout(heroTurnTimeoutId);
      heroTurnTimeoutId = null;
    }

    state.game = nextGame;
    if (nextGame && isCombatMode(nextGame) && nextGame.phase === PHASES.HERO) {
      primeHeroTurnClock(nextGame);
    } else if (nextGame) {
      nextGame.heroTurnStartedAt = null;
      nextGame.heroTurnEndsAt = null;
    }
    syncGameMusic(nextGame);

    return state.game;
  }

  function isCombatMode(game = getGame()) {
    return game.mode === GAME_MODES.COMBAT || game.mode === GAME_MODES.DUNGEON_LEGACY || !game.mode;
  }

  function combatWallsSet(game = getGame()) {
    return levelWallsSet(game.levelIndex, game.combatWalls);
  }

  function isOverworldMode(game = getGame()) {
    return game.mode === GAME_MODES.OVERWORLD;
  }

  function syncGameMusic(game = getGame()) {
    if (isOverworldMode(game)) {
      playOverworldMusic();
    } else if (game.mode === GAME_MODES.COMBAT || game.mode === GAME_MODES.DUNGEON_LEGACY) {
      playCombatMusic();
    } else {
      stopOverworldMusic();
      stopCombatMusic();
    }
  }

  function updateOverworldMusicVolume(volume) {
    const nextVolume = setOverworldMusicVolume(volume);
    syncGameMusic();
    return nextVolume;
  }

  function setEvent(text) {
    const game = getGame();
    game.lastEvent = text;
    if (!game.eventLog) game.eventLog = [];
    game.eventLog.push(text);
    if (game.eventLog.length > 5) game.eventLog.shift();
  }

  function showBanner(title, subtitle = '', duration = 900, after = null, options = {}) {
    getGame().banner = {
      title,
      subtitle,
      until: performance.now() + duration,
      ...options,
    };

    window.setTimeout(() => {
      const game = getGame();
      if (game.banner && game.banner.title === title) game.banner = null;
      if (after) after();
    }, duration);
  }

  function showTurnBanner(title, subtitle, cardKey, accent = '#d39b32') {
    showBanner(title, subtitle, TIMING.TURN_BANNER, null, {
      cardKey,
      accent,
    });
  }

  function normalizeOverworldHeroPath(overworld) {
    if (!overworld) return [];

    const heroPath = Array.isArray(overworld.heroPath)
      ? overworld.heroPath.filter((mapId) => typeof mapId === 'string' && !!getWorldMap(mapId))
      : [];
    if (typeof overworld.currentMapId === 'string' && getWorldMap(overworld.currentMapId)) {
      if (heroPath.length === 0 || heroPath[heroPath.length - 1] !== overworld.currentMapId) {
        heroPath.push(overworld.currentMapId);
      }
    }

    overworld.heroPath = heroPath.slice(-500);
    return overworld.heroPath;
  }

  function recordOverworldHeroMapVisit(overworld, mapId) {
    if (!overworld || typeof mapId !== 'string' || !getWorldMap(mapId)) return [];

    const heroPath = normalizeOverworldHeroPath(overworld);
    if (heroPath[heroPath.length - 1] !== mapId) heroPath.push(mapId);
    overworld.heroPath = heroPath.slice(-500);
    return overworld.heroPath;
  }

  function clearCutsceneAnimations(game = getGame()) {
    game.animations = (game.animations || []).filter((animation) => {
      return animation.cutsceneId !== NURSERY_INTRO_ID;
    });
  }

  function startOverworldAtMap(mapId) {
    const map = getWorldMap(mapId);
    if (!map) return false;

    const nextGame = createOverworldGame(map);
    nextGame.cutscene = null;
    nextGame.player.x = map.playerStart.x;
    nextGame.player.y = map.playerStart.y;
    nextGame.player.facing = { x: 0, y: -1 };
    nextGame.animations = [];
    nextGame.busy = false;
    setGame(nextGame);
    setEvent(`Entrou em ${map.name}.`);
    return true;
  }

  function showPlayerSpeech(text, duration = OVERWORLD_BLOCKED_CONNECTION_SPEECH_DURATION) {
    const game = getGame();
    if (!text || !game?.player) return false;

    game.animations = (game.animations || []).filter((animation) => {
      return animation.type !== 'speechBubble' || animation.entityId !== 'player';
    });
    game.animations.push({
      type: 'speechBubble',
      entityId: 'player',
      x: game.player.x,
      y: game.player.y,
      text,
      startTime: performance.now(),
      duration,
    });
    return true;
  }

  function scheduleNurseryCutsceneAnimations(game, cutscene) {
    const lines = Array.isArray(cutscene?.lines) ? cutscene.lines : [];
    const firstPlayerLine = lines.find((line) => line.actor === 'player') || null;
    clearCutsceneAnimations(game);

    if (firstPlayerLine) {
      game.animations.push({
        type: 'modelAction',
        entityId: 'player',
        animation: NURSERY_FALLEN_ANIMATION,
        sourceX: game.player.x,
        sourceY: game.player.y,
        targetX: game.player.x,
        targetY: game.player.y,
        startTime: cutscene.startedAt,
        duration: Math.max(1, firstPlayerLine.startTime - cutscene.startedAt),
        cutsceneId: NURSERY_INTRO_ID,
      });
    }

    for (const line of lines) {
      const action = playerCutsceneAnimationForLine(line, firstPlayerLine?.index);
      if (!action) continue;

      game.animations.push({
        type: 'modelAction',
        entityId: 'player',
        animation: action.animation,
        sourceX: game.player.x,
        sourceY: game.player.y,
        targetX: game.player.x,
        targetY: game.player.y,
        startTime: line.startTime,
        duration: Math.max(1, action.duration),
        cutsceneId: NURSERY_INTRO_ID,
      });
    }
  }

  function startNurseryCutscene() {
    let game = getGame();
    if (!isOverworldMode(game) || game.overworld?.currentMapId !== NURSERY_INTRO_MAP_ID) {
      if (!startOverworldAtMap(NURSERY_INTRO_MAP_ID)) return false;
      game = getGame();
    }

    const map = getWorldMap(NURSERY_INTRO_MAP_ID);
    if (!map) return false;

    ensureOverworldMapState(game.overworld, map.id);
    game.mode = GAME_MODES.OVERWORLD;
    game.phase = PHASES.HERO;
    game.overworld.currentMapId = map.id;
    game.player.x = map.playerStart.x;
    game.player.y = map.playerStart.y;
    game.player.facing = { x: 0, y: -1 };
    game.monsters = [];
    game.combatContext = null;
    game.combatWalls = null;
    game.turnQueue = ['player'];
    game.turnCount = 0;
    game.speedRemaining = game.player.speedBase;
    game.apRemaining = game.player.apMax;
    game.selectedEntity = null;
    game.selectedAttackId = null;
    game.draggingDie = null;
    game.draggingControl = null;
    game.activeModal = null;
    game.menuOpen = false;
    game.mapTransition = null;
    game.banner = null;
    game.busy = true;
    recordOverworldHeroMapVisit(game.overworld, map.id);

    const cutscene = createNurseryIntroCutscene(performance.now());
    game.cutscene = cutscene;
    scheduleNurseryCutsceneAnimations(game, cutscene);
    setEvent('Cena inicial: O Berçário.');
    return true;
  }

  function finishNurseryCutscene(game = getGame()) {
    if (!game.cutscene || game.cutscene.id !== NURSERY_INTRO_ID) return false;

    game.cutscene = null;
    game.busy = false;
    game.player.facing = { x: 1, y: 0 };
    clearCutsceneAnimations(game);
    setEvent('A passagem do Berçário está aberta.');
    return true;
  }

  function advanceCutscene(now = performance.now()) {
    const game = getGame();
    const cutscene = game.cutscene;
    if (!cutscene || cutscene.id !== NURSERY_INTRO_ID || !Array.isArray(cutscene.lines)) return false;

    const activeLine = activeNurseryIntroLine(cutscene, now);
    const currentLine = activeLine || cutscene.lines[cutscene.currentLineIndex] || cutscene.lines[0];
    const currentIndex = Math.max(0, currentLine?.index ?? cutscene.currentLineIndex ?? 0);
    if (currentIndex >= cutscene.lines.length - 1) {
      return finishNurseryCutscene(game);
    }

    const current = cutscene.lines[currentIndex];
    const next = cutscene.lines[currentIndex + 1];
    const nextStartTime = now + NURSERY_INTRO_LINE_GAP;
    const delta = Math.max(0, next.startTime - nextStartTime);

    current.endTime = Math.min(current.endTime, now);
    if (delta > 0) {
      for (let index = currentIndex + 1; index < cutscene.lines.length; index += 1) {
        cutscene.lines[index].startTime -= delta;
        cutscene.lines[index].endTime -= delta;
      }
      cutscene.endsAt -= delta;

      for (const animation of game.animations || []) {
        if (animation.cutsceneId !== NURSERY_INTRO_ID) continue;
        const animationEnd = animation.startTime + Math.max(0, animation.duration || 0);
        if (animation.startTime > now) {
          animation.startTime -= delta;
        } else if (animationEnd > nextStartTime) {
          animation.duration = Math.max(1, nextStartTime - animation.startTime);
        }
      }
    }

    cutscene.currentLineIndex = currentIndex + 1;
    return true;
  }

  function skipCutscene() {
    return finishNurseryCutscene(getGame());
  }

  function tickCutscene(now = performance.now()) {
    const game = getGame();
    const cutscene = game.cutscene;
    if (!cutscene || cutscene.id !== NURSERY_INTRO_ID) return false;

    if (now >= cutscene.endsAt) {
      finishNurseryCutscene(game);
      return true;
    }

    const activeLine = activeNurseryIntroLine(cutscene, now);
    if (activeLine) cutscene.currentLineIndex = activeLine.index;
    return true;
  }

  function getEquippedAttack(game = getGame()) {
    return basicAttackForPlayer(game.player);
  }

  function getPlayerSpellbook(player = getGame().player) {
    return spellBookForPlayer(player);
  }

  function getAvailableAttacks(game = getGame()) {
    return getPlayerSpellbook(game.player).filter((attack) => !attack.locked);
  }

  function getAttackById(attackId, game = getGame()) {
    return getAvailableAttacks(game).find((attack) => attack.id === attackId) || null;
  }

  function getSelectedAttack(game = getGame()) {
    if (!game.selectedAttackId) return null;
    return getAttackById(game.selectedAttackId, game);
  }

  function getXpProgress(player = getGame().player) {
    const experience = toNonNegativeInteger(player?.experience);
    const level = Math.max(
      Math.max(1, Math.floor(player?.level || 1)),
      levelFromExperience(experience)
    );
    const currentLevelXp = totalXpForLevel(level);
    const nextLevelXp = currentLevelXp + levelXpRequirement(level);

    return {
      level,
      experience,
      currentLevelXp,
      nextLevelXp,
      progressXp: Math.max(0, experience - currentLevelXp),
      requiredXp: nextLevelXp - currentLevelXp,
      progress: nextLevelXp > currentLevelXp
        ? Math.max(0, Math.min(1, (experience - currentLevelXp) / (nextLevelXp - currentLevelXp)))
        : 1,
    };
  }

  function getElementalDamageBonus(element, player = getGame().player) {
    if (!element || element === SPELL_ELEMENTS.NEUTRAL) return 0;

    const definition = Object.values(CHARACTERISTIC_DEFINITIONS).find((item) => item.element === element);
    if (!definition) return 0;

    const points = toNonNegativeInteger(player?.characteristics?.[definition.key]);
    return points * XP_RULES.ELEMENT_DAMAGE_PER_POINT;
  }

  function getAttackDamage(attack, player = getGame().player) {
    const baseDamage = toNonNegativeInteger(attack?.damage);
    return baseDamage + getElementalDamageBonus(attack?.element, player);
  }

  function getMitigatedDamage(rawDamage, defense) {
    return Math.max(0, rawDamage - Math.max(0, defense));
  }

  function attackEffects(attack) {
    return attack?.effects && typeof attack.effects === 'object' ? attack.effects : {};
  }

  function splashDamageEffect(attack) {
    const effect = attackEffects(attack).splashDamage;
    if (!effect || typeof effect !== 'object') return null;

    const ratio = Number.isFinite(effect.ratio) ? Math.max(0, effect.ratio) : 0;
    const radius = toNonNegativeInteger(effect.radius, 1) || 1;
    return ratio > 0 ? { ratio, radius } : null;
  }

  function moveTargetEffect(attack) {
    const effect = attackEffects(attack).moveTarget;
    if (!effect || typeof effect !== 'object') return null;

    const direction = effect.direction === 'pull' ? 'pull' : effect.direction === 'push' ? 'push' : null;
    const distance = toNonNegativeInteger(effect.distance, 1) || 1;
    return direction ? { direction, distance } : null;
  }

  function nextTurnApBonusEffect(attack) {
    const effect = attackEffects(attack).nextTurnApBonus;
    if (!effect || typeof effect !== 'object') return null;

    const amount = toNonNegativeInteger(effect.amount);
    const maxBonus = Math.max(amount, toNonNegativeInteger(effect.maxBonus, amount));
    return amount > 0 ? { amount, maxBonus } : null;
  }

  function queueNextTurnApBonus(attack, game = getGame()) {
    const effect = nextTurnApBonusEffect(attack);
    if (!effect) return 0;

    const currentAmount = toNonNegativeInteger(game.pendingNextTurnApBonus);
    const currentCap = toNonNegativeInteger(game.pendingNextTurnApBonusCap);
    const cap = Math.max(currentCap, effect.maxBonus);
    const nextAmount = Math.min(cap, currentAmount + effect.amount);
    game.pendingNextTurnApBonus = nextAmount;
    game.pendingNextTurnApBonusCap = cap;
    return Math.max(0, nextAmount - currentAmount);
  }

  function consumeNextTurnApBonus(game = getGame()) {
    const amount = toNonNegativeInteger(game.pendingNextTurnApBonus);
    const cap = toNonNegativeInteger(game.pendingNextTurnApBonusCap);
    const bonus = Math.min(amount, cap);
    game.pendingNextTurnApBonus = 0;
    game.pendingNextTurnApBonusCap = 0;
    return bonus;
  }

  function resetNextTurnApBonus(game = getGame()) {
    game.pendingNextTurnApBonus = 0;
    game.pendingNextTurnApBonusCap = 0;
  }

  function combatOccupiedKeys(game, exceptMonsterId = null) {
    const occupied = monsterOccupiedKeys(game.monsters, exceptMonsterId);
    occupied.add(posKey(game.player));
    return occupied;
  }

  function splashTargetsForAttack(game, originCell, primaryTarget, effect) {
    if (!effect) return [];

    return game.monsters.filter((monster) => {
      if (monster.hp <= 0 || monster.id === primaryTarget.id) return false;
      const distance = Math.abs(monster.x - originCell.x) + Math.abs(monster.y - originCell.y);
      return distance > 0 && distance <= effect.radius;
    });
  }

  function movementStepForTargetEffect(game, target, effect) {
    const fromPlayerX = Math.sign(target.x - game.player.x);
    const fromPlayerY = Math.sign(target.y - game.player.y);
    if (fromPlayerX === 0 && fromPlayerY === 0) return null;

    const directionMultiplier = effect.direction === 'pull' ? -1 : 1;
    return {
      x: fromPlayerX * directionMultiplier,
      y: fromPlayerY * directionMultiplier,
    };
  }

  function moveTargetByEffect(game, target, attack, attackStartTime, impactDelay) {
    const effect = moveTargetEffect(attack);
    if (!effect || !target || target.hp <= 0) return { moved: 0, path: null };

    const step = movementStepForTargetEffect(game, target, effect);
    if (!step) return { moved: 0, path: null };

    const walls = combatWallsSet(game);
    const occupied = combatOccupiedKeys(game, target.id);
    const path = [{ x: target.x, y: target.y }];

    for (let index = 0; index < effect.distance; index += 1) {
      const next = { x: target.x + step.x, y: target.y + step.y };
      const key = posKey(next);
      if (!isInsideCombatArena(next) || walls.has(key) || occupied.has(key)) break;

      target.x = next.x;
      target.y = next.y;
      path.push(next);
    }

    const moved = path.length - 1;
    if (moved <= 0) return { moved: 0, path: null };

    game.animations.push({
      type: 'movement',
      entityId: target.id,
      path,
      startTime: attackStartTime + impactDelay + 90,
      durationPerTile: TIMING.MONSTER_MOVE_SPEED,
    });

    return { moved, path };
  }

  function getAttackRangeBounds(attack, player = getGame().player) {
    const minRange = Math.max(0, toNonNegativeInteger(attack?.minRange, 1));
    const maxRange = Number.isFinite(attack?.maxRange)
      ? Math.max(minRange, Math.floor(attack.maxRange))
      : Math.max(minRange, toNonNegativeInteger(player?.rangeBase, 1));

    return { minRange, maxRange };
  }

  function getAttackRangeLabel(attack, player = getGame().player) {
    const { minRange, maxRange } = getAttackRangeBounds(attack, player);
    return minRange === maxRange ? String(maxRange) : `${minRange}~${maxRange}`;
  }

  function canAttackCellWith(attack, targetCell, walls, blockers, blocked) {
    const game = getGame();
    const { minRange, maxRange } = getAttackRangeBounds(attack, game.player);
    const dx = Math.abs(targetCell.x - game.player.x);
    const dy = Math.abs(targetCell.y - game.player.y);

    if (attack?.pattern === ATTACK_PATTERNS.LINE_8) {
      const isStraight = dx === 0 || dy === 0;
      const isDiagonal = dx === dy;
      if (!isStraight && !isDiagonal) return false;

      const rangeCost = Math.max(dx, dy);
      if (rangeCost < minRange || rangeCost > maxRange) return false;
      return hasLineOfSight(game.player, targetCell, walls, blockers);
    }

    if (attack?.pattern === ATTACK_PATTERNS.CROSS) {
      const rangeCost = dx + dy;
      if (dx !== 0 && dy !== 0) return false;
      if (rangeCost < minRange || rangeCost > maxRange) return false;
      return hasLineOfSight(game.player, targetCell, walls, blockers);
    }

    const rangeCost = distanceBetween(game.player, targetCell, blocked, true);
    return rangeCost >= minRange
      && rangeCost <= maxRange
      && hasLineOfSight(game.player, targetCell, walls, blockers);
  }

  function normalizePlayerProgress(player) {
    if (!player || typeof player !== 'object') return player;

    const characteristics = createDefaultCharacteristics();
    for (const key of characteristicKeys()) {
      characteristics[key] = toNonNegativeInteger(player.characteristics?.[key]);
    }

    player.characteristics = characteristics;
    player.experience = toNonNegativeInteger(player.experience);
    player.level = Math.max(
      Number.isFinite(player.level) ? Math.max(1, Math.floor(player.level)) : 1,
      levelFromExperience(player.experience)
    );
    player.characteristicPoints = toNonNegativeInteger(player.characteristicPoints);

    const lifeFloor = 60 + characteristics.life * XP_RULES.LIFE_PER_POINT;
    player.maxHealth = Math.max(lifeFloor, Number.isFinite(player.maxHealth) ? player.maxHealth : lifeFloor);
    player.health = Number.isFinite(player.health)
      ? Math.max(0, Math.min(player.maxHealth, player.health))
      : player.maxHealth;

    return player;
  }

  function openCharacteristicsModal() {
    const game = getGame();
    game.menuOpen = false;
    game.activeModal = 'characteristics';
  }

  function openSpellsModal() {
    const game = getGame();
    game.menuOpen = false;
    game.activeModal = 'spells';
  }

  function ensureWorldMapModalState() {
    if (!state.worldMapModal) state.worldMapModal = {};
    if (typeof state.worldMapModal.showHeroPath !== 'boolean') {
      state.worldMapModal.showHeroPath = false;
    }
    return state.worldMapModal;
  }

  function openWorldMapModal() {
    const game = getGame();
    if (!isOverworldMode(game)) return false;

    game.menuOpen = false;
    game.activeModal = 'worldMap';
    ensureWorldMapModalState().showHeroPath = false;
    normalizeOverworldHeroPath(game.overworld);
    return true;
  }

  function toggleWorldMapModal() {
    const game = getGame();
    if (game.activeModal === 'worldMap') {
      closeActiveModal();
      return true;
    }

    if (game.activeModal || game.menuOpen || game.cutscene) return false;
    return openWorldMapModal();
  }

  function toggleWorldMapHeroPath() {
    const game = getGame();
    if (game.activeModal !== 'worldMap') return false;

    const worldMapModal = ensureWorldMapModalState();
    worldMapModal.showHeroPath = !worldMapModal.showHeroPath;
    normalizeOverworldHeroPath(game.overworld);
    return true;
  }

  function closeActiveModal() {
    const game = getGame();
    if (game.activeModal === 'levelUp') game.levelUpNotice = null;
    game.activeModal = null;
  }

  function allocateCharacteristic(kind) {
    const game = getGame();
    const definition = CHARACTERISTIC_DEFINITIONS[kind];
    if (!definition || game.player.characteristicPoints <= 0) return false;

    normalizePlayerProgress(game.player);
    if (game.player.characteristicPoints <= 0) return false;

    game.player.characteristics[kind] += 1;
    game.player.characteristicPoints -= 1;

    if (kind === 'life') {
      game.player.maxHealth += XP_RULES.LIFE_PER_POINT;
      game.player.health = Math.min(game.player.maxHealth, game.player.health + XP_RULES.LIFE_PER_POINT);
    }

    persistPlayerProgress(game.player);
    setEvent(`${definition.label}: +1 característica.`);
    return true;
  }

  function shouldOpenLevelUpModal(game) {
    return game.mode === GAME_MODES.COMBAT && game.combatContext?.origin === GAME_MODES.OVERWORLD;
  }

  function applyDebugHeroConfig(config = {}) {
    const game = getGame();
    if (!game?.player) return false;

    const characteristics = createDefaultCharacteristics();
    for (const key of characteristicKeys()) {
      characteristics[key] = toNonNegativeInteger(config.characteristics?.[key]);
    }

    const level = Math.max(1, Math.floor(Number(config.level) || game.player.level || 1));
    const earnedPoints = Math.max(0, level - 1) * XP_RULES.POINTS_PER_LEVEL;
    const spentPoints = Object.values(characteristics).reduce((sum, value) => sum + value, 0);
    const explicitFreePoints = Number.isFinite(config.characteristicPoints)
      ? toNonNegativeInteger(config.characteristicPoints)
      : null;
    const maxHealth = Math.max(
      60 + characteristics.life * XP_RULES.LIFE_PER_POINT,
      toNonNegativeInteger(config.maxHealth, game.player.maxHealth || 60),
    );

    Object.assign(game.player, {
      level,
      experience: totalXpForLevel(level),
      characteristicPoints: explicitFreePoints ?? Math.max(0, earnedPoints - spentPoints),
      characteristics,
      maxHealth,
      health: Math.max(0, Math.min(maxHealth, toNonNegativeInteger(config.health, game.player.health || maxHealth))),
      apMax: toNonNegativeInteger(config.apMax, game.player.apMax || ACTION_RULES.BASE_AP),
      speedBase: toNonNegativeInteger(config.speedBase, game.player.speedBase || 3),
      defenseBase: toNonNegativeInteger(config.defenseBase, 0),
      rangeBase: toNonNegativeInteger(config.rangeBase, game.player.rangeBase || 2),
    });
    game.apRemaining = Math.max(0, Math.min(game.player.apMax, toNonNegativeInteger(config.apRemaining, game.apRemaining)));
    game.speedRemaining = Math.max(0, Math.min(game.player.speedBase, toNonNegativeInteger(config.speedRemaining, game.speedRemaining)));
    normalizePlayerProgress(game.player);
    persistPlayerProgress(game.player);
    setEvent(`Hero atualizado: nivel ${game.player.level}.`);
    return true;
  }

  function grantMonsterExperience(monster) {
    const game = getGame();
    if (!monster || monster.xpGranted) return { xp: 0, levelsGained: 0, pointsGained: 0 };

    const template = MONSTER_TEMPLATES[normalizeMonsterType(monster.type)] || {};
    const xp = toNonNegativeInteger(monster.xp, toNonNegativeInteger(template.xp));
    monster.xpGranted = true;
    if (xp <= 0) return { xp: 0, levelsGained: 0, pointsGained: 0 };

    normalizePlayerProgress(game.player);
    const previousLevel = game.player.level;
    game.player.experience += xp;
    const nextLevel = levelFromExperience(game.player.experience);
    const levelsGained = Math.max(0, nextLevel - previousLevel);
    const pointsGained = levelsGained * XP_RULES.POINTS_PER_LEVEL;

    if (levelsGained > 0) {
      game.player.level = nextLevel;
      game.player.characteristicPoints += pointsGained;
      game.player.health = game.player.maxHealth;
      game.levelUpNotice = {
        levelsGained,
        pointsGained,
      };

      if (shouldOpenLevelUpModal(game)) {
        game.activeModal = 'levelUp';
      } else {
        showBanner('Você passou de nível', `+${pointsGained} pontos de característica.`, 2200, null, {
          cardKey: 'player',
          accent: '#e6c06f',
        });
      }
    }

    persistPlayerProgress(game.player);
    return { xp, levelsGained, pointsGained };
  }

  function samePendingExperienceMonster(left, right) {
    if (!left || !right) return false;
    return left === right || (!!left.id && left.id === right.id);
  }

  function pendingCombatExperienceMonsters(game = getGame()) {
    if (!Array.isArray(game.pendingCombatXp)) game.pendingCombatXp = [];
    return game.pendingCombatXp;
  }

  function queueCombatExperience(monster) {
    if (!monster || monster.xpGranted) return false;

    const pending = pendingCombatExperienceMonsters();
    if (pending.some((item) => samePendingExperienceMonster(item, monster))) return false;

    pending.push(monster);
    return true;
  }

  function combineExperienceResults(total, result) {
    return {
      xp: total.xp + result.xp,
      levelsGained: total.levelsGained + result.levelsGained,
      pointsGained: total.pointsGained + result.pointsGained,
    };
  }

  function grantPendingCombatExperience() {
    const game = getGame();
    const pending = pendingCombatExperienceMonsters(game).splice(0);

    return pending.reduce((total, monster) => {
      return combineExperienceResults(total, grantMonsterExperience(monster));
    }, { xp: 0, levelsGained: 0, pointsGained: 0 });
  }

  function combatExperienceText(result) {
    if (!result || result.xp <= 0) return '';

    const levelText = result.levelsGained > 0
      ? ` Nivel ${getGame().player.level}! +${result.pointsGained} pontos.`
      : '';

    return ` +${result.xp} XP.${levelText}`;
  }

  function primeHeroTurnClock(game = getGame(), now = performance.now()) {
    if (!game || !isCombatMode(game) || game.phase !== PHASES.HERO) return;

    if (heroTurnTimeoutId !== null) {
      window.clearTimeout(heroTurnTimeoutId);
      heroTurnTimeoutId = null;
    }

    game.heroTurnStartedAt = now;
    game.heroTurnEndsAt = now + TIMING.HERO_TURN_DURATION;

    heroTurnTimeoutId = window.setTimeout(() => {
      heroTurnTimeoutId = null;
      const currentGame = getGame();
      if (!isCombatMode(currentGame) || currentGame.phase !== PHASES.HERO) return;
      if (!Number.isFinite(currentGame.heroTurnEndsAt) || performance.now() < currentGame.heroTurnEndsAt) return;
      if (currentGame.busy) return;
      endHeroPhase();
    }, TIMING.HERO_TURN_DURATION);
  }

  function getHeroTurnTimer(now = performance.now()) {
    const game = getGame();
    if (!isCombatMode(game) || game.phase !== PHASES.HERO) return null;
    if (!Number.isFinite(game.heroTurnEndsAt)) return null;

    const remainingMs = Math.max(0, game.heroTurnEndsAt - now);

    return {
      remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      progress: Math.min(1, Math.max(0, remainingMs / TIMING.HERO_TURN_DURATION)),
    };
  }

  function tickOverworldHealthRegen(now = performance.now()) {
    const game = getGame();
    if (!game || game.mode !== GAME_MODES.OVERWORLD) return false;

    const player = game.player;
    if (!player || !Number.isFinite(player.maxHealth)) return false;

    player.health = Number.isFinite(player.health)
      ? Math.max(0, Math.min(player.maxHealth, Math.floor(player.health)))
      : player.maxHealth;

    if (player.health >= player.maxHealth) {
      game.nextOverworldHealthRegenAt = null;
      return false;
    }

    const interval = TIMING.OVERWORLD_HEALTH_REGEN_INTERVAL;
    if (!Number.isFinite(game.nextOverworldHealthRegenAt)) {
      game.nextOverworldHealthRegenAt = now + interval;
      return false;
    }

    if (now < game.nextOverworldHealthRegenAt) return false;

    const ticks = 1 + Math.floor((now - game.nextOverworldHealthRegenAt) / interval);
    player.health = Math.min(player.maxHealth, player.health + ticks);
    game.nextOverworldHealthRegenAt = player.health >= player.maxHealth
      ? null
      : game.nextOverworldHealthRegenAt + ticks * interval;

    return true;
  }

  function offlineHealthRegenAmount(player, elapsedMs) {
    if (!player || !Number.isFinite(player.maxHealth) || elapsedMs <= 0) return 0;

    const health = Number.isFinite(player.health)
      ? Math.max(0, Math.min(player.maxHealth, Math.floor(player.health)))
      : player.maxHealth;
    const missingHealth = Math.max(0, player.maxHealth - health);
    if (missingHealth <= 0) return 0;

    const elapsedRatio = Math.min(1, elapsedMs / OFFLINE_HEALTH_FULL_REGEN_TIME);
    return Math.min(missingHealth, Math.floor(player.maxHealth * elapsedRatio));
  }

  function applyOfflineHealthRegen(game, loadedGame, now = Date.now()) {
    if (!game || game.mode !== GAME_MODES.OVERWORLD) return 0;

    const savedAt = Number(loadedGame?.savedAt);
    if (!Number.isFinite(savedAt)) return 0;

    const elapsedMs = Math.max(0, now - savedAt);
    const restored = offlineHealthRegenAmount(game.player, elapsedMs);
    if (restored <= 0) return 0;

    game.player.health = Math.min(game.player.maxHealth, game.player.health + restored);
    game.nextOverworldHealthRegenAt = game.player.health >= game.player.maxHealth
      ? null
      : performance.now() + TIMING.OVERWORLD_HEALTH_REGEN_INTERVAL;

    return restored;
  }

  function startHeroTurn(message = null) {
    const game = getGame();

    game.phase = PHASES.HERO;
    game.roll = [];
    game.energyAssigned = { speed: null, attack: null, defense: null };
    game.assignment = { speed: 0, attack: 0, defense: 0 };
    game.speedRemaining = game.player.speedBase;
    const apBonus = consumeNextTurnApBonus(game);
    game.apRemaining = game.player.apMax + apBonus;
    game.draggingDie = null;
    game.selectedEntity = null;
    game.selectedAttackId = null;
    game.busy = false;
    primeHeroTurnClock(game);

    const bonusText = apBonus > 0 ? ` (+${apBonus} roubado)` : '';
    setEvent(message || `Sua vez. ${game.apRemaining} AP${bonusText}, ${game.speedRemaining} movimento.`);
  }

  function startEnergyTurn() {
    startHeroTurn('Vez iniciada sem rolagem de dados.');
  }

  function allDiceAssigned() {
    return false;
  }

  function assignedStatForDie(dieIndex) {
    const game = getGame();

    for (const stat of ['speed', 'attack', 'defense']) {
      if (game.energyAssigned[stat] === dieIndex) return stat;
    }

    return null;
  }

  function getOverworldBounds(overworld = getGame().overworld) {
    return getCurrentWorldBounds(overworld);
  }

  function getOverworldBlockedKeys(overworld = getGame().overworld) {
    return getWorldObjectBlockedKeys(overworld);
  }

  function getAliveOverworldEnemies(game = getGame()) {
    return getCurrentWorldEnemies(game.overworld).filter((enemy) => enemy.hp !== 0);
  }

  function aliveEnemiesForMapState(mapState) {
    return (mapState?.enemies || []).filter((enemy) => enemy.hp !== 0);
  }

  function clearOverworldRespawnTimers(game = getGame()) {
    for (const mapState of Object.values(game?.overworld?.mapStates || {})) {
      if (!mapState?.respawnTimerId) continue;

      window.clearTimeout(mapState.respawnTimerId);
      mapState.respawnTimerId = null;
      mapState.nextRespawnAt = null;
      mapState.pendingRespawnEnemies = [];
    }
  }

  function scheduleEmptyOverworldRespawns(game = getGame()) {
    for (const mapId of Object.keys(game?.overworld?.mapStates || {})) {
      scheduleOverworldEnemyRespawn(mapId);
    }
  }

  function scheduleNextOverworldEnemyRespawn(mapId, delay) {
    const game = getGame();
    const mapState = game.overworld?.mapStates?.[mapId];
    if (!mapState || mapState.respawnTimerId) return false;

    mapState.nextRespawnAt = performance.now() + delay;
    mapState.respawnTimerId = window.setTimeout(() => {
      spawnNextOverworldRespawnEnemy(mapId);
    }, delay);
    return true;
  }

  function spawnNextOverworldRespawnEnemy(mapId) {
    const currentGame = getGame();
    const currentMapState = currentGame.overworld?.mapStates?.[mapId];
    if (!currentMapState) return false;

    currentMapState.respawnTimerId = null;
    currentMapState.nextRespawnAt = null;
    if (!Array.isArray(currentMapState.enemies)) currentMapState.enemies = [];
    if (!Array.isArray(currentMapState.pendingRespawnEnemies)) {
      currentMapState.pendingRespawnEnemies = [];
    }

    const enemy = currentMapState.pendingRespawnEnemies.shift();
    if (!enemy) return false;

    currentMapState.enemies.push(enemy);
    if (currentGame.overworld?.currentMapId === mapId) {
      setEvent('Um inimigo apareceu no mapa.');
    }

    if (currentMapState.pendingRespawnEnemies.length > 0) {
      scheduleNextOverworldEnemyRespawn(
        mapId,
        randomBetween(TIMING.OVERWORLD_ENEMY_RESPAWN_STAGGER_MIN, TIMING.OVERWORLD_ENEMY_RESPAWN_STAGGER_MAX),
      );
    }

    return true;
  }

  function scheduleOverworldEnemyRespawn(mapId) {
    const game = getGame();
    const map = getWorldMap(mapId);
    const mapState = game.overworld?.mapStates?.[mapId];
    if (!map || map.randomEncounters === false || !mapState) return false;
    if (aliveEnemiesForMapState(mapState).length > 0 || mapState.respawnTimerId) return false;
    if (Array.isArray(mapState.pendingRespawnEnemies) && mapState.pendingRespawnEnemies.length > 0) return false;

    const wave = toNonNegativeInteger(mapState.enemyWave);
    mapState.pendingRespawnEnemies = overworldEnemies(map, wave);
    mapState.enemyWave = wave + 1;
    if (mapState.pendingRespawnEnemies.length === 0) return false;

    return scheduleNextOverworldEnemyRespawn(
      mapId,
      randomBetween(TIMING.OVERWORLD_ENEMY_RESPAWN_MIN, TIMING.OVERWORLD_ENEMY_RESPAWN_MAX),
    );
  }

  function getOverworldEnemyAt(cell) {
    const game = getGame();
    if (!isOverworldMode(game)) return null;

    return getAliveOverworldEnemies(game).find((enemy) => samePos(enemy, cell)) || null;
  }

  function getOverworldEnemyOccupiedKeys(exceptId = null) {
    const occupied = new Set();

    for (const enemy of getAliveOverworldEnemies()) {
      if (exceptId && enemy.id === exceptId) continue;
      occupied.add(posKey(enemy));
    }

    return occupied;
  }

  function getOverworldConnectionKeys(overworld = getGame().overworld) {
    const map = getCurrentWorldMap(overworld);
    return new Set((map?.connections || []).map((connection) => posKey(connection)));
  }

  function getOverworldPickupOccupiedKeys(overworld = getGame().overworld) {
    return new Set(getCurrentWorldPickups(overworld).map((pickup) => posKey(pickup)));
  }

  function ensureMapPickups(mapState) {
    if (!mapState) return [];
    if (!Array.isArray(mapState.pickups)) mapState.pickups = [];
    return mapState.pickups;
  }

  function randomPickupKind() {
    const golden = Math.random() < 0.1;
    if (golden) return Math.random() < 0.5 ? 'goldenApple' : 'goldenBread';
    return Math.random() < 0.55 ? 'apple' : 'bread';
  }

  function pickupDefinition(kind) {
    return OVERWORLD_PICKUP_DEFINITIONS[kind] || OVERWORLD_PICKUP_DEFINITIONS.apple;
  }

  function healAmountForPickup(pickup) {
    const definition = pickupDefinition(pickup?.kind);
    return Math.max(0, toNonNegativeInteger(definition.healAmount));
  }

  function pickupExpired(pickup, now = Date.now()) {
    if (!Number.isFinite(pickup?.createdAt)) return false;
    return now - pickup.createdAt >= OVERWORLD_PICKUP_LIFETIME;
  }

  function tickOverworldPickupExpiry(now = Date.now()) {
    const game = getGame();
    if (!isOverworldMode(game) || !game.overworld) return false;

    const mapState = getCurrentWorldMapState(game.overworld);
    const pickups = ensureMapPickups(mapState);
    const activePickups = pickups.filter((pickup) => !pickupExpired(pickup, now));
    if (activePickups.length === pickups.length) return false;

    mapState.pickups = activePickups;
    return true;
  }

  function collectOverworldPickupAt(cell) {
    const game = getGame();
    if (!isOverworldMode(game) || !game.overworld || !cell) return false;

    tickOverworldPickupExpiry();
    const mapState = getCurrentWorldMapState(game.overworld);
    const pickups = ensureMapPickups(mapState);
    const pickupIndex = pickups.findIndex((pickup) => samePos(pickup, cell));
    if (pickupIndex < 0) return false;

    const pickup = pickups[pickupIndex];
    const healAmount = healAmountForPickup(pickup);
    const definition = pickupDefinition(pickup.kind);
    if (game.player.health >= game.player.maxHealth || healAmount <= 0) {
      setEvent(`${definition.label}: sem efeito com a vida atual.`);
      return false;
    }

    const previousHealth = game.player.health;
    game.player.health = Math.min(game.player.maxHealth, game.player.health + healAmount);
    pickups.splice(pickupIndex, 1);

    const healed = game.player.health - previousHealth;
    game.animations.push({
      type: 'floatingText',
      x: game.player.x,
      y: game.player.y,
      text: `+${healed}`,
      color: pickup.kind?.startsWith('golden') ? '#facc15' : '#34d399',
      startTime: performance.now(),
      duration: 1200,
    });
    setEvent(`${definition.label}: vida restaurada para ${game.player.health}/${game.player.maxHealth}.`);
    return true;
  }

  function pickupDropCellsAround(origin, bounds) {
    const cells = [];
    for (let dy = -OVERWORLD_PICKUP_DROP_RADIUS; dy <= OVERWORLD_PICKUP_DROP_RADIUS; dy += 1) {
      for (let dx = -OVERWORLD_PICKUP_DROP_RADIUS; dx <= OVERWORLD_PICKUP_DROP_RADIUS; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        cells.push({ x: origin.x + dx, y: origin.y + dy, distance: Math.abs(dx) + Math.abs(dy) });
      }
    }
    cells.push({ x: origin.x, y: origin.y, distance: 0 });

    return cells
      .filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < bounds.width && cell.y < bounds.height)
      .sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return Math.random() - 0.5;
      });
  }

  function occupiedDropKeys(overworld, mapState, extraCells = []) {
    const occupied = new Set([
      ...getWorldObjectBlockedKeys(overworld),
      ...getOverworldConnectionKeys(overworld),
      ...(mapState?.enemies || []).filter((enemy) => enemy.hp !== 0).map((enemy) => posKey(enemy)),
      ...ensureMapPickups(mapState).map((pickup) => posKey(pickup)),
      ...extraCells.map((cell) => posKey(cell)),
    ]);

    occupied.add(posKey(getGame().player));
    return occupied;
  }

  function dropOverworldPickupForEnemy(mapState, enemy, extraCells = []) {
    const game = getGame();
    const map = getCurrentWorldMap(game.overworld);
    if (!mapState || !enemy || !map) return null;

    const bounds = getCurrentWorldBounds(game.overworld);
    const occupied = occupiedDropKeys(game.overworld, mapState, extraCells);
    const cell = pickupDropCellsAround(enemy, bounds).find((candidate) => !occupied.has(posKey(candidate)));
    if (!cell) return null;

    const pickupCounter = toNonNegativeInteger(mapState.pickupCounter);
    mapState.pickupCounter = pickupCounter + 1;
    const pickup = {
      id: `${map.id}-pickup-${pickupCounter}`,
      kind: randomPickupKind(),
      x: cell.x,
      y: cell.y,
      createdAt: Date.now(),
    };

    ensureMapPickups(mapState).push(pickup);
    return pickup;
  }

  function hasActiveMovementAnimation(entityId, now = performance.now()) {
    return (getGame().animations || []).some((animation) => {
      if (animation.type !== 'movement' || animation.entityId !== entityId) return false;
      const duration = Number.isFinite(animation.totalDuration)
        ? Math.max(0, animation.totalDuration)
        : Math.max(0, (animation.path?.length || 1) - 1) * Math.max(0, animation.durationPerTile || 0);
      return now >= animation.startTime && now < animation.startTime + duration;
    });
  }

  function enemyWanderBlockedKeys(enemy) {
    const game = getGame();
    const blocked = new Set([
      ...getOverworldBlockedKeys(game.overworld),
      ...getOverworldConnectionKeys(game.overworld),
      ...getOverworldPickupOccupiedKeys(game.overworld),
      ...getOverworldEnemyOccupiedKeys(enemy.id),
      posKey(game.player),
    ]);
    blocked.delete(posKey(enemy));
    return blocked;
  }

  function randomEnemyWanderPath(enemy) {
    const game = getGame();
    const blocked = enemyWanderBlockedKeys(enemy);
    const { dist, prev } = dijkstra(enemy, blocked, getOverworldBounds(game.overworld), { allowDiagonal: true });
    const preferred = [];
    const fallback = [];

    for (const [key, cost] of dist.entries()) {
      if (cost <= 0 || blocked.has(key)) continue;

      const cell = parseKey(key);
      const option = {
        cell,
        path: reconstructPath(prev, cell),
        cost,
      };
      if (cost >= OVERWORLD_ENEMY_WANDER_MIN_COST && cost <= OVERWORLD_ENEMY_WANDER_MAX_COST) {
        preferred.push(option);
      } else if (cost <= OVERWORLD_ENEMY_WANDER_MAX_COST) {
        fallback.push(option);
      }
    }

    const options = preferred.length > 0 ? preferred : fallback;
    if (options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)].path;
  }

  function scheduleEnemyNextWander(enemy, now, index = 0) {
    enemy.lastWanderAt = now;
    enemy.nextWanderAt = now
      + randomBetween(TIMING.OVERWORLD_ENEMY_WANDER_MIN, TIMING.OVERWORLD_ENEMY_WANDER_MAX)
      + index * OVERWORLD_ENEMY_WANDER_ENTITY_STAGGER;
  }

  function tickOverworldEnemyWander(now = performance.now()) {
    const game = getGame();
    if (!isOverworldMode(game) || !game.overworld || game.busy || game.cutscene || game.mapTransition) return false;
    if (game.activeModal || game.menuOpen) return false;

    const enemies = getAliveOverworldEnemies(game);
    let moved = false;

    enemies.forEach((enemy, index) => {
      if (hasActiveMovementAnimation(enemy.id, now)) return;

      if (!Number.isFinite(enemy.nextWanderAt)) {
        scheduleEnemyNextWander(enemy, now, index);
        return;
      }

      const idleFor = now - (Number.isFinite(enemy.lastWanderAt) ? enemy.lastWanderAt : now);
      if (now < enemy.nextWanderAt && idleFor < TIMING.OVERWORLD_ENEMY_WANDER_MAX_IDLE) return;

      const path = randomEnemyWanderPath(enemy);
      if (!path || path.length < 2) {
        scheduleEnemyNextWander(enemy, now, index);
        return;
      }

      const target = path[path.length - 1];
      const distance = pathDistance(path);
      const direction = finalDirectionFromPath(path);
      enemy.x = target.x;
      enemy.y = target.y;
      if (direction) enemy.facing = direction;

      game.animations.push({
        type: 'movement',
        entityId: enemy.id,
        path,
        startTime: now,
        totalDuration: distance * TIMING.OVERWORLD_PLAYER_MOVE_SPEED,
        totalDistance: distance,
      });
      scheduleEnemyNextWander(enemy, now, index);
      moved = true;
    });

    return moved;
  }

  function getOverworldMovementData() {
    const game = getGame();
    if (!isOverworldMode(game) || !game.overworld) {
      return { dist: new Map(), prev: new Map() };
    }

    const blocked = new Set([
      ...getOverworldBlockedKeys(game.overworld),
      ...getOverworldEnemyOccupiedKeys(),
    ]);
    blocked.delete(posKey(game.player));

    return dijkstra(game.player, blocked, getOverworldBounds(game.overworld), { allowDiagonal: true });
  }

  function getOverworldReachableTiles() {
    const game = getGame();
    if (!isOverworldMode(game) || game.busy) return new Map();

    const { dist, prev } = getOverworldMovementData();
    const reachable = new Map();

    for (const [key, cost] of dist.entries()) {
      if (cost === 0) continue;
      reachable.set(key, {
        cost,
        path: reconstructPath(prev, parseKey(key)),
      });
    }

    return reachable;
  }

  function getMovementData() {
    const game = getGame();
    if (!isCombatMode(game)) {
      return { dist: new Map(), prev: new Map() };
    }

    const blocked = new Set([
      ...combatWallsSet(game),
      ...monsterOccupiedKeys(game.monsters),
    ]);

    blocked.delete(posKey(game.player));
    return dijkstra(game.player, blocked);
  }

  function getReachableTiles() {
    const game = getGame();
    if (!isCombatMode(game) || game.phase !== PHASES.HERO || game.busy) return new Map();
    if (game.selectedAttackId) return new Map();

    const { dist, prev } = getMovementData();
    const reachable = new Map();

    for (const [key, cost] of dist.entries()) {
      if (cost === 0 || cost > game.speedRemaining) continue;
      reachable.set(key, {
        cost,
        path: reconstructPath(prev, parseKey(key)),
      });
    }

    return reachable;
  }

  function getMonsterReachableTiles(monsterId) {
    const game = getGame();
    if (!isCombatMode(game) || game.busy) return new Map();

    const monster = game.monsters.find((m) => m.id === monsterId);
    if (!monster || monster.hp <= 0) return new Map();

    const blockedForMove = new Set([
      ...combatWallsSet(game),
      posKey(game.player)
    ]);
    
    const { dist, prev } = dijkstra(monster, blockedForMove);
    const reachable = new Map();
    const occupied = monsterOccupiedKeys(game.monsters, monster.id);

    for (const [key, cost] of dist.entries()) {
      if (cost === 0 || cost > monster.speed) continue;
      if (occupied.has(key)) continue;
      
      reachable.set(key, {
        cost,
        path: reconstructPath(prev, parseKey(key)),
      });
    }

    return reachable;
  }

  function getMonsterAttackTiles(monsterId) {
    const game = getGame();
    if (!isCombatMode(game) || game.busy) return new Set();

    const monster = game.monsters.find((m) => m.id === monsterId);
    if (!monster || monster.hp <= 0) return new Set();

    const walls = combatWallsSet(game);
    const blockers = monsterOccupiedKeys(game.monsters, monster.id);
    const blocked = new Set([...walls, ...blockers]);
    const attackTiles = new Set();

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const cell = { x, y };
        const key = posKey(cell);

        if (walls.has(key)) continue;
        if (blockers.has(key)) continue;
        if (samePos(cell, monster)) continue;

        const rangeCost = distanceBetween(monster, cell, blocked, false);
        if (rangeCost <= monster.range && hasLineOfSight(monster, cell, walls, blockers)) {
          attackTiles.add(key);
        }
      }
    }

    return attackTiles;
  }

  function getPlayerAttackTiles() {
    const game = getGame();
    const attackTiles = new Set();
    if (!isCombatMode(game) || game.phase !== PHASES.HERO || game.busy) return attackTiles;

    const attack = getSelectedAttack(game);
    if (!attack || game.apRemaining < attack.apCost) return attackTiles;

    const walls = combatWallsSet(game);

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const cell = { x, y };
        const key = posKey(cell);
        if (walls.has(key)) continue;
        if (samePos(cell, game.player)) continue;

        const targetMonster = game.monsters.find((monster) => samePos(monster, cell));
        const blockers = monsterOccupiedKeys(game.monsters, targetMonster?.id);
        const blocked = new Set([...walls, ...blockers]);

        if (canAttackCellWith(attack, cell, walls, blockers, blocked)) {
          attackTiles.add(key);
        }
      }
    }

    return attackTiles;
  }

  function getAttackableMonsters() {
    const game = getGame();
    if (!isCombatMode(game) || game.phase !== PHASES.HERO || game.busy) return new Set();

    const attackable = new Set();
    const attackTiles = getPlayerAttackTiles();

    for (const monster of game.monsters) {
      if (monster.hp <= 0) continue;
      if (attackTiles.has(posKey(monster))) attackable.add(monster.id);
    }

    return attackable;
  }

  function chooseMonsterDestination(monster, monsters, player, game) {
    const walls = combatWallsSet(game);
    const others = monsters.filter((currentMonster) => currentMonster.id !== monster.id && currentMonster.hp > 0);
    const occupied = new Set(others.map(posKey));
    const sightBlockers = new Set(others.map(posKey));
    const cells = [];

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const cell = { x, y };
        const key = posKey(cell);

        if (walls.has(key)) continue;
        if (samePos(cell, player)) continue;
        if (occupied.has(key)) continue;

        const blocked = new Set([...walls, ...occupied]);
        const rangeCost = distanceBetween(cell, player, blocked, true);
        const inRange = rangeCost <= monster.range;
        const lineOfSight = hasLineOfSight(cell, player, walls, sightBlockers);
        const targetDistance = distanceBetween(monster, cell, walls, false);

        cells.push({
          cell,
          inRange,
          lineOfSight,
          rangeCost,
          targetDistance,
          exactness: inRange ? monster.range - rangeCost : 100 + (rangeCost - monster.range),
        });
      }
    }

    cells.sort((a, b) => {
      const aTier = a.inRange && a.lineOfSight ? 0 : a.inRange ? 1 : 2;
      const bTier = b.inRange && b.lineOfSight ? 0 : b.inRange ? 1 : 2;

      if (aTier !== bTier) return aTier - bTier;
      if (a.exactness !== b.exactness) return a.exactness - b.exactness;
      return a.targetDistance - b.targetDistance;
    });

    const desired = cells[0]?.cell || { x: monster.x, y: monster.y };
    const blockedForMove = new Set([...walls, posKey(player)]);
    const { dist, prev } = dijkstra(monster, blockedForMove);
    const candidates = [];

    for (const [key, cost] of dist.entries()) {
      if (cost > monster.speed) continue;
      const cell = parseKey(key);
      if (occupied.has(key) && !samePos(cell, monster)) continue;

      candidates.push({
        cell,
        cost,
        remain: distanceBetween(cell, desired, blockedForMove, false),
        playerDistance: distanceBetween(cell, player, blockedForMove, true),
        path: reconstructPath(prev, cell)
      });
    }

    candidates.sort((a, b) => {
      if (a.remain !== b.remain) return a.remain - b.remain;
      if (a.cost !== b.cost) return b.cost - a.cost;
      return b.playerDistance - a.playerDistance;
    });

    return candidates[0] || { cell: { x: monster.x, y: monster.y }, path: [{ x: monster.x, y: monster.y }] };
  }

  function moveOverworldPlayer(target, options = {}) {
    const game = getGame();
    if (!isOverworldMode(game) || game.busy) return false;
    if (getOverworldEnemyAt(target)) {
      setEvent('Clique no inimigo para iniciar a luta.');
      return false;
    }

    const canActivateConnection = shouldActivateOverworldConnection(options);
    const isCurrentTile = samePos(target, game.player);
    const isConnectionTarget = canActivateConnection && !!getWorldConnectionAt(game.overworld, target);
    const data = isCurrentTile && isConnectionTarget
      ? { cost: 0, path: [{ x: game.player.x, y: game.player.y }] }
      : getOverworldReachableTiles().get(posKey(target));
    if (!data) {
      setEvent('Caminho bloqueado.');
      return false;
    }

    const movementPath = data.path;
    const finalDirection = finalDirectionFromPath(movementPath);

    const totalDist = pathDistance(movementPath);

    const duration = totalDist * TIMING.OVERWORLD_PLAYER_MOVE_SPEED;
    game.player.x = target.x;
    game.player.y = target.y;
    if (finalDirection) game.player.facing = finalDirection;
    game.busy = true;

    game.animations.push({
      type: 'movement',
      entityId: 'player',
      path: movementPath,
      startTime: performance.now(),
      totalDuration: duration,
      totalDistance: totalDist,
    });

    window.setTimeout(() => {
      if (!isOverworldMode(game)) {
        game.busy = false;
        return;
      }

      const connection = canActivateConnection ? getWorldConnectionAt(game.overworld, target) : null;
      if (!connection) {
        collectOverworldPickupAt(target);
        game.busy = false;
        return;
      }

      const blockedMessage = connectionBlockedMessage(connection);
      if (blockedMessage) {
        game.busy = false;
        setEvent(blockedMessage);
        showPlayerSpeech(blockedMessage);
        return;
      }

      const targetMap = getWorldMap(connection.targetMapId);
      const targetState = ensureOverworldMapState(game.overworld, connection.targetMapId);
      if (!targetMap || !targetState) {
        game.busy = false;
        return;
      }

      const transition = {
        type: 'overworldMap',
        fromMapId: game.overworld.currentMapId,
        toMapId: targetMap.id,
        startTime: performance.now(),
        fadeInDuration: TIMING.OVERWORLD_MAP_FADE_IN,
        holdDuration: TIMING.OVERWORLD_MAP_FADE_HOLD,
        fadeOutDuration: TIMING.OVERWORLD_MAP_FADE_OUT,
      };
      game.mapTransition = transition;

      window.setTimeout(() => {
        if (getGame() !== game || game.mapTransition !== transition || !isOverworldMode(game)) return;

        const entry = entryFromConnectionSpawn(connection.spawn, targetMap);
        game.overworld.currentMapId = targetMap.id;
        recordOverworldHeroMapVisit(game.overworld, targetMap.id);
        game.player.x = entry.x;
        game.player.y = entry.y;
        game.player.facing = entry.facing;
        game.animations = [];
        setEvent(`Entrou em ${targetMap.name}.`);
      }, TIMING.OVERWORLD_MAP_FADE_IN);

      window.setTimeout(() => {
        if (getGame() !== game || game.mapTransition !== transition) return;

        game.mapTransition = null;
        game.busy = false;
      }, overworldMapTransitionDuration());
    }, duration);
    setEvent(`Movendo pelo mapa: ${data.cost} passos.`);
    return true;
  }

  function startOverworldEncounter(enemyId) {
    const game = getGame();
    if (!isOverworldMode(game) || game.busy) return false;

    const target = getAliveOverworldEnemies(game).find((enemy) => enemy.id === enemyId);
    if (!target) return false;

    const group = getAliveOverworldEnemies(game).filter((enemy) => enemy.groupId === target.groupId);
    const arenaPositions = [
      { x: 5, y: 0 },
      { x: 5, y: 2 },
      { x: 5, y: 4 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 3, y: 5 },
    ];
    const level = LEVELS[0];
    const returnPosition = { x: game.player.x, y: game.player.y };
    const monsterPositions = group.map((_, index) => arenaPositions[index] || arenaPositions[arenaPositions.length - 1]);
    const combatWalls = generateRandomCombatWalls(level, monsterPositions);

    game.mode = GAME_MODES.COMBAT;
    game.nextOverworldHealthRegenAt = null;
    syncGameMusic(game);
    game.levelIndex = 0;
    game.combatWalls = combatWalls;
    game.combatContext = {
      origin: GAME_MODES.OVERWORLD,
      mapId: game.overworld.currentMapId,
      groupId: target.groupId,
      enemyIds: group.map((enemy) => enemy.id),
      returnPosition,
    };
    game.player.x = level.start.x;
    game.player.y = level.start.y;
    game.monsters = group.map((enemy, index) => {
      const position = monsterPositions[index];
      return createCombatMonsterFromEnemy(enemy, position.x, position.y, index);
    });
    game.turnQueue = ['player', ...game.monsters.map((monster) => monster.id)];
    game.turnCount = 1;
    game.animations = [];
    game.selectedEntity = null;
    game.selectedAttackId = null;
    game.pendingCombatXp = [];
    resetNextTurnApBonus(game);
    game.busy = false;

    startHeroTurn(`Encontro iniciado: grupo ${target.groupId}.`);
    return true;
  }

  function completeOverworldCombat(experienceResult = null) {
    const game = getGame();
    const context = game.combatContext;
    if (!context || context.origin !== GAME_MODES.OVERWORLD) return false;

    if (heroTurnTimeoutId !== null) {
      window.clearTimeout(heroTurnTimeoutId);
      heroTurnTimeoutId = null;
    }
    game.heroTurnStartedAt = null;
    game.heroTurnEndsAt = null;

    const defeatedIds = new Set(context.enemyIds || []);
    if (game.overworld) {
      const mapId = context.mapId || game.overworld.currentMapId;
      ensureOverworldMapState(game.overworld, mapId);
      game.overworld.currentMapId = mapId;
      const mapState = getCurrentWorldMapState(game.overworld);
      if (mapState) {
        const defeatedEnemies = mapState.enemies.filter((enemy) => defeatedIds.has(enemy.id));
        mapState.enemies = mapState.enemies.filter((enemy) => !defeatedIds.has(enemy.id));
        const droppedCells = [];
        defeatedEnemies.forEach((enemy) => {
          const pickup = dropOverworldPickupForEnemy(mapState, enemy, droppedCells);
          if (pickup) droppedCells.push(pickup);
        });
        if (aliveEnemiesForMapState(mapState).length === 0) {
          scheduleOverworldEnemyRespawn(mapId);
        }
      }
    }

    game.mode = GAME_MODES.OVERWORLD;
    game.phase = PHASES.HERO;
    game.heroTurnStartedAt = null;
    game.heroTurnEndsAt = null;
    game.nextOverworldHealthRegenAt = null;
    const map = getCurrentWorldMap(game.overworld);
    game.player.x = context.returnPosition?.x ?? map?.playerStart?.x ?? 0;
    game.player.y = context.returnPosition?.y ?? map?.playerStart?.y ?? 0;
    game.monsters = [];
    game.combatContext = null;
    game.combatWalls = null;
    game.turnQueue = ['player'];
    game.turnCount = 0;
    game.speedRemaining = game.player.speedBase;
    game.apRemaining = game.player.apMax;
    game.selectedEntity = null;
    game.selectedAttackId = null;
    game.pendingCombatXp = [];
    resetNextTurnApBonus(game);
    game.animations = [];
    game.busy = false;

    const xpText = combatExperienceText(experienceResult);
    setEvent(`Grupo derrotado. Voce voltou ao mapa.${xpText}`);
    syncGameMusic(game);
    showBanner('Vitória', experienceResult?.xp > 0 ? `+${experienceResult.xp} XP no fim da batalha.` : 'Grupo removido do mapa aberto.', 2000, null, {
      cardKey: 'player',
      accent: '#34d399',
    });
    return true;
  }

  function completeOverworldDefeat() {
    const game = getGame();
    const context = game.combatContext;
    if (!context || context.origin !== GAME_MODES.OVERWORLD) return false;

    if (heroTurnTimeoutId !== null) {
      window.clearTimeout(heroTurnTimeoutId);
      heroTurnTimeoutId = null;
    }
    game.heroTurnStartedAt = null;
    game.heroTurnEndsAt = null;

    const map = getWorldMap(START_WORLD_MAP_ID);
    if (game.overworld && map) {
      ensureOverworldMapState(game.overworld, map.id);
      game.overworld.currentMapId = map.id;
      recordOverworldHeroMapVisit(game.overworld, map.id);
    }

    game.mode = GAME_MODES.OVERWORLD;
    game.phase = PHASES.HERO;
    game.nextOverworldHealthRegenAt = null;
    game.player.health = 0;
    game.player.x = map?.playerStart?.x ?? 0;
    game.player.y = map?.playerStart?.y ?? 0;
    game.player.facing = { x: 0, y: 1 };
    game.monsters = [];
    game.combatContext = null;
    game.combatWalls = null;
    game.turnQueue = ['player'];
    game.turnCount = 0;
    game.speedRemaining = game.player.speedBase;
    game.apRemaining = game.player.apMax;
    game.selectedEntity = null;
    game.selectedAttackId = null;
    game.pendingCombatXp = [];
    resetNextTurnApBonus(game);
    game.animations = [];
    game.busy = false;

    setEvent('Seu aventureiro caiu e voltou ao mapa 0,0 sem vida.');
    syncGameMusic(game);
    showBanner('Derrota', 'Voce voltou ao mapa 0,0 sem vida.', 2000, null, {
      cardKey: 'player',
      accent: '#b94735',
    });
    return true;
  }

  function confirmEnergy() {
    const game = getGame();
    if (game.busy || game.phase !== PHASES.ENERGY) return;
    startHeroTurn('Vez iniciada sem rolagem de dados.');
  }

  function movePlayer(target) {
    const game = getGame();
    if (!isCombatMode(game)) return;
    if (game.busy) return;
    if (game.selectedAttackId) {
      setEvent('Desmarque o ataque para mover.');
      return;
    }

    const reachable = getReachableTiles();
    const data = reachable.get(posKey(target));
    if (!data) return;
    const finalDirection = finalDirectionFromPath(data.path);

    game.player.x = target.x;
    game.player.y = target.y;
    if (finalDirection) game.player.facing = finalDirection;
    game.speedRemaining -= data.cost;

    game.busy = true;
    game.animations.push({
      type: 'movement',
      entityId: 'player',
      path: data.path,
      startTime: performance.now(),
      durationPerTile: TIMING.PLAYER_MOVE_SPEED,
    });

    const totalDur = (data.path.length - 1) * TIMING.PLAYER_MOVE_SPEED;
    
    game.animations.push({
      type: 'floatingText',
      x: target.x,
      y: target.y,
      text: `-${data.cost}`,
      color: '#5f8f54',
      startTime: performance.now() + totalDur,
      duration: 1200
    });

    window.setTimeout(() => { game.busy = false; }, totalDur);

    setEvent(`Movimento: -${data.cost} velocidade.`);
  }

  function attackTile(targetCell) {
    const game = getGame();
    if (!isCombatMode(game)) return false;
    if (game.busy) return false;

    const attack = getSelectedAttack(game);
    if (!attack) {
      setEvent('Selecione um ataque antes de atacar.');
      return false;
    }

    if (game.apRemaining < attack.apCost) {
      setEvent(`AP insuficiente para ${attack.name}.`);
      return false;
    }

    if (!getPlayerAttackTiles().has(posKey(targetCell))) {
      game.selectedAttackId = null;
      game.selectedEntity = null;
      setEvent('Fora do alcance. Poder desmarcado.');
      return false;
    }

    const target = game.monsters.find((monster) => samePos(monster, targetCell));
    if (!target) {
      game.selectedAttackId = null;
      game.selectedEntity = null;
      setEvent(`${attack.name}: nenhum inimigo nessa celula. Poder desmarcado.`);
      return false;
    }

    const cost = attack.apCost;
    game.apRemaining -= cost;
    game.selectedAttackId = null;
    game.player.facing = {
      x: targetCell.x - game.player.x,
      y: targetCell.y - game.player.y,
    };
    const attackStartTime = performance.now();
    const playerAttackModelAction = playerAttackModelActionFor(attack);

    game.animations.push({
      type: 'floatingText',
      x: game.player.x,
      y: game.player.y,
      text: `-${cost}`,
      color: '#d39b32',
      startTime: attackStartTime,
      duration: 1200
    });

    game.animations.push({
      type: 'modelAction',
      entityId: 'player',
      animation: playerAttackModelAction.animation,
      sourceX: game.player.x,
      sourceY: game.player.y,
      targetX: targetCell.x,
      targetY: targetCell.y,
      startTime: attackStartTime,
      duration: playerAttackModelAction.duration
    });

    if (playerAttackModelAction.projectile) {
      game.animations.push({
        type: 'projectile',
        id: `player:${attack.id}:${attackStartTime}`,
        entityId: 'player',
        model: playerAttackModelAction.projectile.model,
        sourceX: game.player.x,
        sourceY: game.player.y,
        targetX: targetCell.x,
        targetY: targetCell.y,
        startTime: attackStartTime + playerAttackModelAction.projectile.startDelay,
        duration: playerAttackModelAction.projectile.duration,
      });
    }

    let damage = 0;
    let healed = 0;
    let splashDamageTotal = 0;
    let apQueued = 0;
    const attackDamage = getAttackDamage(attack, game.player);
    const targetImpactCell = { x: target.x, y: target.y };
    const targetDamageStartTime = attackStartTime + playerAttackModelAction.impactDelay;
    const defeatedRecords = [];
    const defeatedIds = new Set();

    function recordDefeatedMonster(monster, record) {
      if (!monster || defeatedIds.has(monster.id)) return;
      defeatedIds.add(monster.id);
      defeatedRecords.push(record);
    }

    function applyMonsterDamage(monster, rawDamage, impactCell, damageStartTime) {
      const previousHp = monster.hp;
      const dealt = getMitigatedDamage(rawDamage, monster.defense);
      monster.hp = Math.max(0, monster.hp - dealt);
      if (previousHp > 0 && monster.hp <= 0) {
        queueCombatExperience(monster);
        recordDefeatedMonster(monster, { monster, damage: dealt, damageStartTime, impactCell });
      }

      game.animations.push({
        type: 'damageShake',
        entityId: monster.id,
        startTime: damageStartTime,
        duration: TIMING.DAMAGE_SHAKE_DURATION
      });

      if (dealt > 0) {
        game.animations.push({
          type: 'modelAction',
          entityId: monster.id,
          animation: 'Hit_B',
          sourceX: impactCell.x,
          sourceY: impactCell.y,
          targetX: game.player.x,
          targetY: game.player.y,
          startTime: damageStartTime,
          duration: TIMING.PLAYER_DAMAGE_ANIMATION
        });
      }

      game.animations.push({
        type: 'floatingText',
        x: impactCell.x,
        y: impactCell.y,
        text: dealt > 0 ? `-${dealt}` : 'DEF',
        color: dealt > 0 ? '#b94735' : '#d9c894',
        startTime: damageStartTime,
        duration: 1200
      });

      return dealt;
    }

    damage = applyMonsterDamage(target, attackDamage, targetImpactCell, targetDamageStartTime);

    const lifeSteal = Math.max(0, Number(attack.lifeSteal) || 0);
    healed = damage > 0
      ? Math.min(lifeSteal, game.player.maxHealth - game.player.health)
      : 0;
    if (healed > 0) game.player.health += healed;

    if (damage > 0) {
      apQueued = queueNextTurnApBonus(attack, game);
    }

    const splashEffect = splashDamageEffect(attack);
    if (splashEffect) {
      const splashRawDamage = Math.max(1, Math.floor(attackDamage * splashEffect.ratio));
      const splashTargets = splashTargetsForAttack(game, targetImpactCell, target, splashEffect);
      splashTargets.forEach((splashTarget) => {
        const splashImpactCell = { x: splashTarget.x, y: splashTarget.y };
        splashDamageTotal += applyMonsterDamage(
          splashTarget,
          splashRawDamage,
          splashImpactCell,
          targetDamageStartTime + 90,
        );
      });
    }

    const moveEffect = moveTargetEffect(attack);
    const moveResult = moveTargetByEffect(
      game,
      target,
      attack,
      attackStartTime,
      playerAttackModelAction.impactDelay,
    );

    game.busy = true;

    const effectTexts = [];
    if (healed > 0) effectTexts.push(`Suga ${healed} vida.`);
    if (splashDamageTotal > 0) effectTexts.push(`Area ${splashDamageTotal} dano.`);
    if (moveResult.moved > 0 && moveEffect) {
      effectTexts.push(`${moveEffect.direction === 'pull' ? 'Puxa' : 'Empurra'} ${moveResult.moved}.`);
    }
    if (apQueued > 0) effectTexts.push(`+${apQueued} AP na proxima vez.`);
    const effectText = effectTexts.length > 0 ? ` ${effectTexts.join(' ')}` : '';

    if (target.hp <= 0) {
      setEvent(`${target.name} derrotado.${effectText}`);
    } else {
      setEvent(`${attack.name}: ${attackDamage} - DEF ${target.defense} = ${damage} dano. Gasto: ${cost} AP.${effectText}`);
    }

    defeatedRecords.forEach((record) => {
      const deathStartTime = record.damage > 0
        ? record.damageStartTime + TIMING.PLAYER_DAMAGE_ANIMATION
        : attackStartTime;
      game.animations.push({
        type: 'modelAction',
        entityId: record.monster.id,
        animation: 'Death_A',
        sourceX: record.impactCell.x,
        sourceY: record.impactCell.y,
        targetX: game.player.x,
        targetY: game.player.y,
        startTime: deathStartTime,
        duration: TIMING.MONSTER_DEATH_ANIMATION + TIMING.MONSTER_DEFEAT_EXIT_PAUSE
      });
    });

    const deathFinishDelay = defeatedRecords.reduce((maxDelay, record) => {
      const damageDelay = record.damage > 0
        ? (record.damageStartTime - attackStartTime) + TIMING.PLAYER_DAMAGE_ANIMATION
        : 0;
      return Math.max(
        maxDelay,
        damageDelay + TIMING.MONSTER_DEATH_ANIMATION + TIMING.MONSTER_DEFEAT_EXIT_PAUSE,
      );
    }, 0);
    const movementFinishDelay = moveResult.moved > 0
      ? playerAttackModelAction.impactDelay + 90 + moveResult.moved * TIMING.MONSTER_MOVE_SPEED
      : 0;
    const finishDelay = defeatedRecords.length > 0
      ? Math.max(deathFinishDelay, movementFinishDelay)
      : Math.max(TIMING.HERO_ATTACK_WAIT_TIME, playerAttackModelAction.duration, movementFinishDelay);

    setTimeout(() => {
      game.busy = false;

      if (defeatedRecords.length > 0) {
        game.monsters = game.monsters.filter((monster) => monster.hp > 0);
        
        if (game.monsters.length === 0) {
          if (heroTurnTimeoutId !== null) {
            window.clearTimeout(heroTurnTimeoutId);
            heroTurnTimeoutId = null;
          }
          game.heroTurnStartedAt = null;
          game.heroTurnEndsAt = null;
          const battleExperienceResult = grantPendingCombatExperience();
          const battleXpText = combatExperienceText(battleExperienceResult);

          if (game.mode === GAME_MODES.COMBAT && game.combatContext?.origin === GAME_MODES.OVERWORLD) {
            completeOverworldCombat(battleExperienceResult);
            return;
          }

          if (game.levelIndex === LEVELS.length - 1) {
            game.phase = PHASES.WON;
            setEvent(`Batalha vencida.${battleXpText}`);
            showBanner('Vitória!', 'Você encontrou o Cetro de M’Guf-yn.', 2000);
            return;
          }

          game.phase = PHASES.LEVELUP;
          setEvent(`Batalha vencida.${battleXpText}`);
          showBanner('Nível concluído', 'Escolha curar ou melhorar um atributo.', 2000);
        }
      }
    }, finishDelay);

    return true;
  }

  function attackMonster(monsterId) {
    const game = getGame();
    if (!isCombatMode(game)) return false;
    const target = game.monsters.find((monster) => monster.id === monsterId);
    if (!target) return false;
    return attackTile(target);
  }

  function advanceTurn() {
    const game = getGame();
    if (!isCombatMode(game)) return;
    if (game.phase === PHASES.WON || game.phase === PHASES.LOST || game.phase === PHASES.LEVELUP) return;

    const current = game.turnQueue.shift();
    if (current) game.turnQueue.push(current);

    const aliveMonsterIds = new Set(game.monsters.map(m => m.id));
    game.turnQueue = game.turnQueue.filter(id => id === 'player' || aliveMonsterIds.has(id));

    if (game.turnQueue.length === 0) return; // Should not happen

    const nextId = game.turnQueue[0];

    if (nextId === 'player') {
      game.turnCount += 1;
      startHeroTurn();
    } else {
      game.phase = PHASES.MONSTER_TURN;
      game.busy = true;
      const monster = game.monsters.find(m => m.id === nextId);
      
      if (!monster) {
        advanceTurn(); // Failsafe
        return;
      }
      
      setEvent(`Vez de ${monster.name}.`);
      setTimeout(() => executeMonsterTurn(monster), 500);
    }
  }

  function executeMonsterTurn(monster) {
    const game = getGame();
    if (monster.hp <= 0) {
      advanceTurn();
      return;
    }

    const walls = combatWallsSet(game);
    const destination = chooseMonsterDestination(monster, game.monsters, game.player, game);
    const targetCell = destination.cell;
    const path = destination.path;
    
    let moveWaitTime = 0;

    if (!samePos(targetCell, monster)) {
      game.animations.push({
        type: 'movement',
        entityId: monster.id,
        path: path,
        startTime: performance.now(),
        durationPerTile: TIMING.MONSTER_MOVE_SPEED,
      });
      monster.x = targetCell.x;
      monster.y = targetCell.y;
      moveWaitTime = (path.length - 1) * TIMING.MONSTER_MOVE_SPEED;
    }

    setTimeout(() => {
      if (game.phase === PHASES.WON || game.phase === PHASES.LOST) return;

      const blockers = new Set(
        game.monsters.filter(m => m.id !== monster.id && m.hp > 0).map(posKey)
      );
      const blocked = new Set([...walls, ...blockers]);
      const rangeCost = distanceBetween(monster, game.player, blocked, true);

      if (rangeCost <= monster.range && hasLineOfSight(monster, game.player, walls, blockers)) {
        const totalDefense = game.player.defenseBase;
        const damage = getMitigatedDamage(monster.attack, totalDefense);
        const lifeSteal = Math.max(0, Number(monster.lifeSteal) || 0);
        const drained = damage > 0
          ? Math.min(lifeSteal, Math.max(0, monster.maxHp - monster.hp))
          : 0;
        const attackStartTime = performance.now();
        game.player.health = Math.max(0, game.player.health - damage);
        if (drained > 0) monster.hp += drained;

        const drainText = drained > 0 ? ` Sugou ${drained} vida.` : '';
        setEvent(`${monster.name} atacou! ATQ ${monster.attack} - DEF ${totalDefense} = ${damage} dano.${drainText}`);
        
        game.animations.push({
          type: 'bumpAttack',
          entityId: monster.id,
          targetX: game.player.x,
          targetY: game.player.y,
          startTime: attackStartTime,
          duration: TIMING.ATTACK_BUMP_DURATION
        });

        game.animations.push({
          type: 'modelAction',
          entityId: monster.id,
          animation: 'Hit_A',
          sourceX: monster.x,
          sourceY: monster.y,
          targetX: game.player.x,
          targetY: game.player.y,
          startTime: attackStartTime,
          duration: TIMING.PLAYER_ATTACK_ANIMATION
        });

        const playerDamageStartTime = attackStartTime + TIMING.ATTACK_BUMP_DURATION;
        if (damage > 0) {
          game.animations.push({
            type: 'modelAction',
            entityId: 'player',
            animation: 'Hit_B',
            sourceX: game.player.x,
            sourceY: game.player.y,
            targetX: monster.x,
            targetY: monster.y,
            startTime: playerDamageStartTime,
            duration: TIMING.PLAYER_DAMAGE_ANIMATION
          });
        }

        game.animations.push({
          type: 'floatingText',
          x: game.player.x,
          y: game.player.y,
          text: damage > 0 ? `-${damage}` : 'DEF',
          color: damage > 0 ? '#b94735' : '#d9c894',
          startTime: attackStartTime + 150,
          duration: 1200
        });

        if (drained > 0) {
          game.animations.push({
            type: 'floatingText',
            x: monster.x,
            y: monster.y,
            text: `+${drained}`,
            color: '#34d399',
            startTime: attackStartTime + 220,
            duration: 1200
          });
        }

        if (game.player.health <= 0) {
          if (heroTurnTimeoutId !== null) {
            window.clearTimeout(heroTurnTimeoutId);
            heroTurnTimeoutId = null;
          }
          game.heroTurnStartedAt = null;
          game.heroTurnEndsAt = null;
          game.busy = true;

          const deathStartTime = damage > 0
            ? playerDamageStartTime + TIMING.PLAYER_DAMAGE_ANIMATION
            : attackStartTime;
          const deathActionDuration = TIMING.PLAYER_DEATH_ANIMATION + TIMING.PLAYER_DEFEAT_EXIT_PAUSE;
          const defeatDelay = Math.max(0, deathStartTime - attackStartTime) + deathActionDuration;

          game.animations.push({
            type: 'modelAction',
            entityId: 'player',
            animation: 'Death_A',
            sourceX: game.player.x,
            sourceY: game.player.y,
            targetX: monster.x,
            targetY: monster.y,
            startTime: deathStartTime,
            duration: deathActionDuration
          });

          setEvent('Seu aventureiro caiu.');
          window.setTimeout(() => {
            const currentGame = getGame();
            if (currentGame !== game || !isCombatMode(currentGame) || currentGame.phase === PHASES.WON) return;
            if (currentGame.player.health > 0) return;

            if (currentGame.combatContext?.origin === GAME_MODES.OVERWORLD) {
              completeOverworldDefeat();
              return;
            }

            currentGame.phase = PHASES.LOST;
            currentGame.busy = false;
            showBanner('Derrota', 'Seu aventureiro caiu na masmorra.', 2000);
          }, defeatDelay);
          return;
        }
      }

      setTimeout(() => advanceTurn(), TIMING.POST_ACTION_PAUSE);
    }, moveWaitTime);
  }

  function endHeroPhase() {
    const game = getGame();
    if (!isCombatMode(game)) return;
    if (game.busy || game.phase !== PHASES.HERO) return;

    if (heroTurnTimeoutId !== null) {
      window.clearTimeout(heroTurnTimeoutId);
      heroTurnTimeoutId = null;
    }
    game.heroTurnStartedAt = null;
    game.heroTurnEndsAt = null;
    game.busy = true;
    game.selectedAttackId = null;
    setEvent('Fim da vez: Aventureiro');

    advanceTurn();
  }



  function toggleAttackSelection(attackId = ACTION_RULES.BASIC_ATTACK.id) {
    const game = getGame();
    if (!isCombatMode(game)) return;
    if (game.busy || game.phase !== PHASES.HERO) return;

    const attack = getAttackById(attackId, game);
    if (!attack) {
      setEvent('Poder bloqueado.');
      return;
    }

    if (game.apRemaining < attack.apCost) {
      setEvent(`AP insuficiente para ${attack.name}.`);
      return;
    }

    game.selectedAttackId = game.selectedAttackId === attack.id ? null : attack.id;
    setEvent(game.selectedAttackId ? `${attack.name} selecionado.` : 'Ataque desmarcado.');
  }

  function applyReward(kind) {
    const game = getGame();
    if (game.busy || game.phase !== PHASES.LEVELUP) return;

    const nextIndex = game.levelIndex + 1;
    const nextLevel = LEVELS[nextIndex];

    if (kind === 'heal') game.player.health = game.player.maxHealth;
    if (kind === 'speed') game.player.speedBase += 1;
    if (kind === 'attack') {
      const attack = getEquippedAttack(game);
      game.player.attackSlot = {
        ...attack,
        damage: attack.damage + 1,
      };
    }
    if (kind === 'defense') game.player.defenseBase += 1;
    if (kind === 'range') game.player.rangeBase += 1;

    game.levelIndex = nextIndex;
    game.combatWalls = null;
    game.player.x = nextLevel.start.x;
    game.player.y = nextLevel.start.y;
    game.monsters = levelMonsters(nextLevel);
    game.turnQueue = ['player', ...game.monsters.map(m => m.id)];
    game.pendingCombatXp = [];
    resetNextTurnApBonus(game);

    startHeroTurn(`Nível ${nextLevel.id}. ${game.player.apMax} AP, ${game.player.speedBase} movimento.`);
  }

  function savedGameSnapshot(game) {
    const safeOverworld = game.overworld
      ? {
        ...game.overworld,
        mapStates: Object.fromEntries(Object.entries(game.overworld.mapStates || {}).map(([mapId, mapState]) => {
          return [mapId, {
            ...mapState,
            nextRespawnAt: null,
            respawnTimerId: null,
            pendingRespawnEnemies: [],
          }];
        })),
      }
      : null;

    return {
      ...game,
      savedAt: Date.now(),
      overworld: safeOverworld,
      buttons: [],
      diceRects: [],
      dropZones: [],
      draggingDie: null,
      draggingControl: null,
      selectedAttackId: null,
      cutscene: null,
      mapTransition: null,
      menuOpen: false,
      menuView: 'main',
      activeModal: null,
      levelUpNotice: null,
      combatLogoutDefeat: false,
    };
  }

  function saveGame(options = {}) {
    const game = getGame();
    const silent = options?.silent === true;

    try {
      const snapshot = savedGameSnapshot(game);
      const serialized = JSON.stringify(snapshot);
      const saveKeys = new Set([SAVE_KEY]);
      const characterId = savedSnapshotCharacterId(snapshot);
      if (characterId) saveKeys.add(characterSaveKey(characterId));

      for (const key of saveKeys) {
        localStorage.setItem(key, serialized);
      }
      if (!silent) {
        game.menuOpen = false;
        game.activeModal = null;
        showBanner('Jogo salvo', 'Progresso salvo neste navegador.', 2000);
      }
      return true;
    } catch {
      if (silent) return false;
      showBanner('Erro', 'Não foi possível salvar.', 2000);
      return false;
    }
  }

  function autoSaveGame() {
    return saveGame({ silent: true });
  }

  function normalizeLoadedEnemyUnit(unit) {
    if (!unit || typeof unit !== 'object') return unit;

    const type = normalizeMonsterType(unit.type);
    const template = MONSTER_TEMPLATES[type];
    if (!template) return unit;
    const mapLevel = unit.mapId ? getWorldMap(unit.mapId)?.enemyLevel : null;
    const level = Math.max(1, Math.floor(Number(unit.level ?? mapLevel) || 1));
    const stats = leveledMonsterStats(type, level);

    return {
      ...unit,
      id: normalizeMonsterId(unit.id),
      encounterId: normalizeMonsterId(unit.encounterId),
      mapId: unit.mapId || null,
      type,
      groupId: normalizeEncounterGroupId(unit.groupId),
      overworldEnemyId: normalizeMonsterId(unit.overworldEnemyId),
      level: stats.level,
      hp: Number.isFinite(unit.hp) ? unit.hp : stats.hp,
      maxHp: Number.isFinite(unit.maxHp) ? unit.maxHp : stats.maxHp,
      attack: Number.isFinite(unit.attack) ? unit.attack : stats.attack,
      defense: Number.isFinite(unit.defense) ? unit.defense : stats.defense,
      range: Number.isFinite(unit.range) ? unit.range : stats.range,
      speed: Number.isFinite(unit.speed) ? unit.speed : stats.speed,
      xp: Number.isFinite(unit.xp) ? unit.xp : stats.xp,
      lifeSteal: Number.isFinite(unit.lifeSteal) ? unit.lifeSteal : stats.lifeSteal,
      visualScale: Number.isFinite(unit.visualScale) ? unit.visualScale : stats.visualScale,
      xpGranted: unit.xpGranted === true,
      lastWanderAt: null,
      nextWanderAt: null,
      name: template.name,
      emoji: template.emoji,
      tint: template.tint,
    };
  }

  function normalizeLoadedCombatContext(context) {
    if (!context || typeof context !== 'object') return null;

    return {
      ...context,
      groupId: normalizeEncounterGroupId(context.groupId),
      enemyIds: Array.isArray(context.enemyIds)
        ? context.enemyIds.map(normalizeMonsterId)
        : [],
    };
  }

  function normalizeLoadedMapDebugColors(debugColors) {
    if (!debugColors || typeof debugColors !== 'object' || typeof debugColors.values !== 'object') return null;

    return {
      values: { ...debugColors.values },
    };
  }

  function normalizeLoadedPickup(pickup) {
    if (!pickup || typeof pickup !== 'object') return null;
    const kind = OVERWORLD_PICKUP_DEFINITIONS[pickup.kind] ? pickup.kind : 'apple';
    const x = Math.floor(Number(pickup.x));
    const y = Math.floor(Number(pickup.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    return {
      id: typeof pickup.id === 'string' && pickup.id ? pickup.id : `pickup-${x}-${y}`,
      kind,
      x,
      y,
      createdAt: Number.isFinite(pickup.createdAt) ? pickup.createdAt : null,
    };
  }

  function normalizeLoadedOverworld(loadedOverworld, fallbackOverworld) {
    if (!fallbackOverworld) return null;
    if (!loadedOverworld || typeof loadedOverworld !== 'object') return fallbackOverworld;

    const currentMapId = loadedOverworld.currentMapId || loadedOverworld.mapId || fallbackOverworld.currentMapId;
    const normalized = {
      currentMapId,
      heroPath: Array.isArray(loadedOverworld.heroPath)
        ? loadedOverworld.heroPath.filter((mapId) => typeof mapId === 'string' && !!getWorldMap(mapId))
        : [],
      mapStates: {
        ...(fallbackOverworld.mapStates || {}),
      },
    };

    if (loadedOverworld.mapStates && typeof loadedOverworld.mapStates === 'object') {
      for (const [mapId, loadedMapState] of Object.entries(loadedOverworld.mapStates)) {
        if (!getWorldMap(mapId)) continue;

        ensureOverworldMapState(normalized, mapId);
        const fallbackMapState = normalized.mapStates[mapId];
        normalized.mapStates[mapId] = {
          mapId,
          enemies: Array.isArray(loadedMapState?.enemies)
            ? loadedMapState.enemies.map(normalizeLoadedEnemyUnit)
            : fallbackMapState.enemies,
          enemyWave: toNonNegativeInteger(loadedMapState?.enemyWave, toNonNegativeInteger(fallbackMapState.enemyWave, 1)),
          nextRespawnAt: null,
          respawnTimerId: null,
          pendingRespawnEnemies: [],
          pickups: Array.isArray(loadedMapState?.pickups)
            ? loadedMapState.pickups.map(normalizeLoadedPickup).filter(Boolean)
            : (fallbackMapState.pickups || []),
          pickupCounter: toNonNegativeInteger(
            loadedMapState?.pickupCounter,
            toNonNegativeInteger(fallbackMapState.pickupCounter),
          ),
          removedObjectIds: Array.isArray(loadedMapState?.removedObjectIds)
            ? loadedMapState.removedObjectIds
            : (fallbackMapState.removedObjectIds || []),
          debugColors: normalizeLoadedMapDebugColors(loadedMapState?.debugColors) || fallbackMapState.debugColors || null,
        };
      }
    } else if (Array.isArray(loadedOverworld.enemies)) {
      ensureOverworldMapState(normalized, currentMapId);
      normalized.mapStates[currentMapId].enemies = loadedOverworld.enemies.map(normalizeLoadedEnemyUnit);
      normalized.mapStates[currentMapId].enemyWave = toNonNegativeInteger(loadedOverworld.enemyWave, 1);
      normalized.mapStates[currentMapId].nextRespawnAt = null;
      normalized.mapStates[currentMapId].respawnTimerId = null;
      normalized.mapStates[currentMapId].pendingRespawnEnemies = [];
      normalized.mapStates[currentMapId].pickups = Array.isArray(loadedOverworld.pickups)
        ? loadedOverworld.pickups.map(normalizeLoadedPickup).filter(Boolean)
        : [];
      normalized.mapStates[currentMapId].pickupCounter = toNonNegativeInteger(loadedOverworld.pickupCounter);
      normalized.mapStates[currentMapId].removedObjectIds = Array.isArray(loadedOverworld.removedObjectIds)
        ? loadedOverworld.removedObjectIds
        : [];
    }

    if (!ensureOverworldMapState(normalized, normalized.currentMapId)) {
      normalized.currentMapId = fallbackOverworld.currentMapId;
      ensureOverworldMapState(normalized, normalized.currentMapId);
    }

    normalizeOverworldHeroPath(normalized);
    return normalized;
  }

  function applyCombatLogoutDefeat(normalized) {
    if (normalized?.mode !== GAME_MODES.COMBAT) return false;

    normalized.combatLogoutDefeat = true;
    normalized.player.health = 0;
    normalized.pendingCombatXp = [];
    normalized.pendingNextTurnApBonus = 0;
    normalized.pendingNextTurnApBonusCap = 0;
    normalized.selectedEntity = null;
    normalized.selectedAttackId = null;
    normalized.draggingDie = null;
    normalized.draggingControl = null;
    normalized.busy = false;
    normalized.nextOverworldHealthRegenAt = null;

    if (normalized.combatContext?.origin === GAME_MODES.OVERWORLD) {
      const map = getWorldMap(START_WORLD_MAP_ID);
      if (normalized.overworld && map) {
        ensureOverworldMapState(normalized.overworld, map.id);
        normalized.overworld.currentMapId = map.id;
        recordOverworldHeroMapVisit(normalized.overworld, map.id);
      }

      normalized.mode = GAME_MODES.OVERWORLD;
      normalized.phase = PHASES.HERO;
      normalized.player.x = map?.playerStart?.x ?? 0;
      normalized.player.y = map?.playerStart?.y ?? 0;
      normalized.player.facing = { x: 0, y: 1 };
      normalized.monsters = [];
      normalized.combatContext = null;
      normalized.combatWalls = null;
      normalized.turnQueue = ['player'];
      normalized.turnCount = 0;
      normalized.speedRemaining = normalized.player.speedBase;
      normalized.apRemaining = normalized.player.apMax;
      normalized.lastEvent = 'Voce saiu durante uma batalha e voltou ao mapa 0,0 sem vida.';
      return true;
    }

    normalized.phase = PHASES.LOST;
    normalized.lastEvent = 'Voce saiu durante uma batalha e foi derrotado.';
    return true;
  }

  function normalizeLoadedGame(loaded) {
    if (!loaded || typeof loaded !== 'object') return createGame();

    const knownModes = Object.values(GAME_MODES);
    const mode = knownModes.includes(loaded.mode) ? loaded.mode : GAME_MODES.DUNGEON_LEGACY;
    const fallback = mode === GAME_MODES.DUNGEON_LEGACY ? createDungeonLegacyGame() : createGame();

    const levelIndex = Number.isInteger(loaded.levelIndex)
      ? Math.max(0, Math.min(loaded.levelIndex, LEVELS.length - 1))
      : fallback.levelIndex;
    const fallbackMonsters = mode === GAME_MODES.OVERWORLD
      ? []
      : levelMonsters(LEVELS[levelIndex]);
    const loadedOverworld = loaded.overworld && typeof loaded.overworld === 'object'
      ? loaded.overworld
      : null;
    const overworld = normalizeLoadedOverworld(loadedOverworld, fallback.overworld);

    const normalized = {
      ...fallback,
      ...loaded,
      mode,
      levelIndex,
      player: {
        ...fallback.player,
        ...(loaded.player || {}),
      },
      monsters: Array.isArray(loaded.monsters)
        ? loaded.monsters.map(normalizeLoadedEnemyUnit)
        : fallbackMonsters,
      overworld,
      combatContext: normalizeLoadedCombatContext(loaded.combatContext),
      combatWalls: mode === GAME_MODES.COMBAT ? normalizeCombatWallPairs(loaded.combatWalls) : null,
      energyAssigned: {
        speed: null,
        attack: null,
        defense: null,
        ...(loaded.energyAssigned || {}),
      },
      assignment: {
        speed: 0,
        attack: 0,
        defense: 0,
        ...(loaded.assignment || {}),
      },
    };

    normalizePlayerProgress(normalized.player);
    normalized.buttons = [];
    normalized.diceRects = [];
    normalized.dropZones = [];
    normalized.draggingDie = null;
    normalized.pendingCombatXp = Array.isArray(loaded.pendingCombatXp)
      ? loaded.pendingCombatXp.map(normalizeLoadedEnemyUnit).filter(Boolean)
      : [];
    normalized.pendingNextTurnApBonus = toNonNegativeInteger(loaded.pendingNextTurnApBonus);
    normalized.pendingNextTurnApBonusCap = toNonNegativeInteger(loaded.pendingNextTurnApBonusCap);
    normalized.selectedAttackId = null;
    normalized.activeModal = null;
    normalized.levelUpNotice = null;
    normalized.cutscene = null;
    normalized.mapTransition = null;
    normalized.menuOpen = false;
    normalized.busy = false;
    normalized.animations = [];
    normalized.banner = null;
    normalized.combatLogoutDefeat = false;
    normalized.heroTurnStartedAt = null;
    normalized.heroTurnEndsAt = null;
    normalized.nextOverworldHealthRegenAt = Number.isFinite(normalized.nextOverworldHealthRegenAt)
      ? normalized.nextOverworldHealthRegenAt
      : null;
    normalized.turnQueue = Array.isArray(normalized.turnQueue)
      ? normalized.turnQueue.map((id) => id === 'player' ? id : normalizeMonsterId(id))
      : [];

    const combatLogoutDefeat = applyCombatLogoutDefeat(normalized);

    if (normalized.mode === GAME_MODES.OVERWORLD) {
      normalized.turnQueue = ['player'];
      normalized.monsters = [];
      normalized.combatContext = null;
      normalized.combatWalls = null;
      normalized.phase = PHASES.HERO;
      normalized.nextOverworldHealthRegenAt = null;
      if (!combatLogoutDefeat) applyOfflineHealthRegen(normalized, loaded);
    } else {
      normalized.nextOverworldHealthRegenAt = null;
    }

    if (normalized.player.health >= normalized.player.maxHealth) {
      normalized.nextOverworldHealthRegenAt = null;
    }

    if (!normalized.turnQueue || normalized.turnQueue.length === 0) {
      normalized.turnQueue = ['player', ...normalized.monsters.map(m => m.id)];
    }

    normalized.roll = Array.isArray(normalized.roll) ? normalized.roll : [];
    const wasEnergyPhase = normalized.phase === PHASES.ENERGY;
    if (wasEnergyPhase) normalized.phase = PHASES.HERO;

    if (!normalized.lastEvent) normalized.lastEvent = 'Jogo carregado.';
    if (!Number.isFinite(normalized.player.apMax)) normalized.player.apMax = ACTION_RULES.BASE_AP;
    normalized.player.attackSlot = getEquippedAttack(normalized);
    if (!Number.isFinite(normalized.speedRemaining)) normalized.speedRemaining = normalized.player.speedBase;
    if (!Number.isFinite(normalized.apRemaining)) normalized.apRemaining = normalized.player.apMax;
    if (wasEnergyPhase) {
      normalized.assignment = { speed: 0, attack: 0, defense: 0 };
      normalized.speedRemaining = normalized.player.speedBase;
      normalized.apRemaining = normalized.player.apMax;
    }
    if (!Number.isFinite(normalized.turnCount)) {
      normalized.turnCount = normalized.mode === GAME_MODES.OVERWORLD ? 0 : 1;
    }

    return normalized;
  }

  function loadGame(options = {}) {
    const silent = options?.silent === true;
    const characterId = normalizeCharacterSaveId(options?.characterId) || selectedStoredCharacterId();

    try {
      const raw = readSavedGameRaw(characterId);
      if (!raw) {
        if (silent) return false;
        showBanner('Sem save', 'Nenhum jogo salvo encontrado.', 2000);
        return false;
      }

      const normalized = normalizeLoadedGame(JSON.parse(raw));
      setGame(normalized);
      if (normalized.combatLogoutDefeat) persistPlayerProgress(normalized.player);
      scheduleEmptyOverworldRespawns();
      if (!silent) showBanner('Jogo carregado', 'Continue sua aventura.', 2000);
      return true;
    } catch {
      if (silent) return false;
      showBanner('Erro', 'Não foi possível carregar.', 2000);
      return false;
    }
  }

  function newGame() {
    const game = setGame(createGame());
    const map = getCurrentWorldMap(game.overworld);
    setEvent(`Entrou em ${map?.name || 'Mapa aberto'}.`);
  }

  function newDungeonLegacyGame() {
    setGame(createDungeonLegacyGame());
    showBanner('Dungeon legada', `${getGame().player.apMax} AP para agir`, 2000, null, {
      cardKey: 'player',
      accent: '#facc15',
    });
  }

  function getTotals() {
    const game = getGame();
    const attack = getEquippedAttack(game);

    return {
      speed: game.player.speedBase + game.assignment.speed,
      attack: getAttackDamage(attack, game.player),
      attackCost: attack.apCost,
      attackLifeSteal: Math.max(0, Number(attack.lifeSteal) || 0),
      attackName: attack.name,
      defense: game.player.defenseBase,
      range: game.player.rangeBase,
      ap: game.player.apMax,
    };
  }

  return {
    allDiceAssigned,
    allocateCharacteristic,
    applyDebugHeroConfig,
    applyReward,
    assignedStatForDie,
    attackMonster,
    attackTile,
    autoSaveGame,
    advanceCutscene,
    closeActiveModal,
    confirmEnergy,
    endHeroPhase,
    getAttackRangeLabel,
    getAttackDamage,
    getAttackableMonsters,
    getAvailableAttacks,
    getElementalDamageBonus,
    getGame,
    getMonsterAttackTiles,
    getMonsterReachableTiles,
    getOverworldMusicVolume,
    getOverworldEnemyAt,
    getOverworldReachableTiles,
    getHeroTurnTimer,
    getPlayerAttackTiles,
    getReachableTiles,
    getTotals,
    getEquippedAttack,
    getPlayerSpellbook,
    getSelectedAttack,
    getXpProgress,
    grantMonsterExperience,
    loadGame,
    moveOverworldPlayer,
    movePlayer,
    newGame,
    newDungeonLegacyGame,
    saveGame,
    setOverworldMusicVolume: updateOverworldMusicVolume,
    setEvent,
    skipCutscene,
    showBanner,
    openCharacteristicsModal,
    openSpellsModal,
    openWorldMapModal,
    startHeroTurn,
    startEnergyTurn,
    startNurseryCutscene,
    startOverworldAtMap,
    startOverworldEncounter,
    tickCutscene,
    tickOverworldEnemyWander,
    tickOverworldHealthRegen,
    tickOverworldPickupExpiry,
    toggleAttackSelection,
    toggleWorldMapHeroPath,
    toggleWorldMapModal,
  };
}
