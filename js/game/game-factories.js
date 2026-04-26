import {
  CARD_SOURCES,
  LEVELS,
  MONSTER_TEMPLATES,
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

export function levelMonsters(level) {
  return level.monsters.map((monster, index) => {
    return createMonster(monster[0], monster[1], monster[2], index);
  });
}

export function createGame() {
  const level = LEVELS[0];
  const roll = makeEnergyRoll();
  const monsters = levelMonsters(level);

  return {
    levelIndex: 0,
    player: {
      x: level.start.x,
      y: level.start.y,
      health: 6,
      maxHealth: 6,
      speedBase: 1,
      attackBase: 1,
      defenseBase: 1,
      rangeBase: 2,
    },
    monsters,
    phase: PHASES.ENERGY,
    roll,
    energyAssigned: { speed: null, attack: null, defense: null },
    assignment: { speed: 0, attack: 0, defense: 0 },
    speedRemaining: 0,
    attackRemaining: 0,
    turnCount: 1,
    buttons: [],
    diceRects: [],
    dropZones: [],
    draggingDie: null,
    menuOpen: false,
    animations: [],
    turnQueue: ['player', ...monsters.map(m => m.id)],
    banner: {
      title: 'Dados rolados',
      subtitle: `Distribua os dados: ${roll.join(' - ')}`,
      until: performance.now() + 1200,
    },
    busy: false,
    lastEvent: 'Arraste cada dado para Velocidade, Ataque e Defesa.',
  };
}
