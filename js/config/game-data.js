export const BOARD_SIZE = 6;
export const SAVE_KEY = 'one-card-dungeon-canvas-v4';

export const GAME_MODES = {
  OVERWORLD: 'overworld',
  COMBAT: 'combat',
  DUNGEON_LEGACY: 'dungeonLegacy',
};

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

export const ACTION_RULES = {
  BASE_AP: 6,
  BASIC_ATTACK: {
    id: 'strike',
    name: 'Golpe',
    apCost: 5,
    damage: 10,
    lifeSteal: 0,
  },
};

export const STAT_META = {
  ap: { label: 'Ação', icon: '⚡', short: 'AP' },
  speed: { label: 'Velocidade', icon: '🏃', short: 'VEL' },
  attack: { label: 'Ataque', icon: '⚔️', short: 'ATQ' },
  defense: { label: 'Defesa', icon: '🛡️', short: 'DEF' },
};

export const MONSTER_TEMPLATES = {
  skeletonMinion: { name: 'Esqueleto Minion', emoji: '💀', hp: 20, attack: 2, defense: 1, range: 3, speed: 3, tint: '#6b7280' },
  skeletonWarrior: { name: 'Esqueleto Guerreiro', emoji: '💀', hp: 30, attack: 3, defense: 2, range: 3, speed: 3, tint: '#58606c' },
  skeletonRogue: { name: 'Esqueleto Rogue', emoji: '💀', hp: 20, attack: 2, defense: 2, range: 5, speed: 3, tint: '#7c5c35' },
  specter: { name: 'Espectro', emoji: '👻', hp: 30, attack: 4, defense: 2, range: 4, speed: 3, tint: '#5934a3' },
  skeletonMage: { name: 'Esqueleto Mago', emoji: '💀', hp: 50, attack: 4, defense: 3, range: 2, speed: 3, tint: '#52525b' },
  boss: { name: 'Guardião', emoji: '👹', hp: 60, attack: 5, defense: 4, range: 4, speed: 3, tint: '#8f1414' },
};

export const LEGACY_MONSTER_TYPE_MAP = {
  spider: 'skeletonMinion',
  skeleton: 'skeletonWarrior',
  archer: 'skeletonRogue',
  golem: 'skeletonMage',
};

export const LEGACY_ENCOUNTER_GROUP_MAP = {
  'nest-a': 'skeleton-minions',
  'ruins-b': 'skeleton-warriors',
  'stone-c': 'skeleton-mages',
  'stone-grove-watch': 'skeleton-warrior-watch',
};

export function normalizeMonsterType(type) {
  return LEGACY_MONSTER_TYPE_MAP[type] || type;
}

export function normalizeEncounterGroupId(groupId) {
  return LEGACY_ENCOUNTER_GROUP_MAP[groupId] || groupId;
}

export function normalizeMonsterId(id) {
  if (typeof id !== 'string') return id;

  let normalized = id;
  for (const [legacyType, modernType] of Object.entries(LEGACY_MONSTER_TYPE_MAP)) {
    if (normalized.startsWith(`${legacyType}-`)) {
      normalized = `${modernType}${normalized.slice(legacyType.length)}`;
    }
  }
  for (const [legacyGroup, modernGroup] of Object.entries(LEGACY_ENCOUNTER_GROUP_MAP)) {
    if (normalized.startsWith(`${legacyGroup}-`)) {
      normalized = `${modernGroup}${normalized.slice(legacyGroup.length)}`;
    }
    normalized = normalized.replace(`-${legacyGroup}-`, `-${modernGroup}-`);
  }

  return normalized;
}

export const CARD_SOURCES = {
  player: './assets/characters/mage.png',
  mage: './assets/characters/mage.png',
  barbarian: './assets/characters/barbarian.png',
  knight: './assets/characters/knight.png',
  ranger: './assets/characters/ranger.png',
  rogue: './assets/characters/rogue.png',
  skeletonMinion: './assets/characters/skeleton-minion.png',
  skeletonWarrior: './assets/characters/skeleton-warrior.png',
  skeletonRogue: './assets/characters/skeleton-rogue.png',
  specter: './assets/characters/skeleton-mage.png',
  skeletonMage: './assets/characters/skeleton-mage.png',
  boss: './assets/characters/skeleton-warrior.png',
  actionStrike: './assets/ui/actions/strike-punch.png',
};

export const LEVELS = [
  { id: 1, start: { x: 0, y: 5 }, walls: [[2, 1], [2, 2], [4, 3]], monsters: [['skeletonMinion', 4, 0], ['skeletonMinion', 5, 2]] },
  { id: 2, start: { x: 0, y: 5 }, walls: [[1, 2], [2, 2], [3, 3], [4, 1]], monsters: [['skeletonMinion', 5, 0], ['skeletonWarrior', 4, 4]] },
  { id: 3, start: { x: 1, y: 5 }, walls: [[2, 0], [2, 1], [2, 3], [4, 3]], monsters: [['skeletonMinion', 0, 0], ['skeletonWarrior', 5, 1], ['skeletonWarrior', 5, 5]] },
  { id: 4, start: { x: 0, y: 5 }, walls: [[1, 1], [3, 1], [1, 3], [3, 3], [4, 4]], monsters: [['skeletonRogue', 5, 0], ['skeletonWarrior', 5, 3]] },
  { id: 5, start: { x: 1, y: 5 }, walls: [[0, 2], [2, 2], [4, 2], [3, 4], [5, 4]], monsters: [['skeletonRogue', 5, 0], ['skeletonRogue', 3, 0], ['skeletonWarrior', 0, 0]] },
  { id: 6, start: { x: 0, y: 5 }, walls: [[1, 1], [2, 1], [3, 1], [3, 3], [3, 4]], monsters: [['specter', 5, 0], ['skeletonWarrior', 5, 5]] },
  { id: 7, start: { x: 0, y: 5 }, walls: [[2, 0], [2, 1], [2, 3], [2, 4], [4, 2]], monsters: [['skeletonRogue', 5, 0], ['specter', 4, 4], ['skeletonWarrior', 0, 0]] },
  { id: 8, start: { x: 1, y: 5 }, walls: [[0, 1], [1, 1], [4, 1], [4, 2], [2, 4]], monsters: [['skeletonMage', 5, 2], ['skeletonRogue', 5, 0]] },
  { id: 9, start: { x: 0, y: 5 }, walls: [[1, 2], [2, 2], [3, 2], [4, 2], [2, 4], [4, 4]], monsters: [['skeletonMage', 5, 5], ['specter', 5, 0], ['skeletonRogue', 0, 0]] },
  { id: 10, start: { x: 1, y: 5 }, walls: [[1, 1], [3, 1], [5, 1], [1, 3], [3, 3], [5, 3]], monsters: [['specter', 0, 0], ['skeletonMage', 4, 5], ['skeletonRogue', 5, 0]] },
  { id: 11, start: { x: 0, y: 5 }, walls: [[2, 1], [2, 2], [2, 3], [4, 1], [4, 2], [4, 3]], monsters: [['skeletonMage', 5, 4], ['specter', 5, 0], ['specter', 0, 0]] },
];

export {
  BIOMES,
  START_WORLD_MAP_ID,
  TERRAIN_TYPES,
  WORLD_ASSETS,
  WORLD_MAPS,
  WORLD_OBJECT_TYPES,
  getWorldMap,
} from './world/index.js';

export const TIMING = {
  TURN_BANNER: 1600,       // Duration of the "Turn of X" banner
  POST_BANNER_PAUSE: 1000, // Extra pause after banner disappears before action
  POST_ACTION_PAUSE: 1000, // Extra pause after action ends before next turn
  HERO_TURN_DURATION: 50000, // Hero turn limit in combat
  MONSTER_MOVE_SPEED: 250, // ms per tile for monsters
  PLAYER_MOVE_SPEED: 260,  // ms per tile for player in combat
  OVERWORLD_PLAYER_MOVE_SPEED: 300, // ms per tile in overworld
  ATTACK_BUMP_DURATION: 250,
  PLAYER_ATTACK_ANIMATION: 670,
  PLAYER_DAMAGE_ANIMATION: 870,
  PLAYER_DEATH_ANIMATION: 800,
  PLAYER_DEFEAT_EXIT_PAUSE: 700,
  DAMAGE_SHAKE_DURATION: 350,
  HERO_ATTACK_WAIT_TIME: 600, // Wait time after hero attack before busy=false
};

export const DEBUG_CONFIG = {
  SHOW_STATS: import.meta.env.VITE_ONE_RPG_DEBUG === 'true',
};
