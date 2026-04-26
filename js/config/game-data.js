export const BOARD_SIZE = 6;
export const SAVE_KEY = 'one-card-dungeon-canvas-v3';

export const PHASES = {
  ENERGY: 'energy',
  HERO: 'hero',
  MONSTER_TURN: 'monsterTurn',
  MONSTER_MOVE: 'monsterMove',
  MONSTER_ATTACK: 'monsterAttack',
  LEVELUP: 'levelup',
  WON: 'won',
  LOST: 'lost',
};

export const STAT_META = {
  speed: { label: 'Velocidade', icon: '🏃', short: 'VEL' },
  attack: { label: 'Ataque', icon: '⚔️', short: 'ATQ' },
  defense: { label: 'Defesa', icon: '🛡️', short: 'DEF' },
};

export const MONSTER_TEMPLATES = {
  spider: { name: 'Aranha', emoji: '🕷️', hp: 2, attack: 2, defense: 1, range: 3, speed: 5, tint: '#8b2f2f' },
  skeleton: { name: 'Esqueleto', emoji: '💀', hp: 3, attack: 3, defense: 2, range: 3, speed: 5, tint: '#58606c' },
  archer: { name: 'Arqueiro', emoji: '🏹', hp: 2, attack: 2, defense: 2, range: 5, speed: 4, tint: '#9a5b13' },
  specter: { name: 'Espectro', emoji: '👻', hp: 3, attack: 4, defense: 2, range: 4, speed: 6, tint: '#5934a3' },
  golem: { name: 'Golem', emoji: '🪨', hp: 5, attack: 4, defense: 3, range: 2, speed: 4, tint: '#4f4943' },
  boss: { name: 'Guardião', emoji: '👹', hp: 6, attack: 5, defense: 4, range: 4, speed: 6, tint: '#8f1414' },
};

export const CARD_SOURCES = {
  player: './assets/aventureiro.png',
  spider: './assets/aranha.png',
  skeleton: './assets/esqueleto.png',
  archer: './assets/arqueiro.png',
  specter: './assets/espectro.png',
  golem: './assets/golem.png',
  boss: './assets/guardiao.png',
};

export const LEVELS = [
  { id: 1, start: { x: 0, y: 5 }, walls: [[2, 1], [2, 2], [4, 3]], monsters: [['spider', 4, 0], ['spider', 5, 2]] },
  { id: 2, start: { x: 0, y: 5 }, walls: [[1, 2], [2, 2], [3, 3], [4, 1]], monsters: [['spider', 5, 0], ['skeleton', 4, 4]] },
  { id: 3, start: { x: 1, y: 5 }, walls: [[2, 0], [2, 1], [2, 3], [4, 3]], monsters: [['spider', 0, 0], ['skeleton', 5, 1], ['skeleton', 5, 5]] },
  { id: 4, start: { x: 0, y: 5 }, walls: [[1, 1], [3, 1], [1, 3], [3, 3], [4, 4]], monsters: [['archer', 5, 0], ['skeleton', 5, 3]] },
  { id: 5, start: { x: 1, y: 5 }, walls: [[0, 2], [2, 2], [4, 2], [3, 4], [5, 4]], monsters: [['archer', 5, 0], ['archer', 3, 0], ['skeleton', 0, 0]] },
  { id: 6, start: { x: 0, y: 5 }, walls: [[1, 1], [2, 1], [3, 1], [3, 3], [3, 4]], monsters: [['specter', 5, 0], ['skeleton', 5, 5]] },
  { id: 7, start: { x: 0, y: 5 }, walls: [[2, 0], [2, 1], [2, 3], [2, 4], [4, 2]], monsters: [['archer', 5, 0], ['specter', 4, 4], ['skeleton', 0, 0]] },
  { id: 8, start: { x: 1, y: 5 }, walls: [[0, 1], [1, 1], [4, 1], [4, 2], [2, 4]], monsters: [['golem', 5, 2], ['archer', 5, 0]] },
  { id: 9, start: { x: 0, y: 5 }, walls: [[1, 2], [2, 2], [3, 2], [4, 2], [2, 4], [4, 4]], monsters: [['golem', 5, 5], ['specter', 5, 0], ['archer', 0, 0]] },
  { id: 10, start: { x: 1, y: 5 }, walls: [[1, 1], [3, 1], [5, 1], [1, 3], [3, 3], [5, 3]], monsters: [['specter', 0, 0], ['golem', 4, 5], ['archer', 5, 0]] },
  { id: 11, start: { x: 0, y: 5 }, walls: [[2, 1], [2, 2], [2, 3], [4, 1], [4, 2], [4, 3]], monsters: [['golem', 5, 4], ['specter', 5, 0], ['specter', 0, 0]] },
  { id: 12, start: { x: 1, y: 5 }, walls: [[1, 1], [2, 1], [4, 1], [1, 3], [3, 3], [4, 3]], monsters: [['boss', 5, 0], ['specter', 3, 0], ['golem', 5, 5]] },
];
