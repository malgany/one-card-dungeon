import {
  ACTION_RULES,
  BOARD_SIZE,
  GAME_MODES,
  LEVELS,
  MONSTER_TEMPLATES,
  PHASES,
  SAVE_KEY,
  TIMING,
  getWorldMap,
  normalizeEncounterGroupId,
  normalizeMonsterId,
  normalizeMonsterType,
} from '../config/game-data.js';
import {
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
  ensureOverworldMapState,
  levelMonsters,
} from './game-factories.js';
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
  playOverworldMusic,
  setOverworldMusicVolume,
  stopOverworldMusic,
} from './audio.js';

let heroTurnTimeoutId = null;

export function createGameActions(state) {

  function getGame() {
    return state.game;
  }

  function setGame(nextGame) {
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
    syncOverworldMusic(nextGame);

    return state.game;
  }

  function isCombatMode(game = getGame()) {
    return game.mode === GAME_MODES.COMBAT || game.mode === GAME_MODES.DUNGEON_LEGACY || !game.mode;
  }

  function isOverworldMode(game = getGame()) {
    return game.mode === GAME_MODES.OVERWORLD;
  }

  function syncOverworldMusic(game = getGame()) {
    if (isOverworldMode(game)) {
      playOverworldMusic();
    } else {
      stopOverworldMusic();
    }
  }

  function updateOverworldMusicVolume(volume) {
    const nextVolume = setOverworldMusicVolume(volume);
    syncOverworldMusic();
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

  function getEquippedAttack(game = getGame()) {
    const equipped = {
      ...ACTION_RULES.BASIC_ATTACK,
      ...(game.player.attackSlot || {}),
    };

    if (equipped.id === ACTION_RULES.BASIC_ATTACK.id) {
      equipped.lifeSteal = ACTION_RULES.BASIC_ATTACK.lifeSteal;
    }

    return equipped;
  }

  function getMitigatedDamage(rawDamage, defense) {
    return Math.max(0, rawDamage - Math.max(0, defense));
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
      ...levelWallsSet(game.levelIndex),
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
      ...levelWallsSet(game.levelIndex),
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

    const walls = levelWallsSet(game.levelIndex);
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

    const attack = getEquippedAttack(game);
    if (game.selectedAttackId !== attack.id || game.apRemaining < attack.apCost) return attackTiles;

    const walls = levelWallsSet(game.levelIndex);

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const cell = { x, y };
        const key = posKey(cell);
        if (walls.has(key)) continue;
        if (samePos(cell, game.player)) continue;

        const targetMonster = game.monsters.find((monster) => samePos(monster, cell));
        const blockers = monsterOccupiedKeys(game.monsters, targetMonster?.id);
        const blocked = new Set([...walls, ...blockers]);
        const rangeCost = distanceBetween(game.player, cell, blocked, true);

        if (rangeCost <= game.player.rangeBase && hasLineOfSight(game.player, cell, walls, blockers)) {
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

  function chooseMonsterDestination(monster, monsters, player, levelIndex) {
    const walls = levelWallsSet(levelIndex);
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

  function moveOverworldPlayer(target) {
    const game = getGame();
    if (!isOverworldMode(game) || game.busy) return false;
    if (getOverworldEnemyAt(target)) {
      setEvent('Clique no inimigo para iniciar a luta.');
      return false;
    }

    const reachable = getOverworldReachableTiles();
    const data = reachable.get(posKey(target));
    if (!data) {
      setEvent('Caminho bloqueado.');
      return false;
    }

    const movementPath = data.path;

    let totalDist = 0;
    for (let i = 0; i < movementPath.length - 1; i += 1) {
      const p1 = movementPath[i];
      const p2 = movementPath[i + 1];
      totalDist += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }

    const duration = totalDist * TIMING.OVERWORLD_PLAYER_MOVE_SPEED;
    game.player.x = target.x;
    game.player.y = target.y;
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
      if (isOverworldMode(game)) {
        const connection = getWorldConnectionAt(game.overworld, target);
        if (connection) {
          const targetMap = getWorldMap(connection.targetMapId);
          const targetState = ensureOverworldMapState(game.overworld, connection.targetMapId);

          if (targetMap && targetState) {
            game.overworld.currentMapId = targetMap.id;
            game.player.x = connection.spawn.x;
            game.player.y = connection.spawn.y;
            game.animations = [];
            setEvent(`Entrou em ${targetMap.name}.`);
          }
        }
      }

      game.busy = false;
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

    game.mode = GAME_MODES.COMBAT;
    syncOverworldMusic(game);
    game.levelIndex = 0;
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
      const position = arenaPositions[index] || arenaPositions[arenaPositions.length - 1];
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
      }
    }

    game.mode = GAME_MODES.OVERWORLD;
    game.phase = PHASES.HERO;
    game.heroTurnStartedAt = null;
    game.heroTurnEndsAt = null;
    const map = getCurrentWorldMap(game.overworld);
    game.player.x = context.returnPosition?.x ?? map?.playerStart?.x ?? 0;
    game.player.y = context.returnPosition?.y ?? map?.playerStart?.y ?? 0;
    game.monsters = [];
    game.combatContext = null;
    game.turnQueue = ['player'];
    game.turnCount = 0;
    game.speedRemaining = game.player.speedBase;
    game.apRemaining = game.player.apMax;
    game.selectedEntity = null;
    game.selectedAttackId = null;
    game.animations = [];
    game.busy = false;

    setEvent('Grupo derrotado. Você voltou ao mapa.');
    syncOverworldMusic(game);
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

    game.player.x = target.x;
    game.player.y = target.y;
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

    const attack = getEquippedAttack(game);
    if (game.selectedAttackId !== attack.id) {
      setEvent('Selecione um ataque antes de atacar.');
      return false;
    }

    if (!getPlayerAttackTiles().has(posKey(targetCell))) {
      game.selectedAttackId = null;
      setEvent('Fora do alcance do ataque.');
      return false;
    }

    const target = game.monsters.find((monster) => samePos(monster, targetCell));
    const cost = attack.apCost;
    game.apRemaining -= cost;
    game.selectedAttackId = null;

    game.animations.push({
      type: 'floatingText',
      x: game.player.x,
      y: game.player.y,
      text: `-${cost}`,
      color: '#d39b32',
      startTime: performance.now(),
      duration: 1200
    });

    game.animations.push({
      type: 'modelAction',
      entityId: 'player',
      animation: 'Hit_A',
      sourceX: game.player.x,
      sourceY: game.player.y,
      targetX: targetCell.x,
      targetY: targetCell.y,
      startTime: performance.now(),
      duration: TIMING.PLAYER_ATTACK_ANIMATION
    });

    let damage = 0;
    let healed = 0;
    if (target) {
      damage = getMitigatedDamage(attack.damage, target.defense);
      target.hp = Math.max(0, target.hp - damage);

      const lifeSteal = Math.max(0, Number(attack.lifeSteal) || 0);
      healed = damage > 0
        ? Math.min(lifeSteal, game.player.maxHealth - game.player.health)
        : 0;
      if (healed > 0) game.player.health += healed;

      game.animations.push({
        type: 'damageShake',
        entityId: target.id,
        startTime: performance.now() + TIMING.ATTACK_BUMP_DURATION,
        duration: TIMING.DAMAGE_SHAKE_DURATION
      });

      if (damage > 0) {
        game.animations.push({
          type: 'modelAction',
          entityId: target.id,
          animation: 'Hit_B',
          sourceX: target.x,
          sourceY: target.y,
          targetX: game.player.x,
          targetY: game.player.y,
          startTime: performance.now() + TIMING.ATTACK_BUMP_DURATION,
          duration: TIMING.PLAYER_DAMAGE_ANIMATION
        });
      }

      game.animations.push({
        type: 'floatingText',
        x: target.x,
        y: target.y,
        text: `-${damage}`,
        color: '#b94735',
        startTime: performance.now() + 150,
        duration: 1200
      });
    }

    game.busy = true;

    if (!target) {
      setEvent(`${attack.name}: ataque em celula vazia. Gasto: ${cost} AP.`);
    } else if (target.hp <= 0) {
      setEvent(`${target.name} derrotado.`);
    } else {
      const healText = healed > 0 ? ` Suga ${healed} vida.` : '';
      setEvent(`${attack.name}: ${attack.damage} - DEF ${target.defense} = ${damage} dano. Gasto: ${cost} AP.${healText}`);
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
    }, TIMING.HERO_ATTACK_WAIT_TIME);

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

    const walls = levelWallsSet(game.levelIndex);
    const destination = chooseMonsterDestination(monster, game.monsters, game.player, game.levelIndex);
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
        game.player.health = Math.max(0, game.player.health - damage);

        setEvent(`${monster.name} atacou! ATQ ${monster.attack} - DEF ${totalDefense} = ${damage} dano.`);
        
        game.animations.push({
          type: 'floatingText',
          x: monster.x,
          y: monster.y,
          text: `-${monster.attack}`,
          color: '#d39b32',
          startTime: performance.now(),
          duration: 1200
        });

        game.animations.push({
          type: 'bumpAttack',
          entityId: monster.id,
          targetX: game.player.x,
          targetY: game.player.y,
          startTime: performance.now(),
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
          startTime: performance.now(),
          duration: TIMING.PLAYER_ATTACK_ANIMATION
        });

        if (damage > 0) {
          game.animations.push({
            type: 'modelAction',
            entityId: 'player',
            animation: 'Hit_B',
            sourceX: game.player.x,
            sourceY: game.player.y,
            targetX: monster.x,
            targetY: monster.y,
            startTime: performance.now() + TIMING.ATTACK_BUMP_DURATION,
            duration: TIMING.PLAYER_DAMAGE_ANIMATION
          });
        }

        game.animations.push({
          type: 'floatingText',
          x: game.player.x,
          y: game.player.y,
          text: `-${damage}`,
          color: '#b94735',
          startTime: performance.now() + 150,
          duration: 1200
        });

        if (game.player.health <= 0) {
          if (heroTurnTimeoutId !== null) {
            window.clearTimeout(heroTurnTimeoutId);
            heroTurnTimeoutId = null;
          }
          game.heroTurnStartedAt = null;
          game.heroTurnEndsAt = null;
          game.phase = PHASES.LOST;
          game.busy = false;
          showBanner('Derrota', 'Seu aventureiro caiu na masmorra.', 2000);
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



  function toggleAttackSelection() {
    const game = getGame();
    if (!isCombatMode(game)) return;
    if (game.busy || game.phase !== PHASES.HERO) return;

    const attack = getEquippedAttack(game);
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
    game.player.x = nextLevel.start.x;
    game.player.y = nextLevel.start.y;
    game.monsters = levelMonsters(nextLevel);
    game.turnQueue = ['player', ...game.monsters.map(m => m.id)];

    startHeroTurn(`Nível ${nextLevel.id}. ${game.player.apMax} AP, ${game.player.speedBase} movimento.`);
  }

  function saveGame() {
    const game = getGame();

    try {
      const safeGame = {
        ...game,
        buttons: [],
        diceRects: [],
        dropZones: [],
        draggingDie: null,
        draggingControl: null,
        selectedAttackId: null,
        menuOpen: false,
        menuView: 'main',
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(safeGame));
      game.menuOpen = false;
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
          removedObjectIds: Array.isArray(loadedMapState?.removedObjectIds)
            ? loadedMapState.removedObjectIds
            : (fallbackMapState.removedObjectIds || []),
          debugColors: normalizeLoadedMapDebugColors(loadedMapState?.debugColors) || fallbackMapState.debugColors || null,
        };
      }
    } else if (Array.isArray(loadedOverworld.enemies)) {
      ensureOverworldMapState(normalized, currentMapId);
      normalized.mapStates[currentMapId].enemies = loadedOverworld.enemies.map(normalizeLoadedEnemyUnit);
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

    normalized.buttons = [];
    normalized.diceRects = [];
    normalized.dropZones = [];
    normalized.draggingDie = null;
    normalized.selectedAttackId = null;
    normalized.menuOpen = false;
    normalized.busy = false;
    normalized.animations = [];
    normalized.banner = null;
    normalized.heroTurnStartedAt = null;
    normalized.heroTurnEndsAt = null;
    normalized.turnQueue = Array.isArray(normalized.turnQueue)
      ? normalized.turnQueue.map((id) => id === 'player' ? id : normalizeMonsterId(id))
      : [];

    if (normalized.mode === GAME_MODES.OVERWORLD) {
      normalized.turnQueue = ['player'];
      normalized.monsters = [];
      normalized.combatContext = null;
      normalized.phase = PHASES.HERO;
    } else if (!normalized.turnQueue || normalized.turnQueue.length === 0) {
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
      attack: attack.damage,
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
    applyReward,
    assignedStatForDie,
    attackMonster,
    attackTile,
    confirmEnergy,
    endHeroPhase,
    getAttackableMonsters,
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
    loadGame,
    moveOverworldPlayer,
    movePlayer,
    newGame,
    newDungeonLegacyGame,
    saveGame,
    setOverworldMusicVolume: updateOverworldMusicVolume,
    setEvent,
    showBanner,
    startHeroTurn,
    startEnergyTurn,
    startOverworldEncounter,
    toggleAttackSelection,
  };
}
