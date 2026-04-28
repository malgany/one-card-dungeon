import {
  ACTION_RULES,
  CARD_SOURCES,
  GAME_MODES,
  LEVELS,
  MONSTER_TEMPLATES,
  OVERWORLD_MAPS,
  PHASES,
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
  const template = MONSTER_TEMPLATES[type];

  return {
    id: `${type}-${index}-${x}-${y}`,
    type,
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

export function createOverworldEnemy(type, x, y, groupId, index) {
  const template = MONSTER_TEMPLATES[type];

  return {
    id: `overworld-${groupId}-${index}`,
    type,
    x,
    y,
    groupId,
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
  return map.enemies.map((enemy, index) => {
    return createOverworldEnemy(enemy[0], enemy[1], enemy[2], enemy[3], index);
  });
}

export function createPlayer(position) {
  return {
    x: position.x,
    y: position.y,
    health: 60,
    maxHealth: 60,
    apMax: ACTION_RULES.BASE_AP,
    speedBase: 4,
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

export function createOverworldGame(map = OVERWORLD_MAPS[0]) {
  const player = createPlayer(map.playerStart);

  return {
    mode: GAME_MODES.OVERWORLD,
    levelIndex: 0,
    player,
    monsters: [],
    overworld: {
      mapId: map.id,
      width: map.width,
      height: map.height,
      walls: map.walls.map(([x, y]) => [x, y]),
      playerStart: { ...map.playerStart },
      enemies: overworldEnemies(map),
    },
    combatContext: null,
    phase: PHASES.HERO,
    ...createBaseUiState(),
    speedRemaining: player.speedBase,
    apRemaining: player.apMax,
    turnCount: 0,
    turnQueue: ['player'],
    banner: {
      title: 'Mapa aberto',
      subtitle: 'Clique para andar. Clique em inimigos para lutar.',
      until: performance.now() + 1400,
      cardKey: 'player',
      accent: '#34d399',
    },
    lastEvent: 'Explore o mapa aberto.',
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
    speedRemaining: 4,
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
    lastEvent: `Sua vez. ${ACTION_RULES.BASE_AP} AP, ${4} movimento.`,
  };
}

export function createGame() {
  return createOverworldGame();
}
