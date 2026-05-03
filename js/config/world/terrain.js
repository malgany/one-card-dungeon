import { WORLD_ASSETS } from './assets.js';

export const TERRAIN_TYPES = {
  grass: {
    id: 'grass',
    name: 'Grama',
    texture: WORLD_ASSETS.terrain.grass,
    color: '#3f7d46',
  },
  stone: {
    id: 'stone',
    name: 'Pedra',
    texture: WORLD_ASSETS.terrain.stone,
    color: '#6b7280',
  },
  chao3: {
    id: 'chao3',
    name: 'Chao 3',
    texture: WORLD_ASSETS.terrain.chao3,
    color: '#6f7f62',
  },
  dirt: {
    id: 'dirt',
    name: 'Terra',
    texture: null,
    color: '#7c5a38',
  },
};
