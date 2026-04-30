import { WORLD_ASSETS } from './assets.js';

export const WORLD_OBJECT_TYPES = {
  'grass-block': {
    id: 'grass-block',
    name: 'Grama',
    shape: 'sprite',
    blocksMovement: true,
    alignment: 'bottom',
    size: { width: 1.6, height: 1.8 },
    texture: WORLD_ASSETS.objects.grassDecorative,
    color: '#ffffff',
  },
  stone: {
    id: 'stone',
    name: 'Rocha',
    shape: 'box',
    blocksMovement: true,
    size: { width: 0.82, height: 0.46, depth: 0.82 },
    color: '#737373',
  },
  stump: {
    id: 'stump',
    name: 'Toco',
    shape: 'cylinder',
    blocksMovement: true,
    radius: 0.36,
    height: 0.48,
    color: '#8b5a2b',
  },
  well: {
    id: 'well',
    name: 'Poco',
    shape: 'cylinder',
    blocksMovement: true,
    radius: 0.42,
    height: 0.32,
    color: '#64748b',
  },
  'test-model': {
    id: 'test-model',
    name: 'Objeto 3D Teste',
    shape: 'model',
    modelUrl: './assets/models/test/unnamed.gltf',
    blocksMovement: true,
    scale: 0.8,
  },
};
