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
    element: 'neutral',
    apCost: 4,
    damage: 11,
    lifeSteal: 0,
    minRange: 1,
    pattern: 'path',
    iconKey: 'actionStrike',
  },
};

export const SPELL_ELEMENTS = {
  NEUTRAL: 'neutral',
  EARTH: 'earth',
  FIRE: 'fire',
  AIR: 'air',
  WATER: 'water',
};

export const ATTACK_PATTERNS = {
  PATH: 'path',
  CROSS: 'cross',
  LINE_8: 'line8',
};

export const SPELL_DEFINITIONS = {
  mage: [
    {
      id: 'mageFireBucket',
      name: 'Balde de Fogo',
      element: SPELL_ELEMENTS.FIRE,
      apCost: 4,
      damage: 11,
      lifeSteal: 0,
      minRange: 2,
      maxRange: 5,
      pattern: ATTACK_PATTERNS.PATH,
      unlockLevel: 3,
      iconKey: 'characteristicFire',
    },
    {
      id: 'mageFonteCinzas',
      name: 'Fonte de Cinzas',
      element: SPELL_ELEMENTS.FIRE,
      apCost: 4,
      damage: 9,
      lifeSteal: 4,
      minRange: 2,
      maxRange: 4,
      pattern: ATTACK_PATTERNS.PATH,
      unlockLevel: 5,
      iconKey: 'spellMageFonteCinzas',
    },
    {
      id: 'mageAmpulhetaMare',
      name: 'Ampulheta da Mare',
      element: SPELL_ELEMENTS.WATER,
      apCost: 3,
      damage: 9,
      lifeSteal: 0,
      minRange: 3,
      maxRange: 6,
      pattern: ATTACK_PATTERNS.LINE_8,
      unlockLevel: 8,
      iconKey: 'spellMageAmpulhetaMare',
      effects: {
        nextTurnApBonus: { amount: 1, maxBonus: 1 },
      },
    },
  ],
  knight: [
    {
      id: 'knightStoneLance',
      name: 'Lança de Pedra',
      element: SPELL_ELEMENTS.EARTH,
      apCost: 5,
      damage: 14,
      lifeSteal: 0,
      minRange: 1,
      maxRange: 3,
      pattern: ATTACK_PATTERNS.CROSS,
      unlockLevel: 3,
      iconKey: 'characteristicEarth',
    },
    {
      id: 'knightCorteVendaval',
      name: 'Corte de Vendaval',
      element: SPELL_ELEMENTS.AIR,
      apCost: 4,
      damage: 9,
      lifeSteal: 0,
      minRange: 2,
      maxRange: 4,
      pattern: ATTACK_PATTERNS.CROSS,
      unlockLevel: 5,
      iconKey: 'spellKnightCorteVendaval',
      effects: {
        moveTarget: { direction: 'pull', distance: 1 },
      },
    },
    {
      id: 'knightQuebraBaluarte',
      name: 'Quebra-Baluarte',
      element: SPELL_ELEMENTS.EARTH,
      apCost: 3,
      damage: 10,
      lifeSteal: 0,
      minRange: 1,
      maxRange: 2,
      pattern: ATTACK_PATTERNS.CROSS,
      unlockLevel: 8,
      iconKey: 'spellKnightQuebraBaluarte',
      effects: {
        splashDamage: { ratio: 0.4, radius: 1 },
      },
    },
  ],
  barbarian: [
    {
      id: 'barbarianBoulderHurl',
      name: 'Rocha Brutal',
      element: SPELL_ELEMENTS.EARTH,
      apCost: 5,
      damage: 13,
      lifeSteal: 0,
      minRange: 2,
      maxRange: 4,
      pattern: ATTACK_PATTERNS.PATH,
      unlockLevel: 3,
      iconKey: 'characteristicEarth',
    },
    {
      id: 'barbarianTremorPedra',
      name: 'Tremor de Pedra',
      element: SPELL_ELEMENTS.EARTH,
      apCost: 5,
      damage: 12,
      lifeSteal: 0,
      minRange: 1,
      maxRange: 2,
      pattern: ATTACK_PATTERNS.CROSS,
      unlockLevel: 5,
      iconKey: 'spellBarbarianTremorPedra',
      effects: {
        splashDamage: { ratio: 0.5, radius: 1 },
      },
    },
    {
      id: 'barbarianRugidoBrasa',
      name: 'Rugido de Brasa',
      element: SPELL_ELEMENTS.FIRE,
      apCost: 3,
      damage: 8,
      lifeSteal: 5,
      minRange: 1,
      maxRange: 3,
      pattern: ATTACK_PATTERNS.PATH,
      unlockLevel: 8,
      iconKey: 'spellBarbarianRugidoBrasa',
    },
  ],
  ranger: [
    {
      id: 'rangerVerdantArrow',
      name: 'Flecha Hirvante',
      element: SPELL_ELEMENTS.AIR,
      apCost: 4,
      damage: 10,
      lifeSteal: 0,
      minRange: 2,
      maxRange: 6,
      pattern: ATTACK_PATTERNS.CROSS,
      unlockLevel: 3,
      iconKey: 'spellVerdantArrow',
    },
    {
      id: 'rangerFlechaIncendiaria',
      name: 'Flecha Incendiaria',
      element: SPELL_ELEMENTS.FIRE,
      apCost: 4,
      damage: 10,
      lifeSteal: 3,
      minRange: 3,
      maxRange: 6,
      pattern: ATTACK_PATTERNS.CROSS,
      unlockLevel: 5,
      iconKey: 'spellRangerFlechaIncendiaria',
    },
    {
      id: 'rangerDisparoCiclone',
      name: 'Disparo Ciclone',
      element: SPELL_ELEMENTS.AIR,
      apCost: 3,
      damage: 9,
      lifeSteal: 0,
      minRange: 2,
      maxRange: 6,
      pattern: ATTACK_PATTERNS.LINE_8,
      unlockLevel: 8,
      iconKey: 'spellRangerDisparoCiclone',
      effects: {
        moveTarget: { direction: 'push', distance: 2 },
      },
    },
  ],
  rogue: [
    {
      id: 'rogueTideDagger',
      name: 'Adaga da Maré',
      element: SPELL_ELEMENTS.WATER,
      apCost: 4,
      damage: 10,
      lifeSteal: 0,
      minRange: 2,
      maxRange: 5,
      pattern: ATTACK_PATTERNS.LINE_8,
      unlockLevel: 3,
      iconKey: 'characteristicWater',
    },
    {
      id: 'rogueCorteRessaca',
      name: 'Corte da Ressaca',
      element: SPELL_ELEMENTS.WATER,
      apCost: 4,
      damage: 9,
      lifeSteal: 0,
      minRange: 2,
      maxRange: 5,
      pattern: ATTACK_PATTERNS.LINE_8,
      unlockLevel: 5,
      iconKey: 'spellRogueCorteRessaca',
      effects: {
        nextTurnApBonus: { amount: 1, maxBonus: 1 },
      },
    },
    {
      id: 'rogueEspelhoAfogado',
      name: 'Espelho Afogado',
      element: SPELL_ELEMENTS.WATER,
      apCost: 3,
      damage: 8,
      lifeSteal: 0,
      minRange: 1,
      maxRange: 4,
      pattern: ATTACK_PATTERNS.LINE_8,
      unlockLevel: 8,
      iconKey: 'spellRogueEspelhoAfogado',
      effects: {
        nextTurnApBonus: { amount: 1, maxBonus: 2 },
      },
    },
  ],
};

export const XP_RULES = {
  BASE_LEVEL_XP: 20,
  LEVEL_XP_STEP: 10,
  POINTS_PER_LEVEL: 3,
  LIFE_PER_POINT: 5,
  ELEMENT_DAMAGE_PER_POINT: 1,
};

export const CHARACTERISTIC_DEFINITIONS = {
  life: {
    key: 'life',
    label: 'Vida',
    color: '#cf4f3f',
    iconKey: 'characteristicLife',
  },
  earth: {
    key: 'earth',
    label: 'Terra',
    color: '#9b6a3f',
    element: SPELL_ELEMENTS.EARTH,
    iconKey: 'characteristicEarth',
  },
  fire: {
    key: 'fire',
    label: 'Fogo',
    color: '#d9572b',
    element: SPELL_ELEMENTS.FIRE,
    iconKey: 'characteristicFire',
  },
  air: {
    key: 'air',
    label: 'Ar',
    color: '#6cab4f',
    element: SPELL_ELEMENTS.AIR,
    iconKey: 'characteristicAir',
  },
  water: {
    key: 'water',
    label: 'Água',
    color: '#3b8fd9',
    element: SPELL_ELEMENTS.WATER,
    iconKey: 'characteristicWater',
  },
};

export const STAT_META = {
  ap: { label: 'Ação', icon: '⚡', short: 'AP' },
  speed: { label: 'Velocidade', icon: '🏃', short: 'VEL' },
  attack: { label: 'Ataque', icon: '⚔️', short: 'ATQ' },
  defense: { label: 'Defesa', icon: '🛡️', short: 'DEF' },
};

export const MONSTER_TEMPLATES = {
  skeletonMinion: { name: 'Esqueleto Minion', emoji: '💀', hp: 20, attack: 2, defense: 1, range: 3, speed: 3, xp: 10, tint: '#6b7280' },
  skeletonWarrior: { name: 'Esqueleto Guerreiro', emoji: '💀', hp: 30, attack: 3, defense: 2, range: 3, speed: 3, xp: 15, tint: '#58606c' },
  skeletonRogue: { name: 'Esqueleto Rogue', emoji: '💀', hp: 20, attack: 2, defense: 2, range: 5, speed: 3, xp: 15, tint: '#7c5c35' },
  specter: { name: 'Espectro', emoji: '👻', hp: 30, attack: 4, defense: 2, range: 4, speed: 3, xp: 20, tint: '#5934a3' },
  skeletonMage: { name: 'Esqueleto Mago', emoji: '💀', hp: 42, attack: 4, defense: 2, range: 2, speed: 3, xp: 24, tint: '#52525b' },
  boss: { name: 'Guardião', emoji: '👹', hp: 60, attack: 5, defense: 4, range: 4, speed: 3, xp: 60, tint: '#8f1414' },
};

const LEGACY_MONSTER_TYPE_MAP = {
  spider: 'skeletonMinion',
  skeleton: 'skeletonWarrior',
  archer: 'skeletonRogue',
  golem: 'skeletonMage',
};

const LEGACY_ENCOUNTER_GROUP_MAP = {
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
  spellVerdantArrow: './assets/ui/actions/ranger-verdant-arrow.png',
  spellBarbarianTremorPedra: './assets/ui/actions/barbarian-tremor-de-pedra.png',
  spellBarbarianRugidoBrasa: './assets/ui/actions/barbarian-rugido-de-brasa.png',
  spellKnightCorteVendaval: './assets/ui/actions/knight-corte-de-vendaval.png',
  spellKnightQuebraBaluarte: './assets/ui/actions/knight-quebra-baluarte.png',
  spellRogueCorteRessaca: './assets/ui/actions/rogue-corte-da-ressaca.png',
  spellRogueEspelhoAfogado: './assets/ui/actions/rogue-espelho-afogado.png',
  spellMageFonteCinzas: './assets/ui/actions/mage-fonte-de-cinzas.png',
  spellMageAmpulhetaMare: './assets/ui/actions/mage-ampulheta-da-mare.png',
  spellRangerFlechaIncendiaria: './assets/ui/actions/ranger-flecha-incendiaria.png',
  spellRangerDisparoCiclone: './assets/ui/actions/ranger-disparo-ciclone.png',
  characteristics: './assets/ui/icons/characteristics.png',
  spells: './assets/ui/icons/spells.png',
  characteristicLife: './assets/ui/icons/characteristic-life.png',
  characteristicEarth: './assets/ui/icons/characteristic-earth.png',
  characteristicFire: './assets/ui/icons/characteristic-fire.png',
  characteristicAir: './assets/ui/icons/characteristic-air.png',
  characteristicWater: './assets/ui/icons/characteristic-water.png',
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
  MONSTER_DEATH_ANIMATION: 800,
  MONSTER_DEFEAT_EXIT_PAUSE: 600,
  DAMAGE_SHAKE_DURATION: 350,
  HERO_ATTACK_WAIT_TIME: 600, // Wait time after hero attack before busy=false
  OVERWORLD_MAP_FADE_IN: 260,
  OVERWORLD_MAP_FADE_HOLD: 120,
  OVERWORLD_MAP_FADE_OUT: 380,
  OVERWORLD_ENEMY_RESPAWN_MIN: 60000,
  OVERWORLD_ENEMY_RESPAWN_MAX: 90000,
  OVERWORLD_ENEMY_RESPAWN_STAGGER_MIN: 5000,
  OVERWORLD_ENEMY_RESPAWN_STAGGER_MAX: 15000,
  OVERWORLD_ENEMY_WANDER_MIN: 4500,
  OVERWORLD_ENEMY_WANDER_MAX: 11500,
  OVERWORLD_ENEMY_WANDER_MAX_IDLE: 20000,
  OVERWORLD_HEALTH_REGEN_INTERVAL: 2000,
};

const BUILD_ENV = import.meta.env || {};

export const DEBUG_CONFIG = {
  SHOW_STATS: BUILD_ENV.VITE_ONE_RPG_DEBUG === 'true',
};
