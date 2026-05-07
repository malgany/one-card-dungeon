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
  overworldEnemies,
} from './game-factories.js';
import {
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
const RANGER_VERDANT_ARROW_ANIMATION = 'Ranged_Bow_Release';
const RANGER_VERDANT_ARROW_ANIMATION_DURATION = 1333;
const RANGER_VERDANT_ARROW_PROJECTILE_START = 620;
const RANGER_VERDANT_ARROW_PROJECTILE_DURATION = 280;
const OVERWORLD_COMBAT_WALL_COUNT = 3;
const COMBAT_WALL_GENERATION_ATTEMPTS = 80;
const COMBAT_ARENA_BOUNDS = { width: BOARD_SIZE, height: BOARD_SIZE };
const NURSERY_WAKE_ANIMATION = 'Spawn_Ground';
const NURSERY_IDLE_TALK_ANIMATION = 'Idle_B';
const NURSERY_GESTURE_ANIMATION = 'Interact';
const NURSERY_FALLEN_ANIMATION = 'Death_B';
const NURSERY_WAKE_ANIMATION_DURATION = 1300;
const NURSERY_GESTURE_ANIMATION_DURATION = 1300;

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

function overworldMapTransitionDuration() {
  return TIMING.OVERWORLD_MAP_FADE_IN + TIMING.OVERWORLD_MAP_FADE_HOLD + TIMING.OVERWORLD_MAP_FADE_OUT;
}

function shouldActivateOverworldConnection(options = {}) {
  return options.activateConnection !== false;
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
  if (attack?.id === 'rangerVerdantArrow') {
    return {
      animation: RANGER_VERDANT_ARROW_ANIMATION,
      duration: RANGER_VERDANT_ARROW_ANIMATION_DURATION,
      impactDelay: RANGER_VERDANT_ARROW_PROJECTILE_START + RANGER_VERDANT_ARROW_PROJECTILE_DURATION,
      projectile: {
        model: 'arrowBow',
        startDelay: RANGER_VERDANT_ARROW_PROJECTILE_START,
        duration: RANGER_VERDANT_ARROW_PROJECTILE_DURATION,
      },
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

  function startHeroTurn(message = null) {
    const game = getGame();

    game.phase = PHASES.HERO;
    game.roll = [];
    game.energyAssigned = { speed: null, attack: null, defense: null };
    game.assignment = { speed: 0, attack: 0, defense: 0 };
    game.speedRemaining = game.player.speedBase;
    game.apRemaining = game.player.apMax;
    game.draggingDie = null;
    game.selectedEntity = null;
    game.selectedAttackId = null;
    game.busy = false;
    primeHeroTurnClock(game);

    setEvent(message || `Sua vez. ${game.apRemaining} AP, ${game.speedRemaining} movimento.`);
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
    }
  }

  function scheduleEmptyOverworldRespawns(game = getGame()) {
    for (const mapId of Object.keys(game?.overworld?.mapStates || {})) {
      scheduleOverworldEnemyRespawn(mapId);
    }
  }

  function scheduleOverworldEnemyRespawn(mapId) {
    const game = getGame();
    const map = getWorldMap(mapId);
    const mapState = game.overworld?.mapStates?.[mapId];
    if (!map || !mapState || aliveEnemiesForMapState(mapState).length > 0 || mapState.respawnTimerId) return false;

    const minDelay = TIMING.OVERWORLD_ENEMY_RESPAWN_MIN;
    const maxDelay = TIMING.OVERWORLD_ENEMY_RESPAWN_MAX;
    const delay = minDelay + Math.random() * Math.max(0, maxDelay - minDelay);
    mapState.nextRespawnAt = performance.now() + delay;
    mapState.respawnTimerId = window.setTimeout(() => {
      const currentGame = getGame();
      const currentMapState = currentGame.overworld?.mapStates?.[mapId];
      if (!currentMapState) return;

      currentMapState.respawnTimerId = null;
      currentMapState.nextRespawnAt = null;
      if (aliveEnemiesForMapState(currentMapState).length > 0) return;

      const wave = toNonNegativeInteger(currentMapState.enemyWave);
      currentMapState.enemies = overworldEnemies(map, wave);
      currentMapState.enemyWave = wave + 1;
      if (currentGame.overworld?.currentMapId === mapId) {
        setEvent('Novos inimigos apareceram no mapa.');
      }
    }, delay);
    return true;
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

    let totalDist = 0;
    for (let i = 0; i < movementPath.length - 1; i += 1) {
      const p1 = movementPath[i];
      const p2 = movementPath[i + 1];
      totalDist += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }

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
        game.busy = false;
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
    game.busy = false;

    startHeroTurn(`Encontro iniciado: grupo ${target.groupId}.`);
    return true;
  }

  function completeOverworldCombat() {
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
        mapState.enemies = mapState.enemies.filter((enemy) => !defeatedIds.has(enemy.id));
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
    game.animations = [];
    game.busy = false;

    setEvent('Grupo derrotado. Você voltou ao mapa.');
    syncGameMusic(game);
    showBanner('Vitória', 'Grupo removido do mapa aberto.', 2000, null, {
      cardKey: 'player',
      accent: '#34d399',
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
      setEvent('Fora do alcance. Escolha uma celula destacada em vermelho.');
      return false;
    }

    const target = game.monsters.find((monster) => samePos(monster, targetCell));
    if (!target) {
      setEvent(`${attack.name}: nenhum inimigo nessa celula.`);
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
    let experienceResult = { xp: 0, levelsGained: 0, pointsGained: 0 };
    const attackDamage = getAttackDamage(attack, game.player);
    if (target) {
      const previousHp = target.hp;
      damage = getMitigatedDamage(attackDamage, target.defense);
      target.hp = Math.max(0, target.hp - damage);
      if (previousHp > 0 && target.hp <= 0) {
        experienceResult = grantMonsterExperience(target);
      }

      const lifeSteal = Math.max(0, Number(attack.lifeSteal) || 0);
      healed = damage > 0
        ? Math.min(lifeSteal, game.player.maxHealth - game.player.health)
        : 0;
      if (healed > 0) game.player.health += healed;

      game.animations.push({
        type: 'damageShake',
        entityId: target.id,
        startTime: attackStartTime + playerAttackModelAction.impactDelay,
        duration: TIMING.DAMAGE_SHAKE_DURATION
      });

      const targetDamageStartTime = attackStartTime + playerAttackModelAction.impactDelay;
      if (damage > 0) {
        game.animations.push({
          type: 'modelAction',
          entityId: target.id,
          animation: 'Hit_B',
          sourceX: target.x,
          sourceY: target.y,
          targetX: game.player.x,
          targetY: game.player.y,
          startTime: targetDamageStartTime,
          duration: TIMING.PLAYER_DAMAGE_ANIMATION
        });
      }

      game.animations.push({
        type: 'floatingText',
        x: target.x,
        y: target.y,
        text: damage > 0 ? `-${damage}` : 'DEF',
        color: damage > 0 ? '#b94735' : '#d9c894',
        startTime: attackStartTime + playerAttackModelAction.impactDelay,
        duration: 1200
      });
    }

    game.busy = true;

    if (target.hp <= 0) {
      const xpText = experienceResult.xp > 0 ? ` +${experienceResult.xp} XP.` : '';
      const levelText = experienceResult.levelsGained > 0
          ? ` Nível ${game.player.level}! +${experienceResult.pointsGained} pontos.`
        : '';
      setEvent(`${target.name} derrotado.${xpText}${levelText}`);
    } else {
      const healText = healed > 0 ? ` Suga ${healed} vida.` : '';
      setEvent(`${attack.name}: ${attackDamage} - DEF ${target.defense} = ${damage} dano. Gasto: ${cost} AP.${healText}`);
    }

    const targetDefeated = target.hp <= 0;
    const finishDelay = targetDefeated
      ? (
        (damage > 0 ? playerAttackModelAction.impactDelay + TIMING.PLAYER_DAMAGE_ANIMATION : 0)
        + TIMING.MONSTER_DEATH_ANIMATION
        + TIMING.MONSTER_DEFEAT_EXIT_PAUSE
      )
      : Math.max(TIMING.HERO_ATTACK_WAIT_TIME, playerAttackModelAction.duration);

    if (targetDefeated) {
      const deathStartTime = damage > 0
        ? attackStartTime + playerAttackModelAction.impactDelay + TIMING.PLAYER_DAMAGE_ANIMATION
        : attackStartTime;

      game.animations.push({
        type: 'modelAction',
        entityId: target.id,
        animation: 'Death_A',
        sourceX: target.x,
        sourceY: target.y,
        targetX: game.player.x,
        targetY: game.player.y,
        startTime: deathStartTime,
        duration: TIMING.MONSTER_DEATH_ANIMATION + TIMING.MONSTER_DEFEAT_EXIT_PAUSE
      });
    }

    setTimeout(() => {
      game.busy = false;

      if (target && target.hp <= 0) {
        game.monsters = game.monsters.filter((monster) => monster.hp > 0);
        
        if (game.monsters.length === 0) {
          if (heroTurnTimeoutId !== null) {
            window.clearTimeout(heroTurnTimeoutId);
            heroTurnTimeoutId = null;
          }
          game.heroTurnStartedAt = null;
          game.heroTurnEndsAt = null;

          if (game.mode === GAME_MODES.COMBAT && game.combatContext?.origin === GAME_MODES.OVERWORLD) {
            completeOverworldCombat();
            return;
          }

          if (game.levelIndex === LEVELS.length - 1) {
            game.phase = PHASES.WON;
            showBanner('Vitória!', 'Você encontrou o Cetro de M’Guf-yn.', 2000);
            return;
          }

          game.phase = PHASES.LEVELUP;
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
        const attackStartTime = performance.now();
        game.player.health = Math.max(0, game.player.health - damage);

        setEvent(`${monster.name} atacou! ATQ ${monster.attack} - DEF ${totalDefense} = ${damage} dano.`);
        
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

    startHeroTurn(`Nível ${nextLevel.id}. ${game.player.apMax} AP, ${game.player.speedBase} movimento.`);
  }

  function saveGame() {
    const game = getGame();

    try {
      const safeOverworld = game.overworld
        ? {
          ...game.overworld,
          mapStates: Object.fromEntries(Object.entries(game.overworld.mapStates || {}).map(([mapId, mapState]) => {
            return [mapId, {
              ...mapState,
              nextRespawnAt: null,
              respawnTimerId: null,
            }];
          })),
        }
        : null;
      const safeGame = {
        ...game,
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
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(safeGame));
      game.menuOpen = false;
      game.activeModal = null;
      showBanner('Jogo salvo', 'Progresso salvo neste navegador.', 2000);
    } catch {
      showBanner('Erro', 'Não foi possível salvar.', 2000);
    }
  }

  function normalizeLoadedEnemyUnit(unit) {
    if (!unit || typeof unit !== 'object') return unit;

    const type = normalizeMonsterType(unit.type);
    const template = MONSTER_TEMPLATES[type];
    if (!template) return unit;

    return {
      ...unit,
      id: normalizeMonsterId(unit.id),
      encounterId: normalizeMonsterId(unit.encounterId),
      mapId: unit.mapId || null,
      type,
      groupId: normalizeEncounterGroupId(unit.groupId),
      overworldEnemyId: normalizeMonsterId(unit.overworldEnemyId),
      hp: Number.isFinite(unit.hp) ? unit.hp : template.hp,
      maxHp: Number.isFinite(unit.maxHp) ? unit.maxHp : template.hp,
      attack: Number.isFinite(unit.attack) ? unit.attack : template.attack,
      defense: Number.isFinite(unit.defense) ? unit.defense : template.defense,
      range: Number.isFinite(unit.range) ? unit.range : template.range,
      speed: Number.isFinite(unit.speed) ? unit.speed : template.speed,
      xp: Number.isFinite(unit.xp) ? unit.xp : template.xp,
      xpGranted: unit.xpGranted === true,
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

  function normalizeLoadedOverworld(loadedOverworld, fallbackOverworld) {
    if (!fallbackOverworld) return null;
    if (!loadedOverworld || typeof loadedOverworld !== 'object') return fallbackOverworld;

    const currentMapId = loadedOverworld.currentMapId || loadedOverworld.mapId || fallbackOverworld.currentMapId;
    const normalized = {
      currentMapId,
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
      normalized.mapStates[currentMapId].removedObjectIds = Array.isArray(loadedOverworld.removedObjectIds)
        ? loadedOverworld.removedObjectIds
        : [];
    }

    if (!ensureOverworldMapState(normalized, normalized.currentMapId)) {
      normalized.currentMapId = fallbackOverworld.currentMapId;
      ensureOverworldMapState(normalized, normalized.currentMapId);
    }

    return normalized;
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
    normalized.selectedAttackId = null;
    normalized.activeModal = null;
    normalized.levelUpNotice = null;
    normalized.cutscene = null;
    normalized.mapTransition = null;
    normalized.menuOpen = false;
    normalized.busy = false;
    normalized.animations = [];
    normalized.banner = null;
    normalized.heroTurnStartedAt = null;
    normalized.heroTurnEndsAt = null;
    normalized.nextOverworldHealthRegenAt = Number.isFinite(normalized.nextOverworldHealthRegenAt)
      ? normalized.nextOverworldHealthRegenAt
      : null;
    normalized.turnQueue = Array.isArray(normalized.turnQueue)
      ? normalized.turnQueue.map((id) => id === 'player' ? id : normalizeMonsterId(id))
      : [];

    if (normalized.mode === GAME_MODES.OVERWORLD) {
      normalized.turnQueue = ['player'];
      normalized.monsters = [];
      normalized.combatContext = null;
      normalized.combatWalls = null;
      normalized.phase = PHASES.HERO;
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

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        showBanner('Sem save', 'Nenhum jogo salvo encontrado.', 2000);
        return;
      }

      setGame(normalizeLoadedGame(JSON.parse(raw)));
      scheduleEmptyOverworldRespawns();
      showBanner('Jogo carregado', 'Continue sua aventura.', 2000);
    } catch {
      showBanner('Erro', 'Não foi possível carregar.', 2000);
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
    startHeroTurn,
    startEnergyTurn,
    startNurseryCutscene,
    startOverworldAtMap,
    startOverworldEncounter,
    tickCutscene,
    tickOverworldHealthRegen,
    toggleAttackSelection,
  };
}
