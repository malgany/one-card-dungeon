import { ACTION_RULES, BOARD_SIZE, LEVELS, PHASES, SAVE_KEY, TIMING } from '../config/game-data.js';
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
import { createGame, levelMonsters } from './game-factories.js';

export function createGameActions(state) {

  function getGame() {
    return state.game;
  }

  function setGame(nextGame) {
    state.game = nextGame;
    return state.game;
  }

  function setEvent(text) {
    getGame().lastEvent = text;
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

  function showTurnBanner(title, subtitle, cardKey, accent = '#facc15') {
    showBanner(title, subtitle, TIMING.TURN_BANNER, null, {
      cardKey,
      accent,
    });
  }

  function getEquippedAttack(game = getGame()) {
    return {
      ...ACTION_RULES.BASIC_ATTACK,
      ...(game.player.attackSlot || {}),
    };
  }

  function getMitigatedDamage(rawDamage, defense) {
    return Math.max(0, rawDamage - Math.max(0, defense));
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

    setEvent(message || `Sua vez. ${game.apRemaining} AP, ${game.speedRemaining} movimento.`);
    showTurnBanner('Sua vez', `${game.apRemaining} AP para agir`, 'player', '#34d399');
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

  function getMovementData() {
    const game = getGame();
    const blocked = new Set([
      ...levelWallsSet(game.levelIndex),
      ...monsterOccupiedKeys(game.monsters),
    ]);

    blocked.delete(posKey(game.player));
    return dijkstra(game.player, blocked);
  }

  function getReachableTiles() {
    const game = getGame();
    if (game.phase !== PHASES.HERO || game.busy) return new Map();
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
    if (game.busy) return new Map();

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
    if (game.busy) return new Set();

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
    if (game.phase !== PHASES.HERO || game.busy) return attackTiles;

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
    if (game.phase !== PHASES.HERO || game.busy) return new Set();

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

  function confirmEnergy() {
    const game = getGame();
    if (game.busy || game.phase !== PHASES.ENERGY) return;
    startHeroTurn('Vez iniciada sem rolagem de dados.');
  }

  function movePlayer(target) {
    const game = getGame();
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
      color: '#22c55e',
      startTime: performance.now() + totalDur,
      duration: 1200
    });

    window.setTimeout(() => { game.busy = false; }, totalDur);

    setEvent(`Movimento: -${data.cost} velocidade.`);
  }

  function attackTile(targetCell) {
    const game = getGame();
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
      color: '#eab308',
      startTime: performance.now(),
      duration: 1200
    });

    game.animations.push({
      type: 'bumpAttack',
      entityId: 'player',
      targetX: targetCell.x,
      targetY: targetCell.y,
      startTime: performance.now(),
      duration: TIMING.ATTACK_BUMP_DURATION
    });

    let damage = 0;
    let healed = 0;
    if (target) {
      damage = getMitigatedDamage(attack.damage, target.defense);
      target.hp = Math.max(0, target.hp - damage);

      healed = damage > 0
        ? Math.min(attack.lifeSteal, game.player.maxHealth - game.player.health)
        : 0;
      if (healed > 0) game.player.health += healed;

      game.animations.push({
        type: 'damageShake',
        entityId: target.id,
        startTime: performance.now() + TIMING.ATTACK_BUMP_DURATION,
        duration: TIMING.DAMAGE_SHAKE_DURATION
      });

      game.animations.push({
        type: 'floatingText',
        x: target.x,
        y: target.y,
        text: `-${damage}`,
        color: '#ef4444',
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
          if (game.levelIndex === LEVELS.length - 1) {
            game.phase = PHASES.WON;
            showBanner('Vitória!', 'Você encontrou o Cetro de M’Guf-yn.', 2000);
            return;
          }

          game.phase = PHASES.LEVELUP;
          showBanner('Nível concluído', 'Escolha curar ou melhorar um atributo.', 1200);
        }
      }
    }, TIMING.HERO_ATTACK_WAIT_TIME);

    return true;
  }

  function attackMonster(monsterId) {
    const game = getGame();
    const target = game.monsters.find((monster) => monster.id === monsterId);
    if (!target) return false;
    return attackTile(target);
  }

  function advanceTurn() {
    const game = getGame();
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
      showTurnBanner(`Vez de ${monster.name}`, monster.name, monster.type, monster.tint);
      setTimeout(() => executeMonsterTurn(monster), TIMING.TURN_BANNER + TIMING.POST_BANNER_PAUSE);
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
          color: '#eab308',
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

        if (damage > 0) {
          game.animations.push({
            type: 'damageShake',
            entityId: 'player',
            startTime: performance.now() + TIMING.ATTACK_BUMP_DURATION,
            duration: TIMING.DAMAGE_SHAKE_DURATION
          });
        }

        game.animations.push({
          type: 'floatingText',
          x: game.player.x,
          y: game.player.y,
          text: `-${damage}`,
          color: '#ef4444',
          startTime: performance.now() + 150,
          duration: 1200
        });

        if (game.player.health <= 0) {
          game.phase = PHASES.LOST;
          game.busy = false;
          showBanner('Derrota', 'Seu aventureiro caiu na masmorra.', 2000);
          return;
        }
      } else if (!samePos(destination, monster)) {
        setEvent(`${monster.name} se moveu.`);
      }

      setEvent(`Fim da vez: ${monster.name}`);
      setTimeout(() => advanceTurn(), TIMING.POST_ACTION_PAUSE);
    }, moveWaitTime);
  }

  function endHeroPhase() {
    const game = getGame();
    if (game.busy || game.phase !== PHASES.HERO) return;

    game.busy = true;
    game.selectedAttackId = null;
    setEvent('Fim da vez: Aventureiro');
    showBanner('Fim da vez', 'Aventureiro', 800, () => {
      advanceTurn();
    });
  }



  function toggleAttackSelection() {
    const game = getGame();
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

    setEvent(`Nível ${nextLevel.id}. Vez iniciada.`);
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
        selectedAttackId: null,
        menuOpen: false,
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(safeGame));
      game.menuOpen = false;
      showBanner('Jogo salvo', 'Progresso salvo neste navegador.', 900);
    } catch {
      showBanner('Erro', 'Não foi possível salvar.', 900);
    }
  }

  function normalizeLoadedGame(loaded) {
    const fallback = createGame();
    if (!loaded || typeof loaded !== 'object') return fallback;

    const levelIndex = Number.isInteger(loaded.levelIndex)
      ? Math.max(0, Math.min(loaded.levelIndex, LEVELS.length - 1))
      : fallback.levelIndex;

    const normalized = {
      ...fallback,
      ...loaded,
      levelIndex,
      player: {
        ...fallback.player,
        ...(loaded.player || {}),
      },
      monsters: Array.isArray(loaded.monsters) ? loaded.monsters : levelMonsters(LEVELS[levelIndex]),
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
    if (!Number.isFinite(normalized.turnCount)) normalized.turnCount = 1;

    return normalized;
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        showBanner('Sem save', 'Nenhum jogo salvo encontrado.', 900);
        return;
      }

      setGame(normalizeLoadedGame(JSON.parse(raw)));
      showBanner('Jogo carregado', 'Continue sua descida.', 900);
    } catch {
      showBanner('Erro', 'Não foi possível carregar.', 900);
    }
  }

  function newGame() {
    setGame(createGame());
    showBanner('Novo jogo', `${getGame().player.apMax} AP para agir`, 1000);
  }

  function getTotals() {
    const game = getGame();
    const attack = getEquippedAttack(game);

    return {
      speed: game.player.speedBase + game.assignment.speed,
      attack: attack.damage,
      attackCost: attack.apCost,
      attackLifeSteal: attack.lifeSteal,
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
    getPlayerAttackTiles,
    getReachableTiles,
    getTotals,
    getEquippedAttack,
    loadGame,
    movePlayer,
    newGame,
    saveGame,
    setEvent,
    showBanner,
    startHeroTurn,
    startEnergyTurn,
    toggleAttackSelection,
  };
}
