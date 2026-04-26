import { BOARD_SIZE, LEVELS, PHASES, SAVE_KEY } from '../config/game-data.js';
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
import { createGame, levelMonsters, makeEnergyRoll } from './game-factories.js';

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

  function showBanner(title, subtitle = '', duration = 900, after = null) {
    getGame().banner = { title, subtitle, until: performance.now() + duration };

    window.setTimeout(() => {
      const game = getGame();
      if (game.banner && game.banner.title === title) game.banner = null;
      if (after) after();
    }, duration);
  }

  function startEnergyTurn(message = 'Arraste os dados para preparar seu turno.') {
    const game = getGame();
    const roll = makeEnergyRoll();

    game.phase = PHASES.ENERGY;
    game.roll = roll;
    game.energyAssigned = { speed: null, attack: null, defense: null };
    game.assignment = { speed: 0, attack: 0, defense: 0 };
    game.speedRemaining = 0;
    game.attackRemaining = 0;
    game.draggingDie = null;
    game.busy = false;

    setEvent(message);
    showBanner('Energia rolada', `Dados: ${roll.join(' • ')}`, 950);
  }

  function allDiceAssigned() {
    const game = getGame();
    return (
      game.energyAssigned.speed !== null &&
      game.energyAssigned.attack !== null &&
      game.energyAssigned.defense !== null
    );
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

  function getAttackableMonsters() {
    const game = getGame();
    if (game.phase !== PHASES.HERO || game.busy) return new Set();

    const attackable = new Set();
    const walls = levelWallsSet(game.levelIndex);

    for (const monster of game.monsters) {
      if (monster.hp <= 0) continue;
      if (game.attackRemaining < monster.defense) continue;

      const blockers = monsterOccupiedKeys(game.monsters, monster.id);
      const blocked = new Set([...walls, ...blockers]);
      const rangeCost = distanceBetween(game.player, monster, blocked, true);

      if (rangeCost <= game.player.rangeBase && hasLineOfSight(game.player, monster, walls, blockers)) {
        attackable.add(monster.id);
      }
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
    if (game.busy || game.phase !== PHASES.ENERGY || !allDiceAssigned()) return;

    const picked = {
      speed: game.roll[game.energyAssigned.speed],
      attack: game.roll[game.energyAssigned.attack],
      defense: game.roll[game.energyAssigned.defense],
    };

    game.assignment = picked;
    game.speedRemaining = game.player.speedBase + picked.speed;
    game.attackRemaining = game.player.attackBase + picked.attack;
    game.phase = PHASES.HERO;
    game.draggingDie = null;

    setEvent(
      `Seu turno. Vel ${game.speedRemaining}, Atq ${game.attackRemaining}, Def ${game.player.defenseBase + picked.defense}.`
    );
    showBanner('Seu turno', 'Mova e ataque em qualquer ordem.', 800);
  }

  function movePlayer(target) {
    const game = getGame();
    if (game.busy) return;

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
      durationPerTile: 120,
    });

    const totalDur = (data.path.length - 1) * 120;
    
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

  function attackMonster(monsterId) {
    const game = getGame();
    if (game.busy) return;

    const attackable = getAttackableMonsters();
    if (!attackable.has(monsterId)) return;

    const target = game.monsters.find((monster) => monster.id === monsterId);
    if (!target) return;

    const cost = target.defense;
    game.attackRemaining -= cost;
    target.hp -= 1;

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
      targetX: target.x,
      targetY: target.y,
      startTime: performance.now(),
      duration: 250
    });

    game.animations.push({
      type: 'damageShake',
      entityId: target.id,
      startTime: performance.now() + 250,
      duration: 350
    });

    game.animations.push({
      type: 'floatingText',
      x: target.x,
      y: target.y,
      text: '-1',
      color: '#ef4444',
      startTime: performance.now() + 150,
      duration: 1200
    });

    game.busy = true;

    if (target.hp <= 0) {
      setEvent(`${target.name} derrotado.`);
    } else {
      setEvent(`${target.name}: -1 vida. Gasto: ${target.defense} ataque.`);
    }

    setTimeout(() => {
      game.busy = false;

      if (target.hp <= 0) {
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
    }, 600);
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
      startEnergyTurn('Energia rolada automaticamente. Distribua os dados.');
    } else {
      game.phase = PHASES.MONSTER_TURN;
      game.busy = true;
      const monster = game.monsters.find(m => m.id === nextId);
      
      if (!monster) {
        advanceTurn(); // Failsafe
        return;
      }
      
      setEvent(`Turno de ${monster.name}.`);
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
        durationPerTile: 250, // Slower movement for monsters
      });
      monster.x = targetCell.x;
      monster.y = targetCell.y;
      moveWaitTime = (path.length - 1) * 250;
    }

    setTimeout(() => {
      if (game.phase === PHASES.WON || game.phase === PHASES.LOST) return;

      const blockers = new Set(
        game.monsters.filter(m => m.id !== monster.id && m.hp > 0).map(posKey)
      );
      const blocked = new Set([...walls, ...blockers]);
      const rangeCost = distanceBetween(monster, game.player, blocked, true);

      if (rangeCost <= monster.range && hasLineOfSight(monster, game.player, walls, blockers)) {
        const totalDefense = game.player.defenseBase + game.assignment.defense;
        const damage = Math.floor(monster.attack / Math.max(1, totalDefense));
        game.player.health = Math.max(0, game.player.health - damage);

        setEvent(`${monster.name} atacou! ATQ ${monster.attack} ÷ DEF ${totalDefense} = ${damage} dano.`);
        
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
          duration: 250
        });

        if (damage > 0) {
          game.animations.push({
            type: 'damageShake',
            entityId: 'player',
            startTime: performance.now() + 250,
            duration: 350
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

      setTimeout(() => advanceTurn(), 800);
    }, moveWaitTime);
  }

  function endHeroPhase() {
    const game = getGame();
    if (game.busy || game.phase !== PHASES.HERO) return;

    game.busy = true;
    advanceTurn();
  }



  function applyReward(kind) {
    const game = getGame();
    if (game.busy || game.phase !== PHASES.LEVELUP) return;

    const nextIndex = game.levelIndex + 1;
    const nextLevel = LEVELS[nextIndex];

    if (kind === 'heal') game.player.health = game.player.maxHealth;
    if (kind === 'speed') game.player.speedBase += 1;
    if (kind === 'attack') game.player.attackBase += 1;
    if (kind === 'defense') game.player.defenseBase += 1;
    if (kind === 'range') game.player.rangeBase += 1;

    game.levelIndex = nextIndex;
    game.player.x = nextLevel.start.x;
    game.player.y = nextLevel.start.y;
    game.monsters = levelMonsters(nextLevel);
    game.turnQueue = ['player', ...game.monsters.map(m => m.id)];

    setEvent(`Nível ${nextLevel.id}. Energia rolada automaticamente.`);
    startEnergyTurn(`Nível ${nextLevel.id}. Distribua os dados de energia.`);
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
    normalized.menuOpen = false;
    normalized.busy = false;
    normalized.animations = [];
    normalized.banner = null;
    
    if (!normalized.turnQueue || normalized.turnQueue.length === 0) {
       normalized.turnQueue = ['player', ...normalized.monsters.map(m => m.id)];
    }

    if (!Array.isArray(normalized.roll) || normalized.roll.length !== 3) {
      normalized.roll = normalized.phase === PHASES.ENERGY ? makeEnergyRoll() : fallback.roll;
    }

    if (!normalized.lastEvent) normalized.lastEvent = 'Jogo carregado.';
    if (!Number.isFinite(normalized.speedRemaining)) normalized.speedRemaining = 0;
    if (!Number.isFinite(normalized.attackRemaining)) normalized.attackRemaining = 0;
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
    showBanner('Novo jogo', `Dados: ${getGame().roll.join(' • ')}`, 1000);
  }

  function getTotals() {
    const game = getGame();

    return {
      speed: game.player.speedBase + game.assignment.speed,
      attack: game.player.attackBase + game.assignment.attack,
      defense: game.player.defenseBase + game.assignment.defense,
      range: game.player.rangeBase,
    };
  }

  return {
    allDiceAssigned,
    applyReward,
    assignedStatForDie,
    attackMonster,
    confirmEnergy,
    endHeroPhase,
    getAttackableMonsters,
    getGame,
    getMonsterReachableTiles,
    getReachableTiles,
    getTotals,
    loadGame,
    movePlayer,
    newGame,
    saveGame,
    setEvent,
    showBanner,
    startEnergyTurn,
  };
}
