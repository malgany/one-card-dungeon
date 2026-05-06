import * as THREE from 'three';
import { BOARD_SIZE, CARD_SOURCES, DEBUG_CONFIG, GAME_MODES, TERRAIN_TYPES, WORLD_ASSETS, WORLD_OBJECT_TYPES } from '../config/game-data.js';
import { getCurrentWorldEnemies, getCurrentWorldMap } from '../game/world-state.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { paletteSignature } from '../config/character-palettes.js';
import {
  DEFAULT_MAP_COLOR_VALUES,
  getMapColorValuesForMap,
  normalizeMapColorValues,
} from '../config/map-colors.js';
import { configureCharacterTexture, loadCharacterPaletteTexture } from './character-palette-texture.js';

const CARD_WIDTH = 0.56;
const CARD_HEIGHT = 0.82;
const CARD_ROTATION_Y = Math.PI / 4;
const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.atan(1 / Math.sqrt(2));
const ISO_CAMERA_DISTANCE = 12;
const PERSPECTIVE_CAMERA_FOV = 42;
const ORTHO_VIEW_HEIGHT = 7.48;
const COMPACT_ORTHO_VIEW_HEIGHT = 8.16;
const COMBAT_ORTHO_VIEW_HEIGHT = 8.26;
const COMPACT_COMBAT_ORTHO_VIEW_HEIGHT = 8.98;
const OVERWORLD_ORTHO_VIEW_HEIGHT = 9.18;
const COMPACT_OVERWORLD_ORTHO_VIEW_HEIGHT = 8.16;
const FLOOR_COLORS = ['#353124', '#252217'];
const COMBAT_BACKDROP_COLOR = '#070807';
const SPECULAR_GLOSSINESS_EXTENSION = 'KHR_materials_pbrSpecularGlossiness';
const DEBUG_MODEL_DEFAULT_SCALE = 0.5;
const TERRAIN_CUBE_HEIGHT = 0.62;
const MAX_DEBUG_CUBES = 2000;
const ISLAND_WATER_LEVEL = -TERRAIN_CUBE_HEIGHT / 2;
const ISLAND_WATER_PADDING = 18;
const ISLAND_DRY_GROUND_PADDING = Math.ceil(ISLAND_WATER_PADDING / 2);
const ISLAND_DRY_GROUND_TINT = '#a5a5a5';
const ISLAND_WATER_BOB_AMOUNT = 0.04;
const ISLAND_WATER_BOB_SPEED = 1.18;
const ISLAND_WATER_LIGHT_BAND = 0.12;
const ISLAND_WATER_DARK_BAND = 0.48;
const CONNECTION_BRIDGE_LENGTH = 2.35;
const CONNECTION_BRIDGE_WIDTH = 0.78;
const CONNECTION_BRIDGE_DECK_HEIGHT = 0.12;
const CONNECTION_BRIDGE_RAIL_HEIGHT = 0.18;
const CONNECTION_BRIDGE_RAIL_WIDTH = 0.08;
const CONNECTION_BRIDGE_POST_ABOVE_DECK_HEIGHT = 0.36;
const CONNECTION_BRIDGE_POST_HEIGHT = TERRAIN_CUBE_HEIGHT + CONNECTION_BRIDGE_POST_ABOVE_DECK_HEIGHT;
const CONNECTION_BRIDGE_POST_SIZE = 0.1;
const CONNECTION_BRIDGE_PLANK_COUNT = 5;
const CONNECTION_BRIDGE_BOARD_EDGE_OFFSET = 0.5;
const CONNECTION_BRIDGE_WATER_SHADOW_WIDTH = CONNECTION_BRIDGE_WIDTH + 0.38;
const CONNECTION_BRIDGE_WATER_SHADOW_LENGTH = CONNECTION_BRIDGE_LENGTH + 0.18;
const CONNECTION_BRIDGE_POST_WATER_OUTLINE_GAP = 0.02;
const CONNECTION_BRIDGE_POST_WATER_OUTLINE_THICKNESS = 0.055;
const CONNECTION_BRIDGE_POST_WATER_OUTLINE_LENGTH = CONNECTION_BRIDGE_POST_SIZE
  + CONNECTION_BRIDGE_POST_WATER_OUTLINE_GAP * 2
  + CONNECTION_BRIDGE_POST_WATER_OUTLINE_THICKNESS * 2;
const KEY_LIGHT_DEFAULT_DIRECTION_DEG = 84;
const KEY_LIGHT_RADIUS = Math.hypot(5, 5);
const KEY_LIGHT_HEIGHT = 10;
const HIGHLIGHT_ORDER = [
  'hover',
  'playerAttack',
  'monsterAttack',
  'move',
  'monsterMove',
];
const HIGHLIGHT_COLORS = {
  hover: { color: '#f2ead7', opacity: 0.2 },
  move: { color: '#5f8f54', opacity: 0.28 },
  playerAttack: { color: '#b94735', opacity: 0.3 },
  monsterMove: { color: '#5f8f54', opacity: 0.22 },
  monsterAttack: { color: '#b94735', opacity: 0.28 },
};
const ANIMATED_TEXTURE_EXTENSIONS = ['.gif'];
const CHARACTER_TEXTURE_OVERRIDES = {
  // Apenas aventureiros (player) usam textura externa por enquanto
  './assets/models/adventurers/characters/mage.glb': './assets/models/adventurers/textures/mage_texture.png',
  './assets/models/adventurers/characters/barbarian.glb': './assets/models/adventurers/textures/barbarian_texture.png',
  './assets/models/adventurers/characters/knight.glb': './assets/models/adventurers/textures/knight_texture.png',
  './assets/models/adventurers/characters/ranger.glb': './assets/models/adventurers/textures/ranger_texture.png',
  './assets/models/adventurers/characters/rogue.glb': './assets/models/adventurers/textures/rogue_texture.png',
  './assets/models/adventurers/characters/rogue-hooded.glb': './assets/models/adventurers/textures/rogue_texture.png',
};
const PLAYER_MODEL_BASE = {
  idleAnimation: 'Idle_A',
  walkAnimation: 'Running_B',
  attackAnimation: 'Throw',
  damageAnimation: 'Hit_B',
  walkTimeScale: 1.65,
  scale: 0.42,
  groundOffset: -0.01,
  initialRotationY: CARD_ROTATION_Y,
  animations: [
    WORLD_ASSETS.animations.rigMedium.general,
    WORLD_ASSETS.animations.rigMedium.movementBasic,
  ],
};
const PLAYER_MODELS = {
  mage: {
    ...PLAYER_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.mage,
  },
  barbarian: {
    ...PLAYER_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.barbarian,
  },
  knight: {
    ...PLAYER_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.knight,
  },
  ranger: {
    ...PLAYER_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.ranger,
    animations: [
      ...PLAYER_MODEL_BASE.animations,
      WORLD_ASSETS.animations.rigMedium.combatRanged,
    ],
  },
  rogue: {
    ...PLAYER_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.rogue,
  },
};
const DEFAULT_PLAYER_MODEL = PLAYER_MODELS.mage;
const SKELETON_MODEL_BASE = {
  idleAnimation: 'Idle_A',
  walkAnimation: 'Walking_A',
  attackAnimation: 'Hit_A',
  damageAnimation: 'Hit_B',
  walkTimeScale: 1.65,
  scale: 0.42,
  groundOffset: -0.01,
  initialRotationY: CARD_ROTATION_Y,
  animations: [
    WORLD_ASSETS.animations.skeletons.rigMedium.general,
    WORLD_ASSETS.animations.skeletons.rigMedium.movementBasic,
  ],
};
const UNIT_MODELS = {
  skeletonMinion: {
    ...SKELETON_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.skeletonMinion,
  },
  skeletonRogue: {
    ...SKELETON_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.skeletonRogue,
  },
  skeletonMage: {
    ...SKELETON_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.skeletonMage,
  },
  skeletonWarrior: {
    ...SKELETON_MODEL_BASE,
    modelUrl: WORLD_ASSETS.characters.skeletonWarrior,
  },
};
export const HERO_DEBUG_ANIMATION_OPTIONS = [
  { id: 'Idle_A', label: 'Idle_A', loop: true },
  { id: 'Idle_B', label: 'Idle_B', loop: true },
  { id: 'Walking_A', label: 'Walking_A', loop: true },
  { id: 'Walking_B', label: 'Walking_B', loop: true },
  { id: 'Walking_C', label: 'Walking_C', loop: true },
  { id: 'Running_A', label: 'Running_A', loop: true },
  { id: 'Running_B', label: 'Running_B', loop: true },
  { id: 'Jump_Idle', label: 'Jump_Idle', loop: true },
  { id: 'Jump_Start', label: 'Jump_Start', loop: false },
  { id: 'Jump_Land', label: 'Jump_Land', loop: false },
  { id: 'Jump_Full_Short', label: 'Jump_Full_Short', loop: false },
  { id: 'Jump_Full_Long', label: 'Jump_Full_Long', loop: false },
  { id: 'Hit_A', label: 'Hit_A', loop: false },
  { id: 'Hit_B', label: 'Hit_B', loop: false },
  { id: 'Interact', label: 'Interact', loop: false },
  { id: 'PickUp', label: 'PickUp', loop: false },
  { id: 'Throw', label: 'Throw', loop: false },
  { id: 'Use_Item', label: 'Use_Item', loop: false },
  { id: 'Spawn_Ground', label: 'Spawn_Ground', loop: false },
  { id: 'Spawn_Air', label: 'Spawn_Air', loop: false },
  { id: 'Death_A', label: 'Death_A', loop: false },
  { id: 'Death_A_Pose', label: 'Death_A_Pose', loop: false },
  { id: 'Death_B', label: 'Death_B', loop: false },
  { id: 'Death_B_Pose', label: 'Death_B_Pose', loop: false },
  { id: 'T-Pose', label: 'T-Pose', loop: true },
  { id: 'Ranged_Bow_Aiming_Idle', label: 'Ranged_Bow_Aiming_Idle', loop: true },
  { id: 'Ranged_Bow_Draw', label: 'Ranged_Bow_Draw', loop: false },
  { id: 'Ranged_Bow_Draw_Up', label: 'Ranged_Bow_Draw_Up', loop: false },
  { id: 'Ranged_Bow_Idle', label: 'Ranged_Bow_Idle', loop: true },
  { id: 'Ranged_Bow_Release', label: 'Ranged_Bow_Release', loop: false },
  { id: 'Ranged_Bow_Release_Up', label: 'Ranged_Bow_Release_Up', loop: false },
];
const HERO_DEBUG_ANIMATION_BY_ID = new Map(
  HERO_DEBUG_ANIMATION_OPTIONS.map((option) => [option.id, option]),
);

function colorFromHex(hex, fallback = '#6f6342') {
  return new THREE.Color(hex || fallback);
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function tileCenter(x, y, boardWidth = BOARD_SIZE, boardHeight = BOARD_SIZE) {
  return {
    x: x - boardWidth / 2 + 0.5,
    z: y - boardHeight / 2 + 0.5,
  };
}

function createConnectionRampGeometry() {
  const half = 0.505;
  const lowY = -TERRAIN_CUBE_HEIGHT;
  const vertices = {
    innerLeftTop: [-half, 0, -half],
    innerRightTop: [half, 0, -half],
    outerRightLow: [half, lowY, half],
    outerLeftLow: [-half, lowY, half],
    innerLeftBottom: [-half, lowY, -half],
    innerRightBottom: [half, lowY, -half],
  };
  const positions = [];
  const uvs = [];
  const geometry = new THREE.BufferGeometry();

  function pushTriangle(a, b, c, uvA, uvB, uvC) {
    positions.push(...a, ...b, ...c);
    uvs.push(...uvA, ...uvB, ...uvC);
  }

  function addGroup(materialIndex, addTriangles) {
    const start = positions.length / 3;
    addTriangles();
    geometry.addGroup(start, positions.length / 3 - start, materialIndex);
  }

  addGroup(2, () => {
    pushTriangle(vertices.innerLeftTop, vertices.outerLeftLow, vertices.innerRightTop, [0, 0], [0, 1], [1, 0]);
    pushTriangle(vertices.outerLeftLow, vertices.outerRightLow, vertices.innerRightTop, [0, 1], [1, 1], [1, 0]);
  });
  addGroup(3, () => {
    pushTriangle(vertices.innerLeftBottom, vertices.innerRightBottom, vertices.outerRightLow, [0, 0], [1, 0], [1, 1]);
    pushTriangle(vertices.innerLeftBottom, vertices.outerRightLow, vertices.outerLeftLow, [0, 0], [1, 1], [0, 1]);
  });
  addGroup(0, () => {
    pushTriangle(vertices.innerLeftTop, vertices.innerRightTop, vertices.innerRightBottom, [0, 0], [1, 0], [1, 1]);
    pushTriangle(vertices.innerLeftTop, vertices.innerRightBottom, vertices.innerLeftBottom, [0, 0], [1, 1], [0, 1]);
    pushTriangle(vertices.innerLeftTop, vertices.innerLeftBottom, vertices.outerLeftLow, [0, 0], [0, 1], [1, 1]);
    pushTriangle(vertices.innerRightTop, vertices.outerRightLow, vertices.innerRightBottom, [0, 0], [1, 1], [0, 1]);
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function setIsometricCameraPosition(camera, target = { x: 0, z: 0 }, distance = ISO_CAMERA_DISTANCE) {
  const horizontalDistance = distance * Math.cos(ISO_ELEVATION);

  camera.position.set(
    target.x + horizontalDistance * Math.sin(ISO_AZIMUTH),
    distance * Math.sin(ISO_ELEVATION),
    target.z + horizontalDistance * Math.cos(ISO_AZIMUTH),
  );
  camera.lookAt(target.x, 0, target.z);
}

function boardViewport(layout) {
  return {
    x: 0,
    y: 0,
    w: Math.max(1, layout.sw),
    h: Math.max(1, layout.sh),
  };
}

function imageSourceForUnit(unit, isPlayer) {
  if (!isPlayer) return CARD_SOURCES[unit.type] || null;
  return unit?.characterPortrait || CARD_SOURCES.player || null;
}

function playerModelKey(unit) {
  return unit?.characterType || 'mage';
}

function unitTypeKey(unit, isPlayer) {
  if (!isPlayer) return unit?.type || 'unit';

  const typeId = playerModelKey(unit);
  return `player:${typeId}:${paletteSignature(typeId, unit?.characterPalette)}`;
}

function modelConfigForUnit(unit, isPlayer) {
  if (isPlayer) return PLAYER_MODELS[playerModelKey(unit)] || DEFAULT_PLAYER_MODEL;
  return UNIT_MODELS[unit?.type] || null;
}

function movementAnimationFor(entityId, animations) {
  return animations.find((animation) => {
    return animation.type === 'movement' && animation.entityId === entityId;
  });
}

function movementEndTime(movement) {
  if (!movement) return 0;
  if (Number.isFinite(movement.totalDuration)) {
    return movement.startTime + Math.max(0, movement.totalDuration);
  }

  const pathSteps = Math.max(0, (movement.path?.length || 1) - 1);
  const durationPerTile = Number.isFinite(movement.durationPerTile) ? movement.durationPerTile : 0;
  return movement.startTime + pathSteps * durationPerTile;
}

function isMovementActive(movement, now) {
  return !!movement && now >= movement.startTime && now < movementEndTime(movement);
}

function modelActionFor(entityId, animations, now) {
  return animations.find((animation) => {
    if (animation.type !== 'modelAction' || animation.entityId !== entityId) return false;
    const startTime = Number.isFinite(animation.startTime) ? animation.startTime : 0;
    const duration = Math.max(0, animation.duration || 0);
    return now >= startTime && now < startTime + duration;
  });
}

function hasPendingModelAction(entityId, animations, now, animationName) {
  return animations.some((animation) => {
    if (animation.type !== 'modelAction' || animation.entityId !== entityId) return false;
    if (animationName && animation.animation !== animationName) return false;
    const startTime = Number.isFinite(animation.startTime) ? animation.startTime : 0;
    const duration = Math.max(0, animation.duration || 0);
    return now < startTime + duration;
  });
}

function movementDirection(movement, now) {
  if (!movement?.path || movement.path.length < 2) return null;

  const elapsed = now - movement.startTime;
  if (elapsed < 0) return null;

  if (Number.isFinite(movement.totalDuration)) {
    const progress = Math.min(1, elapsed / Math.max(1, movement.totalDuration));
    const targetDist = progress * movement.totalDistance;
    let currentDist = 0;

    for (let i = 0; i < movement.path.length - 1; i += 1) {
      const from = movement.path[i];
      const to = movement.path[i + 1];
      const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));

      if (currentDist + distance >= targetDist || i === movement.path.length - 2) {
        return { x: to.x - from.x, y: to.y - from.y };
      }

      currentDist += distance;
    }
  }

  const tileDuration = movement.durationPerTile || 1;
  const tileIndex = Math.min(
    movement.path.length - 2,
    Math.max(0, Math.floor(elapsed / tileDuration)),
  );
  const from = movement.path[tileIndex];
  const to = movement.path[tileIndex + 1];

  return { x: to.x - from.x, y: to.y - from.y };
}

function faceDirection(group, direction) {
  if (!direction || (direction.x === 0 && direction.y === 0)) return;
  group.rotation.y = Math.atan2(direction.x, direction.y);
}

function movementPosition(unit, entityId, animations, now) {
  let drawX = unit.x;
  let drawY = unit.y;

  const movement = movementAnimationFor(entityId, animations);

  if (movement) {
    const elapsed = now - movement.startTime;
    if (elapsed >= 0) {
      if (movement.totalDuration !== undefined) {
        const progress = Math.min(1, elapsed / Math.max(1, movement.totalDuration));
        const targetDist = progress * movement.totalDistance;
        let currentDist = 0;

        for (let i = 0; i < movement.path.length - 1; i += 1) {
          const p1 = movement.path[i];
          const p2 = movement.path[i + 1];
          const d = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          
          if (currentDist + d >= targetDist || i === movement.path.length - 2) {
            const segmentProgress = d > 0 ? (targetDist - currentDist) / d : 1;
            const clampedProgress = Math.max(0, Math.min(1, segmentProgress));
            drawX = p1.x + (p2.x - p1.x) * clampedProgress;
            drawY = p1.y + (p2.y - p1.y) * clampedProgress;
            return { drawX, drawY };
          }
          currentDist += d;
        }
        // Fallback for safety if loop somehow finishes
        const last = movement.path[movement.path.length - 1];
        return { drawX: last.x, drawY: last.y };
      }

      const tileDuration = movement.durationPerTile || 1;
      const tileIndex = Math.floor(elapsed / tileDuration);
      const tileProgress = (elapsed % tileDuration) / tileDuration;

      if (tileIndex < movement.path.length - 1) {
        const from = movement.path[tileIndex];
        const to = movement.path[tileIndex + 1];
        drawX = from.x + (to.x - from.x) * tileProgress;
        drawY = from.y + (to.y - from.y) * tileProgress;
      } else {
        const last = movement.path[movement.path.length - 1];
        drawX = last.x;
        drawY = last.y;
      }
    }
  }

  return { drawX, drawY };
}

function bumpOffset(unit, entityId, animations, now) {
  const bump = animations.find((animation) => {
    return animation.type === 'bumpAttack' && animation.entityId === entityId;
  });

  if (!bump) return { x: 0, z: 0 };

  const progress = (now - bump.startTime) / bump.duration;
  if (progress < 0 || progress > 1) return { x: 0, z: 0 };

  const dx = bump.targetX - unit.x;
  const dz = bump.targetY - unit.y;
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  let amount = 0;

  if (progress < 0.25) amount = -0.22 * (progress / 0.25);
  else if (progress < 0.5) amount = -0.22 + 0.7 * ((progress - 0.25) / 0.25);
  else amount = 0.48 * (1 - ((progress - 0.5) / 0.5));

  return {
    x: (dx / len) * amount,
    z: (dz / len) * amount,
  };
}

function isFlashing(entityId, animations, now) {
  const shake = animations.find((animation) => {
    return animation.type === 'damageShake' && animation.entityId === entityId;
  });

  if (!shake) return false;

  const progress = (now - shake.startTime) / shake.duration;
  if (progress < 0 || progress > 1) return false;
  return Math.floor(progress * 10) % 2 === 0;
}

export function createThreeBoardView({ state }) {
  const currentBoard = {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    terrainId: null,
    showGrid: null,
  };
  const scene = new THREE.Scene();
  scene.background = colorFromHex('#070807');
  if (state.visuals?.fogDensity > 0) {
    scene.fog = new THREE.FogExp2('#070807', state.visuals.fogDensity);
  }

  const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  const perspectiveCamera = new THREE.PerspectiveCamera(PERSPECTIVE_CAMERA_FOV, 1, 0.1, 80);
  let activeCamera = orthographicCamera;
  setIsometricCameraPosition(orthographicCamera);
  setIsometricCameraPosition(perspectiveCamera);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(colorFromHex('#070807'), 1);
  
  // Visual settings from state
  const visuals = state.visuals || {
    exposure: 1.0,
    ambientIntensity: 1.0,
    keyIntensity: 1.5,
    keyLightDirectionDeg: KEY_LIGHT_DEFAULT_DIRECTION_DEG,
    fogDensity: 0.015,
    shadowMapEnabled: true,
  };

  renderer.shadowMap.enabled = visuals.shadowMapEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = visuals.exposure;
  renderer.domElement.className = 'board-webgl';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.tabIndex = -1;
  document.body.prepend(renderer.domElement);

  const boardGroup = new THREE.Group();
  scene.add(boardGroup);

  const textureLoader = new THREE.TextureLoader();
  const gltfLoader = new GLTFLoader();
  const animationTimer = new THREE.Clock();
  const mixers = new Map();
  const textureCache = new Map();
  const gltfCache = new Map();

  function loadGltfAsset(url) {
    if (!gltfCache.has(url)) {
      gltfCache.set(url, new Promise((resolve, reject) => {
        gltfLoader.load(url, resolve, undefined, reject);
      }));
    }

    return gltfCache.get(url);
  }

  function textureFor(src) {
    if (!src) return null;
    if (textureCache.has(src)) return textureCache.get(src);

    const texture = isAnimatedTextureSource(src)
      ? animatedTextureFor(src)
      : textureLoader.load(src);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    textureCache.set(src, texture);
    return texture;
  }

  function animatedTextureFor(src) {
    const texture = textureLoader.load(src);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 1;
    canvas.height = 1;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.userData.animated = {
      canvas,
      context,
      currentFrameIndex: -1,
      frames: [],
      startedAt: performance.now(),
      totalDurationMs: 0,
    };

    loadAnimatedTextureFrames(src, texture).catch((error) => {
      console.error('Erro ao decodificar textura animada:', src, error);
    });

    return texture;
  }

  async function loadAnimatedTextureFrames(src, texture) {
    if (typeof ImageDecoder === 'undefined') {
      return;
    }

    const supported = await ImageDecoder.isTypeSupported('image/gif').catch(() => false);
    if (!supported) {
      return;
    }

    const response = await fetch(src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const decoder = new ImageDecoder({
      data: await response.arrayBuffer(),
      type: 'image/gif',
    });
    await decoder.tracks.ready;

    const frameCount = decoder.tracks.selectedTrack?.frameCount || 0;
    const frames = [];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const decoded = await decoder.decode({ frameIndex });
      const frame = decoded.image;
      const width = frame.displayWidth || frame.codedWidth || 1;
      const height = frame.displayHeight || frame.codedHeight || 1;
      const frameCanvas = document.createElement('canvas');
      const frameContext = frameCanvas.getContext('2d');
      frameCanvas.width = width;
      frameCanvas.height = height;
      frameContext.drawImage(frame, 0, 0, width, height);
      frames.push({
        canvas: frameCanvas,
        durationMs: Math.max(16, (frame.duration || 100000) / 1000),
      });
      frame.close?.();
    }
    decoder.close?.();

    if (frames.length === 0) {
      return;
    }

    const animated = texture.userData.animated;
    animated.frames = frames;
    animated.startedAt = performance.now();
    animated.totalDurationMs = frames.reduce((total, frame) => total + frame.durationMs, 0);
    syncAnimatedTextureFrame(texture, animated.startedAt, true);
  }

  function isAnimatedTextureSource(src) {
    const cleanSrc = String(src || '').split(/[?#]/)[0].toLowerCase();
    return ANIMATED_TEXTURE_EXTENSIONS.some((extension) => cleanSrc.endsWith(extension));
  }

  function syncAnimatedTextureFrame(texture, now = performance.now(), force = false) {
    const animated = texture.userData?.animated;
    if (!animated?.context) return false;

    const { canvas, context } = animated;
    if (animated.frames?.length > 0 && animated.totalDurationMs > 0) {
      const elapsed = (now - animated.startedAt) % animated.totalDurationMs;
      let frameTime = 0;
      let frameIndex = 0;
      for (; frameIndex < animated.frames.length - 1; frameIndex += 1) {
        frameTime += animated.frames[frameIndex].durationMs;
        if (elapsed < frameTime) break;
      }
      if (!force && frameIndex === animated.currentFrameIndex) return true;

      const frame = animated.frames[frameIndex];
      if (canvas.width !== frame.canvas.width || canvas.height !== frame.canvas.height) {
        canvas.width = frame.canvas.width;
        canvas.height = frame.canvas.height;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(frame.canvas, 0, 0);
      if (texture.image !== canvas) texture.image = canvas;
      animated.currentFrameIndex = frameIndex;
      texture.needsUpdate = true;
      return true;
    }
    return false;
  }

  function updateAnimatedTextures() {
    textureCache.forEach((texture) => {
      syncAnimatedTextureFrame(texture);
    });
  }

  function normalizeHexColor(value, fallback = '#ffffff') {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : fallback;
  }

  function mapColorValues(mapId) {
    const mapState = state.game.overworld?.mapStates?.[mapId] || null;
    const draftValues = state.debugColors?.activeMapId === mapId ? state.debugColors?.values : null;
    return normalizeMapColorValues(draftValues || mapState?.debugColors?.values || getMapColorValuesForMap(mapId));
  }

  function debugColorValues() {
    const mapId = state.game.overworld?.currentMapId || null;
    return mapColorValues(mapId);
  }

  function combatColorValues() {
    const mapId = state.game.combatContext?.mapId || state.game.overworld?.currentMapId || null;
    if (mapId) return mapColorValues(mapId);

    return normalizeMapColorValues({
      ...DEFAULT_MAP_COLOR_VALUES,
      water1: COMBAT_BACKDROP_COLOR,
      water2: '#0d0f0b',
      water3: '#14150f',
    });
  }

  function hexToRgba(hex, alpha) {
    const value = normalizeHexColor(hex, '#ffffff').slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const PROCEDURAL_GRASS_PRESETS = {
    detailed: {
      base: '#6fb354',
      patches: [
        [10, 14, 26, 18, '#78bd5b', 0.5],
        [76, 8, 18, 18, '#8acb68', 0.42],
        [36, 42, 34, 24, '#5fa247', 0.22],
        [88, 58, 28, 22, '#7fc460', 0.38],
        [14, 88, 22, 18, '#86c764', 0.36],
        [58, 96, 36, 20, '#629f49', 0.2],
      ],
      speckles: 90,
      sprigs: 22,
    },
    soft: {
      base: '#5cad54',
      patches: [
        [18, 18, 28, 20, '#67b95e', 0.22],
        [78, 22, 30, 18, '#71bf65', 0.2],
        [22, 82, 32, 22, '#68ba60', 0.2],
        [82, 92, 26, 18, '#529f4d', 0.12],
      ],
      speckles: 30,
      sprigs: 12,
    },
  };

  function paintProceduralGrassTexture(texture, presetName = 'soft', colors = debugColorValues()) {
    const preset = PROCEDURAL_GRASS_PRESETS[presetName] || PROCEDURAL_GRASS_PRESETS.soft;
    const textureCanvas = texture.image;
    const textureCtx = textureCanvas.getContext('2d');
    textureCtx.imageSmoothingEnabled = false;

    textureCtx.clearRect(0, 0, 128, 128);
    textureCtx.fillStyle = colors.top1 || preset.base;
    textureCtx.fillRect(0, 0, 128, 128);

    const patchColors = [colors.top2, colors.top2, colors.top2, colors.top3, colors.top2, colors.top3];
    preset.patches.forEach(([x, y, w, h, color, alpha], index) => {
      textureCtx.globalAlpha = alpha;
      textureCtx.fillStyle = patchColors[index] || color;
      textureCtx.fillRect(x, y, w, h);
    });

    textureCtx.globalAlpha = 1;
    for (let index = 0; index < preset.speckles; index += 1) {
      const x = (index * 37 + 17) % 124;
      const y = (index * 53 + 11) % 124;
      const light = index % 3 !== 0;
      textureCtx.fillStyle = light ? hexToRgba(colors.top4, 0.28) : hexToRgba(colors.top5, 0.16);
      textureCtx.fillRect(x, y, 2, 2);
      if (index % 5 === 0) textureCtx.fillRect(x + 3, y + 1, 2, 2);
    }

    for (let index = 0; index < preset.sprigs; index += 1) {
      const x = (index * 29 + 7) % 122;
      const y = (index * 43 + 19) % 122;
      textureCtx.fillStyle = hexToRgba(colors.top4, 0.28);
      textureCtx.fillRect(x + 2, y, 2, 6);
      textureCtx.fillRect(x, y + 2, 6, 2);
    }

    textureCtx.globalAlpha = 1;
    texture.needsUpdate = true;
  }

  function createProceduralGrassTexture(presetName = 'soft', colors = debugColorValues()) {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 128;
    textureCanvas.height = 128;
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = 8;
    paintProceduralGrassTexture(texture, presetName, colors);
    return texture;
  }

  function paintProceduralDirtSideTexture(texture, colors = debugColorValues()) {
    const textureCanvas = texture.image;
    const textureCtx = textureCanvas.getContext('2d');
    textureCtx.imageSmoothingEnabled = false;

    textureCtx.clearRect(0, 0, 128, 128);
    textureCtx.fillStyle = colors.side1;
    textureCtx.fillRect(0, 0, 128, 128);

    const blocks = [
      [8, 14, 18, 10, colors.side2],
      [36, 28, 12, 8, colors.side3],
      [72, 16, 22, 12, colors.side4],
      [102, 36, 12, 18, colors.side3],
      [18, 58, 28, 12, colors.side2],
      [62, 66, 16, 10, colors.side5],
      [90, 82, 26, 14, colors.side2],
      [28, 98, 14, 12, colors.side3],
      [54, 108, 30, 10, colors.side4],
    ];

    blocks.forEach(([x, y, w, h, color]) => {
      textureCtx.fillStyle = color;
      textureCtx.fillRect(x, y, w, h);
    });

    textureCtx.fillStyle = hexToRgba(colors.side5, 0.18);
    for (let index = 0; index < 28; index += 1) {
      const x = (index * 41 + 9) % 124;
      const y = (index * 23 + 17) % 124;
      textureCtx.fillRect(x, y, 4, 3);
    }

    texture.needsUpdate = true;
  }

  function createProceduralDirtSideTexture(colors = debugColorValues()) {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 128;
    textureCanvas.height = 128;
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = 8;
    paintProceduralDirtSideTexture(texture, colors);
    return texture;
  }

  const materialCache = new Map();
  const geometryCache = new Map();

  function standardMaterial({ color = '#6f6342', texture = null, roughness = 0.86, metalness = 0.04 } = {}) {
    const textureMap = textureFor(texture);

    return new THREE.MeshStandardMaterial({
      color: textureMap ? colorFromHex('#ffffff') : colorFromHex(color),
      map: textureMap,
      roughness,
      metalness,
    });
  }

  function applyLegacyDiffuseTexture(gltf, material) {
    if (!gltf.parser?.associations || material.map) return;

    const materialRef = gltf.parser.associations.get(material);
    const materialIndex = materialRef?.materials;
    const materialDef = Number.isInteger(materialIndex)
      ? gltf.parser.json.materials?.[materialIndex]
      : null;
    const specGloss = materialDef?.extensions?.[SPECULAR_GLOSSINESS_EXTENSION];
    if (!specGloss) return;

    const diffuseTexture = specGloss?.diffuseTexture;

    if (Array.isArray(specGloss?.diffuseFactor) && material.color) {
      material.color.setRGB(
        specGloss.diffuseFactor[0],
        specGloss.diffuseFactor[1],
        specGloss.diffuseFactor[2],
        THREE.LinearSRGBColorSpace,
      );
      material.opacity = specGloss.diffuseFactor[3] ?? material.opacity;
      material.transparent = material.transparent || material.opacity < 1;
    }

    if (diffuseTexture?.index === undefined) {
      material.needsUpdate = true;
      return;
    }

    gltf.parser.getDependency('texture', diffuseTexture.index).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;

      if ('metalness' in material) material.metalness = 0;
      if ('roughness' in material) material.roughness = 0.88;

      material.needsUpdate = true;
    }).catch((error) => {
      console.error('Erro ao aplicar textura difusa do modelo:', error);
    });
  }

  function centerModelOnGround(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());

    model.position.x = -center.x;
    model.position.y = -box.min.y;
    model.position.z = -center.z;
  }

  async function overrideTextureFor(url, typeId = null, palette = null) {
    let overrideTexture = null;
    if (url) {
      const overridePath = CHARACTER_TEXTURE_OVERRIDES[url] || CHARACTER_TEXTURE_OVERRIDES[url.replace(/^\.\//, '')];
      if (overridePath) {
        overrideTexture = typeId
          ? await loadCharacterPaletteTexture({ typeId, textureUrl: overridePath, palette })
          : null;
        if (!overrideTexture) overrideTexture = textureFor(overridePath);
        configureCharacterTexture(overrideTexture);
      }
    }

    return overrideTexture;
  }

  async function prepareGltfModel(gltf, model, { url = null, typeId = null, palette = null } = {}) {
    const overrideTexture = await overrideTextureFor(url, typeId, palette);

    model.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;

      if (node.geometry?.attributes && !node.geometry.attributes.normal) {
        node.geometry.computeVertexNormals();
      }

      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!material) continue;

        if (overrideTexture) {
          material.map = overrideTexture;
          if ('metalness' in material) material.metalness = 0;
          if ('roughness' in material) material.roughness = 0.88;
        } else {
          applyLegacyDiffuseTexture(gltf, material);
        }

        material.side = THREE.DoubleSide;
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
        }
        material.needsUpdate = true;
      }
    });
  }

  function objectMaterialFor(type) {
    const cacheKey = `object:${type.id}`;
    if (materialCache.has(cacheKey)) return materialCache.get(cacheKey);

    if (type.shape === 'box' && type.materials?.top && type.materials?.side) {
      const side = standardMaterial({ color: type.color, texture: type.materials.side, roughness: 0.85 });
      const top = standardMaterial({ color: type.color, texture: type.materials.top, roughness: 0.85 });
      const materials = [side, side, top, side, side, side];
      materialCache.set(cacheKey, materials);
      return materials;
    }

    if (type.shape === 'sprite') {
      const textureMap = textureFor(type.texture);
      const material = new THREE.MeshBasicMaterial({
        map: textureMap,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });
      materialCache.set(cacheKey, material);
      return material;
    }

    const material = standardMaterial({ color: type.color, texture: type.texture, roughness: 0.82 });
    materialCache.set(cacheKey, material);
    return material;
  }

  function objectGeometryFor(type) {
    const cacheKey = `object:${type.id}:${type.shape}`;
    if (geometryCache.has(cacheKey)) return geometryCache.get(cacheKey);

    let geometry;
    if (type.shape === 'cylinder') {
      geometry = new THREE.CylinderGeometry(type.radius || 0.35, type.radius || 0.35, type.height || 0.45, 32);
    } else if (type.shape === 'sprite') {
      geometry = new THREE.PlaneGeometry(type.size?.width || 0.82, type.size?.height || 0.82);
    } else {
      geometry = new THREE.BoxGeometry(type.size?.width || 0.82, type.size?.height || 0.48, type.size?.depth || 0.82);
    }

    geometryCache.set(cacheKey, geometry);
    return geometry;
  }

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#171912'),
    roughness: 0.82,
    metalness: 0.08,
  });

  const wallSideTexture = textureFor('./assets/textures/grama-lado.webp');
  const wallTopTexture = textureFor('./assets/textures/grama-topo.webp');

  const overworldSideMaterial = new THREE.MeshStandardMaterial({ map: wallSideTexture, roughness: 0.85 });
  const overworldTopMaterial = new THREE.MeshStandardMaterial({ map: wallTopTexture, roughness: 0.85 });
  const proceduralDirtSideTexture = createProceduralDirtSideTexture();
  const terrainCubeSideMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#ffffff'),
    emissive: colorFromHex('#2b1a0d'),
    emissiveIntensity: 0.06,
    map: proceduralDirtSideTexture,
    roughness: 0.88,
    metalness: 0.02,
  });
  const terrainCubeBottomMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#5b3a22'),
    emissive: colorFromHex('#160c06'),
    roughness: 0.95,
    metalness: 0.01,
  });

  const overworldWallMaterials = [
    overworldSideMaterial, // +x
    overworldSideMaterial, // -x
    overworldTopMaterial,  // +y
    overworldSideMaterial, // -y
    overworldSideMaterial, // +z
    overworldSideMaterial, // -z
  ];

  const combatWallMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#6f6342'),
    roughness: 0.78,
    metalness: 0.06,
  });

  const groundMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0.05,
  });
  const proceduralGrassTextures = {
    detailed: createProceduralGrassTexture('detailed'),
    soft: createProceduralGrassTexture('soft'),
  };
  const activeProceduralGrassTexture = proceduralGrassTextures.soft;
  let debugColorSignature = '';
  const waterMaterial = new THREE.MeshBasicMaterial({
    color: colorFromHex('#28c3e6'),
    side: THREE.DoubleSide,
  });
  const waterLightBandMaterial = new THREE.MeshBasicMaterial({
    color: colorFromHex('#7fdce8'),
    side: THREE.DoubleSide,
  });

  function syncDebugColorMaterials() {
    const isOverworld = state.game.mode === GAME_MODES.OVERWORLD;
    const overworldWaterEnabled = state.visuals?.overworldWater !== false;
    const colors = isOverworld ? debugColorValues() : combatColorValues();
    const backgroundColor = isOverworld && !overworldWaterEnabled ? colors.top1 : colors.water1;
    const mapId = isOverworld ? state.game.overworld?.currentMapId : state.game.combatContext?.mapId;
    const signature = `${isOverworld ? 'overworld' : 'combat'}:${mapId || 'default'}:${overworldWaterEnabled ? 'water' : 'dry'}:${JSON.stringify(colors)}`;
    if (signature === debugColorSignature) return;

    debugColorSignature = signature;
    scene.background = colorFromHex(backgroundColor);
    renderer.setClearColor(colorFromHex(backgroundColor), 1);
    if (scene.fog) scene.fog.color.set(backgroundColor);
    waterMaterial.color.set(colors.water1);
    waterDarkBandMaterial.color.set(colors.water2);
    waterLightBandMaterial.color.set(colors.water3);
    paintProceduralGrassTexture(activeProceduralGrassTexture, 'soft', colors);
    paintProceduralDirtSideTexture(proceduralDirtSideTexture, colors);
    groundMaterial.userData.colorSignature = signature;
    groundMaterial.needsUpdate = true;
    terrainCubeSideMaterial.needsUpdate = true;
  }
  const waterDarkBandMaterial = new THREE.MeshBasicMaterial({
    color: colorFromHex('#128eaa'),
    side: THREE.DoubleSide,
  });

  const wallMeshes = new Map();
  const objectMeshes = new Map();
  const unitMeshes = new Map();
  const debugEditorMeshes = new Map();
  const wallGeometry = new THREE.BoxGeometry(0.9, 0.54, 0.9);
  const debugTextureGeometry = new THREE.PlaneGeometry(1, 1);
  const terrainCubeGeometry = new THREE.BoxGeometry(1.01, TERRAIN_CUBE_HEIGHT, 1.01);
  const terrainCubeMaterials = [
    terrainCubeSideMaterial,
    terrainCubeSideMaterial,
    groundMaterial,
    terrainCubeBottomMaterial,
    terrainCubeSideMaterial,
    terrainCubeSideMaterial,
  ];
  const connectionBridgeDeckMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#8b4f2f'),
    roughness: 0.84,
    metalness: 0.02,
    flatShading: true,
  });
  const connectionBridgeDetailMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#4a2c1e'),
    roughness: 0.9,
    metalness: 0.01,
    flatShading: true,
  });
  
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.18, 1), baseMaterial);
  base.position.y = -0.13;
  base.scale.set(BOARD_SIZE + 0.55, 1, BOARD_SIZE + 0.55);
  base.receiveShadow = true;
  base.frustumCulled = true;
  boardGroup.add(base);

  const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMaterial);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = 0.01; // Slightly above base
  groundPlane.receiveShadow = true;
  boardGroup.add(groundPlane);

  const waterPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 32, 32), waterMaterial);
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.y = ISLAND_WATER_LEVEL;
  waterPlane.receiveShadow = false;
  waterPlane.frustumCulled = false;
  waterPlane.visible = false;
  waterPlane.userData.phase = 0;
  boardGroup.add(waterPlane);

  function createWaterStrip(material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.visible = false;
    boardGroup.add(mesh);
    return mesh;
  }

  const waterLightStrips = [
    createWaterStrip(waterLightBandMaterial),
    createWaterStrip(waterLightBandMaterial),
    createWaterStrip(waterLightBandMaterial),
    createWaterStrip(waterLightBandMaterial),
  ];
  const waterDarkStrips = [
    createWaterStrip(waterDarkBandMaterial),
    createWaterStrip(waterDarkBandMaterial),
    createWaterStrip(waterDarkBandMaterial),
    createWaterStrip(waterDarkBandMaterial),
  ];
  const connectionBridgeWaterAccentGroup = new THREE.Group();
  connectionBridgeWaterAccentGroup.visible = false;
  boardGroup.add(connectionBridgeWaterAccentGroup);

  const debugEditorGroup = new THREE.Group();
  boardGroup.add(debugEditorGroup);

  const debugSelectionMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 36),
    new THREE.MeshBasicMaterial({
      color: colorFromHex('#facc15'),
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  debugSelectionMarker.rotation.x = -Math.PI / 2;
  debugSelectionMarker.position.y = 0.075;
  debugSelectionMarker.renderOrder = 45;
  debugSelectionMarker.visible = false;
  boardGroup.add(debugSelectionMarker);

  const MAX_TILES = 5000;
  const tileGeometry = new THREE.BoxGeometry(1.01, 0.08, 1.01);
  const tileMaterial = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 });
  const tileInstance = new THREE.InstancedMesh(tileGeometry, tileMaterial, MAX_TILES);
  tileInstance.receiveShadow = true;
  tileInstance.frustumCulled = true;
  boardGroup.add(tileInstance);

  const terrainCubeInstance = new THREE.InstancedMesh(terrainCubeGeometry, terrainCubeMaterials, MAX_TILES);
  terrainCubeInstance.castShadow = true;
  terrainCubeInstance.receiveShadow = true;
  terrainCubeInstance.frustumCulled = true;
  boardGroup.add(terrainCubeInstance);

  const dryGroundCubeInstance = new THREE.InstancedMesh(terrainCubeGeometry, terrainCubeMaterials, MAX_TILES);
  dryGroundCubeInstance.castShadow = true;
  dryGroundCubeInstance.receiveShadow = true;
  dryGroundCubeInstance.frustumCulled = true;
  dryGroundCubeInstance.count = 0;
  boardGroup.add(dryGroundCubeInstance);

  const debugCubeInstance = new THREE.InstancedMesh(terrainCubeGeometry, terrainCubeMaterials, MAX_DEBUG_CUBES);
  debugCubeInstance.castShadow = true;
  debugCubeInstance.receiveShadow = true;
  debugCubeInstance.frustumCulled = true;
  debugCubeInstance.count = 0;
  boardGroup.add(debugCubeInstance);
  const debugCubeHitTargets = [];
  const debugCubeTopHeights = new Map();

  const connectionRampGeometry = createConnectionRampGeometry();
  const connectionRampInstance = new THREE.InstancedMesh(connectionRampGeometry, terrainCubeMaterials, MAX_TILES);
  connectionRampInstance.castShadow = true;
  connectionRampInstance.receiveShadow = true;
  connectionRampInstance.frustumCulled = true;
  connectionRampInstance.count = 0;
  boardGroup.add(connectionRampInstance);

  const connectionBridgeDeckInstance = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CONNECTION_BRIDGE_WIDTH, CONNECTION_BRIDGE_DECK_HEIGHT, CONNECTION_BRIDGE_LENGTH),
    connectionBridgeDeckMaterial,
    MAX_TILES,
  );
  connectionBridgeDeckInstance.castShadow = true;
  connectionBridgeDeckInstance.receiveShadow = true;
  connectionBridgeDeckInstance.frustumCulled = true;
  connectionBridgeDeckInstance.count = 0;
  boardGroup.add(connectionBridgeDeckInstance);
  const connectionBridgeDeckTargets = [];
  connectionBridgeDeckInstance.userData.connectionTargets = connectionBridgeDeckTargets;

  const connectionBridgeRailInstance = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CONNECTION_BRIDGE_RAIL_WIDTH, CONNECTION_BRIDGE_RAIL_HEIGHT, CONNECTION_BRIDGE_LENGTH * 0.86),
    connectionBridgeDetailMaterial,
    MAX_TILES * 2,
  );
  connectionBridgeRailInstance.castShadow = true;
  connectionBridgeRailInstance.receiveShadow = true;
  connectionBridgeRailInstance.frustumCulled = true;
  connectionBridgeRailInstance.count = 0;
  boardGroup.add(connectionBridgeRailInstance);
  const connectionBridgeRailTargets = [];
  connectionBridgeRailInstance.userData.connectionTargets = connectionBridgeRailTargets;

  const connectionBridgePostInstance = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CONNECTION_BRIDGE_POST_SIZE, CONNECTION_BRIDGE_POST_HEIGHT, CONNECTION_BRIDGE_POST_SIZE),
    connectionBridgeDetailMaterial,
    MAX_TILES * 4,
  );
  connectionBridgePostInstance.castShadow = true;
  connectionBridgePostInstance.receiveShadow = true;
  connectionBridgePostInstance.frustumCulled = true;
  connectionBridgePostInstance.count = 0;
  boardGroup.add(connectionBridgePostInstance);
  const connectionBridgePostTargets = [];
  connectionBridgePostInstance.userData.connectionTargets = connectionBridgePostTargets;

  const connectionBridgePlankInstance = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CONNECTION_BRIDGE_WIDTH * 0.9, 0.018, 0.035),
    connectionBridgeDetailMaterial,
    MAX_TILES * CONNECTION_BRIDGE_PLANK_COUNT,
  );
  connectionBridgePlankInstance.castShadow = true;
  connectionBridgePlankInstance.receiveShadow = true;
  connectionBridgePlankInstance.frustumCulled = true;
  connectionBridgePlankInstance.count = 0;
  boardGroup.add(connectionBridgePlankInstance);
  const connectionBridgePlankTargets = [];
  connectionBridgePlankInstance.userData.connectionTargets = connectionBridgePlankTargets;
  const connectionBridgeHitMeshes = [
    connectionBridgeDeckInstance,
    connectionBridgeRailInstance,
    connectionBridgePostInstance,
    connectionBridgePlankInstance,
  ];

  const connectionBridgeWaterShadowGeometry = new THREE.PlaneGeometry(1, 1);
  connectionBridgeWaterShadowGeometry.rotateX(-Math.PI / 2);
  const connectionBridgeWaterShadowInstance = new THREE.InstancedMesh(
    connectionBridgeWaterShadowGeometry,
    waterDarkBandMaterial,
    MAX_TILES,
  );
  connectionBridgeWaterShadowInstance.frustumCulled = true;
  connectionBridgeWaterShadowInstance.count = 0;
  connectionBridgeWaterAccentGroup.add(connectionBridgeWaterShadowInstance);

  const connectionBridgePostWaterOutlineGeometry = new THREE.PlaneGeometry(1, 1);
  connectionBridgePostWaterOutlineGeometry.rotateX(-Math.PI / 2);
  const connectionBridgePostWaterOutlineInstance = new THREE.InstancedMesh(
    connectionBridgePostWaterOutlineGeometry,
    waterLightBandMaterial,
    MAX_TILES * 16,
  );
  connectionBridgePostWaterOutlineInstance.frustumCulled = true;
  connectionBridgePostWaterOutlineInstance.count = 0;
  connectionBridgeWaterAccentGroup.add(connectionBridgePostWaterOutlineInstance);

  const debugCubeSelectionMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.44, 0.52, 36),
    new THREE.MeshBasicMaterial({
      color: colorFromHex('#facc15'),
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  debugCubeSelectionMarker.rotation.x = -Math.PI / 2;
  debugCubeSelectionMarker.renderOrder = 46;
  debugCubeSelectionMarker.visible = false;
  boardGroup.add(debugCubeSelectionMarker);

  const gridMaterial = new THREE.LineBasicMaterial({
    color: colorFromHex('#e0f2fe'),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), gridMaterial);
  gridLines.position.y = 0.085;
  gridLines.renderOrder = 42;
  boardGroup.add(gridLines);

  const highlightGeometry = new THREE.PlaneGeometry(0.86, 0.86);
  highlightGeometry.rotateX(-Math.PI / 2);

  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const highlightInstance = new THREE.InstancedMesh(highlightGeometry, highlightMaterial, MAX_TILES);
  highlightInstance.frustumCulled = true;
  boardGroup.add(highlightInstance);

  const dummy = new THREE.Object3D();
  const pathArrowGroup = new THREE.Group();
  scene.add(pathArrowGroup);
  const hemisphere = new THREE.HemisphereLight(colorFromHex('#dbeafe'), colorFromHex('#25170f'), state.visuals?.ambientIntensity ?? 1.0);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(colorFromHex('#fff7ed'), state.visuals?.keyIntensity ?? 1.5);
  keyLight.castShadow = state.visuals?.shadowMapEnabled ?? false;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.left = -15;
  keyLight.shadow.camera.right = 15;
  keyLight.shadow.camera.top = 15;
  keyLight.shadow.camera.bottom = -15;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  function applyKeyLightDirection() {
    const directionDeg = Number.isFinite(state.visuals?.keyLightDirectionDeg)
      ? state.visuals.keyLightDirectionDeg
      : KEY_LIGHT_DEFAULT_DIRECTION_DEG;
    const radians = THREE.MathUtils.degToRad(directionDeg);
    keyLight.position.set(
      Math.cos(radians) * KEY_LIGHT_RADIUS,
      KEY_LIGHT_HEIGHT,
      Math.sin(radians) * KEY_LIGHT_RADIUS,
    );
  }

  applyKeyLightDirection();

  const rimLight = new THREE.DirectionalLight(colorFromHex('#7dd3fc'), 0.7);
  rimLight.position.set(-4, 3.2, -3.5);
  scene.add(rimLight);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.04);
  const rayHit = new THREE.Vector3();

  function syncRendererSize(layout) {
    const width = Math.max(1, Math.floor(layout.sw));
    const height = Math.max(1, Math.floor(layout.sh));
    const drawingBuffer = renderer.getSize(new THREE.Vector2());

    if (drawingBuffer.x !== width || drawingBuffer.y !== height) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
    }
  }

  function currentOverworldTerrain() {
    const map = getCurrentWorldMap(state.game.overworld);
    return TERRAIN_TYPES[map?.defaultTerrain] || TERRAIN_TYPES.grass;
  }

  function tileFloorColor(terrain, x, y) {
    if (!terrain) return FLOOR_COLORS[(x + y) % FLOOR_COLORS.length];
    const colors = terrain?.tileColors || (terrain?.texture ? FLOOR_COLORS : [terrain?.color || FLOOR_COLORS[0]]);
    return colors[(x + y) % colors.length];
  }

  function syncGroundMaterial() {
    if (state.game.mode !== GAME_MODES.OVERWORLD) return false;

    const terrain = currentOverworldTerrain();
    if (
      groundMaterial.userData.terrainId === terrain.id &&
      groundMaterial.userData.syncedColorSignature === debugColorSignature
    ) {
      return !!groundMaterial.map;
    }

    const useProceduralGrass = terrain.id === 'grass' || terrain.id === 'debugGrass';
    const groundTexture = useProceduralGrass ? activeProceduralGrassTexture : textureFor(terrain.texture);
    if (groundTexture) {
      groundTexture.wrapS = THREE.RepeatWrapping;
      groundTexture.wrapT = THREE.RepeatWrapping;
      groundTexture.repeat.set(1, 1);
    }

    groundMaterial.map = groundTexture;
    groundMaterial.color.set(groundTexture ? '#ffffff' : terrain.color);
    groundMaterial.userData.terrainId = terrain.id;
    groundMaterial.userData.syncedColorSignature = debugColorSignature;
    groundMaterial.needsUpdate = true;
    return !!groundMaterial.map;
  }

  function syncGridLines(width, height) {
    const showGrid = !!state.visuals?.showGrid;
    gridLines.visible = showGrid;
    if (!showGrid) return;

    const points = [];
    const minX = -width / 2;
    const maxX = width / 2;
    const minZ = -height / 2;
    const maxZ = height / 2;

    for (let x = 0; x <= width; x += 1) {
      const lineX = minX + x;
      points.push(lineX, 0, minZ, lineX, 0, maxZ);
    }

    for (let y = 0; y <= height; y += 1) {
      const lineZ = minZ + y;
      points.push(minX, 0, lineZ, maxX, 0, lineZ);
    }

    gridLines.geometry.dispose();
    gridLines.geometry = new THREE.BufferGeometry();
    gridLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  }

  function syncCamera(layout, now) {
    const mode = state.game.mode || GAME_MODES.DUNGEON_LEGACY;
    const viewport = boardViewport(layout, mode);
    const aspect = viewport.w / viewport.h;
    const isOverworld = mode === GAME_MODES.OVERWORLD;
    const baseViewHeight = isOverworld
      ? (layout.compact ? COMPACT_OVERWORLD_ORTHO_VIEW_HEIGHT : OVERWORLD_ORTHO_VIEW_HEIGHT)
      : mode === GAME_MODES.COMBAT
        ? (layout.compact ? COMPACT_COMBAT_ORTHO_VIEW_HEIGHT : COMBAT_ORTHO_VIEW_HEIGHT)
        : (layout.compact ? COMPACT_ORTHO_VIEW_HEIGHT : ORTHO_VIEW_HEIGHT);
    const viewHeight = baseViewHeight / (state.debugZoom || 1.15);
    const viewWidth = viewHeight * aspect;

    let target = { x: 0, z: 0 };
    if (isOverworld) {
      const { drawX, drawY } = movementPosition(
        state.game.player,
        'player',
        state.game.animations || [],
        now || performance.now()
      );
      target = tileCenter(drawX, drawY, currentBoard.width, currentBoard.height);
    }

    const usePerspective = isOverworld && !state.visuals?.overworldOrthographicCamera;
    if (usePerspective) {
      activeCamera = perspectiveCamera;
      const fovRadians = THREE.MathUtils.degToRad(perspectiveCamera.fov);
      const distance = Math.max(7, (viewHeight / 2) / Math.tan(fovRadians / 2));
      perspectiveCamera.aspect = aspect;
      setIsometricCameraPosition(perspectiveCamera, target, distance);
      perspectiveCamera.updateProjectionMatrix();
    } else {
      activeCamera = orthographicCamera;
      orthographicCamera.left = -viewWidth / 2;
      orthographicCamera.right = viewWidth / 2;
      orthographicCamera.top = viewHeight / 2;
      orthographicCamera.bottom = -viewHeight / 2;
      setIsometricCameraPosition(orthographicCamera, target);
      orthographicCamera.updateProjectionMatrix();
    }
    return viewport;
  }

  function syncBoardGeometry(width = BOARD_SIZE, height = BOARD_SIZE, connections = []) {
    const isOverworld = state.game.mode === GAME_MODES.OVERWORLD;
    const hasGround = isOverworld && syncGroundMaterial();
    const useCubeTerrain = isOverworld;
    const waterEnabled = useCubeTerrain && state.visuals?.overworldWater !== false;
    const dryGroundEnabled = useCubeTerrain && !waterEnabled;
    const terrain = isOverworld ? currentOverworldTerrain() : null;
    const terrainId = terrain?.id || null;
    const showGrid = !!state.visuals?.showGrid;
    const connectionSignature = useCubeTerrain && !waterEnabled
      ? (connections || []).map((conn) => `${conn.id}:${conn.x},${conn.y}`).join('|')
      : '';
    const connectionTileKeys = useCubeTerrain && !waterEnabled
      ? new Set((connections || []).map((conn) => keyFor(conn.x, conn.y)))
      : new Set();

    if (
      currentBoard.width === width &&
      currentBoard.height === height &&
      currentBoard.hasGround === hasGround &&
      currentBoard.terrainId === terrainId &&
      currentBoard.showGrid === showGrid &&
      currentBoard.waterEnabled === waterEnabled &&
      currentBoard.connectionSignature === connectionSignature
    ) {
      return;
    }

    currentBoard.width = width;
    currentBoard.height = height;
    currentBoard.hasGround = hasGround;
    currentBoard.terrainId = terrainId;
    currentBoard.showGrid = showGrid;
    currentBoard.waterEnabled = waterEnabled;
    currentBoard.connectionSignature = connectionSignature;

    base.scale.set(width + 0.55, 1, height + 0.55);
    base.visible = !useCubeTerrain;
    syncGridLines(width, height);

    groundPlane.scale.set(width, height, 1);
    groundPlane.position.set(0, 0.01, 0);
    groundPlane.visible = hasGround && !useCubeTerrain;

    const waterWidth = width + ISLAND_WATER_PADDING;
    const waterHeight = height + ISLAND_WATER_PADDING;
    waterPlane.scale.set(waterWidth, waterHeight, 1);
    waterPlane.position.set(0, ISLAND_WATER_LEVEL, 0);
    waterPlane.visible = waterEnabled;

    const light = ISLAND_WATER_LIGHT_BAND;
    const dark = ISLAND_WATER_DARK_BAND;
    const lightTopBottomW = width + light * 2;
    const darkTopBottomW = width + (light + dark) * 2;
    const darkSideH = height + light * 2;
    const lightY = ISLAND_WATER_LEVEL + 0.008;
    const darkY = ISLAND_WATER_LEVEL + 0.006;

    waterLightStrips.forEach((strip) => { strip.visible = waterEnabled; });
    waterDarkStrips.forEach((strip) => { strip.visible = waterEnabled; });
    waterLightStrips[0].position.set(0, lightY, -height / 2 - light / 2);
    waterLightStrips[0].scale.set(lightTopBottomW, light, 1);
    waterLightStrips[1].position.set(0, lightY, height / 2 + light / 2);
    waterLightStrips[1].scale.set(lightTopBottomW, light, 1);
    waterLightStrips[2].position.set(-width / 2 - light / 2, lightY, 0);
    waterLightStrips[2].scale.set(light, height, 1);
    waterLightStrips[3].position.set(width / 2 + light / 2, lightY, 0);
    waterLightStrips[3].scale.set(light, height, 1);

    waterDarkStrips[0].position.set(0, darkY, -height / 2 - light - dark / 2);
    waterDarkStrips[0].scale.set(darkTopBottomW, dark, 1);
    waterDarkStrips[1].position.set(0, darkY, height / 2 + light + dark / 2);
    waterDarkStrips[1].scale.set(darkTopBottomW, dark, 1);
    waterDarkStrips[2].position.set(-width / 2 - light - dark / 2, darkY, 0);
    waterDarkStrips[2].scale.set(dark, darkSideH, 1);
    waterDarkStrips[3].position.set(width / 2 + light + dark / 2, darkY, 0);
    waterDarkStrips[3].scale.set(dark, darkSideH, 1);

    tileInstance.visible = !hasGround && !useCubeTerrain;
    terrainCubeInstance.visible = useCubeTerrain;
    dryGroundCubeInstance.visible = dryGroundEnabled;

    if (useCubeTerrain) {
      let count = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (count >= MAX_TILES) break;
          if (connectionTileKeys.has(keyFor(x, y))) continue;
          const center = tileCenter(x, y, width, height);

          dummy.position.set(center.x, -TERRAIN_CUBE_HEIGHT / 2, center.z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          terrainCubeInstance.setMatrixAt(count, dummy.matrix);
          terrainCubeInstance.setColorAt(count, colorFromHex('#ffffff'));

          count += 1;
        }
      }
      terrainCubeInstance.count = count;
      terrainCubeInstance.instanceMatrix.needsUpdate = true;
      terrainCubeInstance.instanceColor.needsUpdate = true;
    } else {
      terrainCubeInstance.count = 0;
    }

    if (dryGroundEnabled) {
      let count = 0;
      for (let y = -ISLAND_DRY_GROUND_PADDING; y < height + ISLAND_DRY_GROUND_PADDING; y += 1) {
        if (count >= MAX_TILES) break;
        for (let x = -ISLAND_DRY_GROUND_PADDING; x < width + ISLAND_DRY_GROUND_PADDING; x += 1) {
          if (count >= MAX_TILES) break;
          if (x >= 0 && x < width && y >= 0 && y < height) continue;
          const center = tileCenter(x, y, width, height);

          dummy.position.set(center.x, -TERRAIN_CUBE_HEIGHT * 1.5, center.z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          dryGroundCubeInstance.setMatrixAt(count, dummy.matrix);
          dryGroundCubeInstance.setColorAt(count, colorFromHex(ISLAND_DRY_GROUND_TINT));

          count += 1;
        }
      }
      dryGroundCubeInstance.count = count;
      dryGroundCubeInstance.instanceMatrix.needsUpdate = true;
      if (dryGroundCubeInstance.instanceColor) dryGroundCubeInstance.instanceColor.needsUpdate = true;
    } else {
      dryGroundCubeInstance.count = 0;
    }

    if (!hasGround && !useCubeTerrain) {
      let count = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (count >= MAX_TILES) break;
          const center = tileCenter(x, y, width, height);
          
          dummy.position.set(center.x, 0, center.z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          tileInstance.setMatrixAt(count, dummy.matrix);
          tileInstance.setColorAt(count, colorFromHex(tileFloorColor(terrain, x, y)));

          count += 1;
        }
      }
      tileInstance.count = count;
      tileInstance.instanceMatrix.needsUpdate = true;
      tileInstance.instanceColor.needsUpdate = true;
    } else {
      tileInstance.count = 0;
    }

    // Always update highlights (on top of ground/tiles)
    let hCount = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (hCount >= MAX_TILES) break;
        const center = tileCenter(x, y, width, height);
        dummy.position.set(center.x, 0.055, center.z);
        dummy.updateMatrix();
        highlightInstance.setMatrixAt(hCount, dummy.matrix);
        highlightInstance.setColorAt(hCount, colorFromHex('#ffffff'));
        hCount += 1;
      }
    }
    
    highlightInstance.count = hCount;
    highlightInstance.instanceMatrix.needsUpdate = true;
    highlightInstance.instanceColor.needsUpdate = true;
  }



  function playModelUnitAnimation(group, clipName, { restart = false } = {}) {
    const actions = group.userData.actions;
    const next = actions?.[clipName];
    if (!next) return false;
    if (!restart && group.userData.activeAnimation === clipName) return true;

    const previous = actions[group.userData.activeAnimation];
    next.enabled = true;
    next.paused = false;
    next.reset().fadeIn(0.12).play();
    if (previous && previous !== next) previous.fadeOut(0.12);

    group.userData.activeAnimation = clipName;
    return true;
  }

  function heroDebugAnimationId() {
    return state.debugHero?.selectedAnimationId || null;
  }

  function shouldLoopModelAnimation(clipName, modelConfig) {
    if (clipName === modelConfig.idleAnimation || clipName === modelConfig.walkAnimation) return true;
    return HERO_DEBUG_ANIMATION_BY_ID.get(clipName)?.loop ?? false;
  }

  function applySelectedHeroDebugAnimation(group) {
    if (!group.userData.isPlayer) return false;

    const clipName = heroDebugAnimationId();
    const debugState = group.userData.heroDebug || (group.userData.heroDebug = {
      clipName: null,
      finished: false,
    });

    if (!clipName) {
      debugState.clipName = null;
      debugState.finished = false;
      return false;
    }

    const action = group.userData.actions?.[clipName];
    if (!action) return true;

    if (debugState.clipName !== clipName) {
      debugState.clipName = clipName;
      debugState.finished = false;
      playModelUnitAnimation(group, clipName, { restart: true });
      return true;
    }

    if (debugState.finished) return true;

    playModelUnitAnimation(group, clipName);
    return true;
  }

  function updateModelUnitState(group, unit, movement, action, now) {
    const modelConfig = group.userData.modelConfig || DEFAULT_PLAYER_MODEL;
    if (applySelectedHeroDebugAnimation(group)) return;

    if (action) {
      faceDirection(group, {
        x: action.targetX - action.sourceX,
        y: action.targetY - action.sourceY,
      });
      const animationName = action.animation || modelConfig.attackAnimation;
      const actionKey = `${action.entityId}:${animationName}:${action.startTime}`;
      const shouldRestart = group.userData.activeModelActionKey !== actionKey;
      const played = playModelUnitAnimation(group, animationName, { restart: shouldRestart });
      if (!played && animationName !== modelConfig.attackAnimation) {
        playModelUnitAnimation(group, modelConfig.attackAnimation, { restart: shouldRestart });
      }
      group.userData.activeModelActionKey = actionKey;
      return;
    }

    group.userData.activeModelActionKey = null;
    const isMoving = isMovementActive(movement, now);
    playModelUnitAnimation(
      group,
      isMoving ? modelConfig.walkAnimation : modelConfig.idleAnimation,
    );

    if (!isMoving) {
      faceDirection(group, unit?.facing);
      return;
    }

    const direction = movementDirection(movement, now);
    faceDirection(group, direction);
  }

  function createCardUnitMesh(unit, isPlayer, entityId) {
    const group = new THREE.Group();
    const tint = isPlayer ? '#047857' : unit.tint;
    const source = imageSourceForUnit(unit, isPlayer);
    const texture = textureFor(source);
    group.rotation.y = CARD_ROTATION_Y;

    const frameMaterial = new THREE.MeshBasicMaterial({
      color: colorFromHex(tint),
      side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH + 0.08, CARD_HEIGHT + 0.1), frameMaterial);
    frame.position.y = CARD_HEIGHT / 2 + 0.1;
    frame.userData.entityId = entityId;
    group.add(frame);

    const faceMaterial = new THREE.MeshBasicMaterial({
      color: texture ? colorFromHex('#ffffff') : colorFromHex(tint),
      map: texture,
      side: THREE.DoubleSide,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT), faceMaterial);
    face.position.set(0, CARD_HEIGHT / 2 + 0.1, 0.012);
    face.userData.entityId = entityId;
    group.add(face);

    group.userData = {
      entityId,
      faceMaterial,
      frameMaterial,
      isPlayer,
      tint,
      unitType: unitTypeKey(unit, isPlayer),
    };

    scene.add(group);
    return group;
  }

  function createModelUnitMesh(unit, isPlayer, entityId, modelConfig) {
    const group = new THREE.Group();
    group.rotation.y = modelConfig.initialRotationY;
    group.userData = {
      entityId,
      isModelUnit: true,
      isPlayer,
      tint: isPlayer ? '#047857' : unit.tint,
      unitType: unitTypeKey(unit, isPlayer),
      modelConfig,
      activeAnimation: null,
      activeModelActionKey: null,
      heroDebug: {
        clipName: null,
        finished: false,
      },
      actions: {},
    };
    scene.add(group);

    Promise.all([
      loadGltfAsset(modelConfig.modelUrl),
      ...modelConfig.animations.map((url) => loadGltfAsset(url)),
    ]).then(async ([modelGltf, ...animationGltfs]) => {
      const model = cloneSkeleton(modelGltf.scene);
      model.scale.setScalar(modelConfig.scale);
      centerModelOnGround(model);
      model.position.y += modelConfig.groundOffset;
      model.traverse((child) => {
        child.userData.entityId = entityId;
      });
      await prepareGltfModel(modelGltf, model, {
        url: modelConfig.modelUrl,
        typeId: isPlayer ? playerModelKey(unit) : null,
        palette: isPlayer ? unit?.characterPalette : null,
      });
      group.add(model);

      const mixer = new THREE.AnimationMixer(model);
      const clips = new Map();
      for (const gltf of animationGltfs) {
        for (const clip of gltf.animations || []) {
          clips.set(clip.name, clip);
        }
      }

      for (const [clipName, clip] of clips.entries()) {
        const action = mixer.clipAction(clip);
        if (shouldLoopModelAnimation(clipName, modelConfig)) {
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = false;
        } else {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        if (clipName === modelConfig.walkAnimation) {
          action.timeScale = modelConfig.walkTimeScale;
        }
        group.userData.actions[clipName] = action;
      }

      mixer.addEventListener('finished', (event) => {
        const clipName = event.action?._clip?.name || null;
        const debugState = group.userData.heroDebug;
        if (
          group.userData.isPlayer &&
          debugState?.clipName &&
          debugState.clipName === clipName &&
          !shouldLoopModelAnimation(clipName, modelConfig)
        ) {
          debugState.finished = true;
        }
      });

      mixers.set(`unit:${entityId}`, mixer);
      if (!applySelectedHeroDebugAnimation(group)) {
        playModelUnitAnimation(group, modelConfig.idleAnimation);
      }
    }).catch((error) => {
      console.error('Erro ao carregar modelo da unidade:', error);
    });

    return group;
  }

  function createUnitMesh(unit, isPlayer, entityId) {
    const modelConfig = modelConfigForUnit(unit, isPlayer);
    if (modelConfig?.modelUrl) {
      return createModelUnitMesh(unit, isPlayer, entityId, modelConfig);
    }

    return createCardUnitMesh(unit, isPlayer, entityId);
  }

  function updateWalls(walls) {
    const active = new Set(walls);
    const isOverworld = state.game.mode === GAME_MODES.OVERWORLD;
    const material = isOverworld ? overworldWallMaterials : combatWallMaterial;

    for (const wallKey of active) {
      const [x, y] = wallKey.split(',').map(Number);
      const center = tileCenter(x, y, currentBoard.width, currentBoard.height);
      
      let wall = wallMeshes.get(wallKey);
      
      // If mode changed, we might need to recreate or update material
      if (wall && wall.userData.isOverworld !== isOverworld) {
        boardGroup.remove(wall);
        wall = null;
      }

      if (!wall) {
        wall = new THREE.Mesh(wallGeometry, material);
        wall.userData.isOverworld = isOverworld;
        wall.castShadow = true;
        wall.receiveShadow = true;
        wallMeshes.set(wallKey, wall);
        boardGroup.add(wall);
      }
      
      wall.position.set(center.x, 0.31, center.z);
    }

    for (const [wallKey, wall] of wallMeshes.entries()) {
      if (active.has(wallKey)) continue;
      boardGroup.remove(wall);
      wallMeshes.delete(wallKey);
    }
  }

  function createWorldObjectMesh(object, type) {
    if (type.shape === 'model' && type.modelUrl) {
      const group = new THREE.Group();
      group.userData.typeId = type.id;
      group.userData.hasOutline = !!state.visuals.showOutlines;
      boardGroup.add(group);

      loadGltfAsset(type.modelUrl).then(async (gltf) => {
        const model = cloneSkeleton(gltf.scene);
        centerModelOnGround(model);
        await prepareGltfModel(gltf, model, { url: type.modelUrl });

        // Setup Animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
          });
          mixers.set(object.id, mixer);
        }

        group.add(model);
        
        // Apply custom scale/rotation from config
        const finalScale = object.scale || type.scale || 1.0;
        group.scale.set(finalScale, finalScale, finalScale);
        const rotation = object.rotation || type.rotation;
        if (rotation) group.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
      }).catch((error) => {
        console.error('Erro ao carregar modelo:', type.modelUrl, error);
      });
      
      return group;
    }

    const mesh = new THREE.Mesh(objectGeometryFor(type), objectMaterialFor(type));
    mesh.userData.typeId = type.id;
    mesh.userData.hasOutline = !!state.visuals.showOutlines;
    
    if (type.shape === 'sprite') {
      mesh.rotation.y = CARD_ROTATION_Y;
    } else {
      mesh.castShadow = true;
    }
    mesh.receiveShadow = true;

    // Add outline if debug enabled
    if (state.visuals.showOutlines) {
      const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
      const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMaterial);
      
      if (type.shape === 'sprite') {
        // For sprites, we use a slightly larger plane behind it
        outlineMesh.scale.set(1.08, 1.08, 1.08);
        outlineMesh.position.z = -0.01;
        outlineMesh.material.side = THREE.DoubleSide; // Sprites need double side or front side behind
      } else {
        // For 3D shapes, we use the inverted hull technique
        outlineMesh.scale.multiplyScalar(1.05);
      }
      
      mesh.add(outlineMesh);
    }

    boardGroup.add(mesh);
    return mesh;
  }

  function updateWorldObjects(objects) {
    const activeObjectIds = new Set();

    for (const object of objects || []) {
      const type = WORLD_OBJECT_TYPES[object.type];
      if (!type) continue;

      activeObjectIds.add(object.id);
      let mesh = objectMeshes.get(object.id);

      if (mesh && (mesh.userData.typeId !== type.id || mesh.userData.hasOutline !== state.visuals.showOutlines)) {
        boardGroup.remove(mesh);
        objectMeshes.delete(object.id);
        mixers.delete(object.id); // Limpar mixer associado
        mesh = null;
      }

      if (!mesh) {
        mesh = createWorldObjectMesh(object, type);
        objectMeshes.set(object.id, mesh);
      }

      const center = tileCenter(object.x, object.y, currentBoard.width, currentBoard.height);
      const height = type.height || type.size?.height || 0.45;
      
      let posX = center.x;
      let posZ = center.z;
      
      if (type.alignment === 'bottom') {
        // Offset towards the camera (southeast in this coordinate system)
        const offset = 0.38;
        posX += offset;
        posZ += offset;
      }

      const posY = type.shape === 'model'
        ? (type.groundOffset ?? 0)
        : height / 2 + 0.05;

      mesh.position.set(posX, posY, posZ);
    }

    for (const [objectId, mesh] of objectMeshes.entries()) {
      if (activeObjectIds.has(objectId)) continue;
      boardGroup.remove(mesh);
      objectMeshes.delete(objectId);
      mixers.delete(objectId); // Limpar mixer associado
    }
  }

  function currentDebugMapId() {
    if (state.game.mode === GAME_MODES.OVERWORLD) {
      return state.game.overworld?.currentMapId || null;
    }

    return `combat:${state.game.levelIndex ?? 0}`;
  }

  function createDebugEditorMesh(placement) {
    const group = new THREE.Group();
    group.userData.placementId = placement.id;
    group.userData.kind = 'model';
    group.userData.modelUrl = placement.modelUrl;
    group.userData.loading = true;
    debugEditorGroup.add(group);

    loadGltfAsset(placement.modelUrl).then(async (gltf) => {
      if (!debugEditorMeshes.has(placement.id)) return;
      const model = cloneSkeleton(gltf.scene);
      centerModelOnGround(model);
      await prepareGltfModel(gltf, model, { url: placement.modelUrl });
      group.add(model);
      group.userData.loading = false;
    }).catch((error) => {
      console.error('Erro ao carregar modelo de debug:', placement.modelUrl, error);
      group.userData.loading = false;
    });

    return group;
  }

  function createDebugEditorTextureMesh(placement) {
    const textureUrl = placement.textureUrl || placement.modelUrl;
    const group = new THREE.Group();
    group.userData.placementId = placement.id;
    group.userData.kind = 'texture';
    group.userData.modelUrl = textureUrl;
    debugEditorGroup.add(group);

    const textureMap = textureFor(textureUrl);
    const material = new THREE.MeshBasicMaterial({
      map: textureMap,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const plane = new THREE.Mesh(debugTextureGeometry, material);
    plane.renderOrder = 44;
    group.add(plane);

    function applyAspectRatio() {
      const image = textureMap?.image;
      if (!image?.width || !image?.height) return;
      const aspect = image.width / image.height;
      if (aspect >= 1) {
        plane.scale.set(aspect, 1, 1);
      } else {
        plane.scale.set(1, 1 / aspect, 1);
      }
    }

    applyAspectRatio();
    if (textureMap) {
      const previousOnUpdate = textureMap.onUpdate;
      textureMap.onUpdate = (texture) => {
        previousOnUpdate?.(texture);
        applyAspectRatio();
        textureMap.onUpdate = previousOnUpdate || null;
      };
    }

    return group;
  }

  function updateDebugEditorModels() {
    const editor = state.debugEditor;
    const mapId = currentDebugMapId();
    const activeIds = new Set();

    if (!editor || !mapId) {
      debugSelectionMarker.visible = false;
      for (const [id, mesh] of debugEditorMeshes.entries()) {
        debugEditorGroup.remove(mesh);
        debugEditorMeshes.delete(id);
      }
      return;
    }

    for (const placement of editor.placements || []) {
      if (placement.mapId !== mapId) continue;
      activeIds.add(placement.id);
      const kind = placement.kind === 'texture' ? 'texture' : 'model';
      const assetUrl = kind === 'texture' ? (placement.textureUrl || placement.modelUrl) : placement.modelUrl;

      let mesh = debugEditorMeshes.get(placement.id);
      if (mesh && (mesh.userData.kind !== kind || mesh.userData.modelUrl !== assetUrl)) {
        debugEditorGroup.remove(mesh);
        debugEditorMeshes.delete(placement.id);
        mesh = null;
      }

      if (!mesh) {
        mesh = kind === 'texture'
          ? createDebugEditorTextureMesh(placement)
          : createDebugEditorMesh(placement);
        debugEditorMeshes.set(placement.id, mesh);
      }

      const position = placement.position || { x: 0, y: 0, z: 0 };
      const rotation = placement.rotation || { x: 0, y: 0, z: 0 };
      const scale = Number.isFinite(placement.scale)
        ? placement.scale
        : kind === 'texture' ? 1 : DEBUG_MODEL_DEFAULT_SCALE;

      mesh.position.set(position.x || 0, position.y || 0, position.z || 0);
      mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
      mesh.scale.setScalar(scale);
    }

    for (const [id, mesh] of debugEditorMeshes.entries()) {
      if (activeIds.has(id)) continue;
      debugEditorGroup.remove(mesh);
      debugEditorMeshes.delete(id);
    }

    const selected = (editor.placements || []).find((placement) => {
      return placement.id === editor.selectedPlacementId && placement.mapId === mapId;
    });
    if (selected) {
      const position = selected.position || { x: 0, y: 0, z: 0 };
      const scale = Number.isFinite(selected.scale) ? selected.scale : DEBUG_MODEL_DEFAULT_SCALE;
      debugSelectionMarker.position.set(position.x || 0, 0.075, position.z || 0);
      debugSelectionMarker.scale.setScalar(Math.max(0.6, scale));
      debugSelectionMarker.visible = true;
    } else {
      debugSelectionMarker.visible = false;
    }
  }

  function updateDebugCubes() {
    const debugCubes = state.debugCubes;
    const mapId = currentDebugMapId();
    const placements = Array.isArray(debugCubes?.placements) ? debugCubes.placements : [];
    let count = 0;
    let selected = null;
    debugCubeHitTargets.length = 0;
    debugCubeTopHeights.clear();

    for (const cube of placements) {
      if (cube.mapId !== mapId || count >= MAX_DEBUG_CUBES) continue;
      const center = tileCenter(cube.x, cube.y, currentBoard.width, currentBoard.height);
      const level = Math.max(0, cube.level ?? 0);
      const topHeight = TERRAIN_CUBE_HEIGHT * (level + 1) + 0.055;
      const tileKey = keyFor(cube.x, cube.y);

      dummy.position.set(center.x, TERRAIN_CUBE_HEIGHT * (level + 0.5), center.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      debugCubeInstance.setMatrixAt(count, dummy.matrix);
      debugCubeInstance.setColorAt(count, colorFromHex('#ffffff'));
      debugCubeHitTargets[count] = cube;
      debugCubeTopHeights.set(tileKey, Math.max(debugCubeTopHeights.get(tileKey) ?? 0.055, topHeight));
      count += 1;

      if (cube.id === debugCubes?.selectedCubeId) selected = cube;
    }

    debugCubeInstance.count = count;
    debugCubeInstance.instanceMatrix.needsUpdate = true;
    debugCubeInstance.computeBoundingBox();
    debugCubeInstance.computeBoundingSphere();
    if (debugCubeInstance.instanceColor) debugCubeInstance.instanceColor.needsUpdate = true;

    if (selected) {
      const center = tileCenter(selected.x, selected.y, currentBoard.width, currentBoard.height);
      const level = Math.max(0, selected.level ?? 0);
      debugCubeSelectionMarker.position.set(center.x, TERRAIN_CUBE_HEIGHT * (level + 1) + 0.012, center.z);
      debugCubeSelectionMarker.visible = true;
    } else {
      debugCubeSelectionMarker.visible = false;
    }
  }

  function debugCubeHighlightHeight(x, y) {
    return debugCubeTopHeights.get(keyFor(x, y)) ?? 0.055;
  }

  function updateHighlights({
    hoverTile,
    reachable,
    playerAttackTiles,
    monsterReachable,
    monsterAttackTiles,
  }) {
    const width = currentBoard.width;
    const height = currentBoard.height;
    let count = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (count >= MAX_TILES) break;
        const tileKey = keyFor(x, y);
        const flags = {
          hover: hoverTile && hoverTile.x === x && hoverTile.y === y,
          move: reachable.has(tileKey),
          playerAttack: playerAttackTiles.has(tileKey),
          monsterMove: monsterReachable.has(tileKey),
          monsterAttack: monsterAttackTiles.has(tileKey),
        };
        const type = HIGHLIGHT_ORDER.find((name) => flags[name]);
        
        if (!type) {
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.scale.set(1, 1, 1);
          const style = HIGHLIGHT_COLORS[type];
          highlightInstance.setColorAt(count, colorFromHex(style.color));
        }

        const center = tileCenter(x, y, width, height);
        dummy.position.set(center.x, debugCubeHighlightHeight(x, y), center.z);
        dummy.updateMatrix();
        highlightInstance.setMatrixAt(count, dummy.matrix);
        count += 1;
      }
    }
    highlightInstance.instanceMatrix.needsUpdate = true;
    highlightInstance.instanceColor.needsUpdate = true;
  }

  function clearPathArrows() {
    while (pathArrowGroup.children.length > 0) {
      pathArrowGroup.remove(pathArrowGroup.children[0]);
    }
  }

  function updatePathArrows(path) {
    clearPathArrows();
    if (state.game.mode === GAME_MODES.OVERWORLD) return;
    if (!Array.isArray(path) || path.length < 2) return;

    for (let index = 0; index < path.length - 1; index += 1) {
      const from = tileCenter(path[index].x, path[index].y, currentBoard.width, currentBoard.height);
      const to = tileCenter(path[index + 1].x, path[index + 1].y, currentBoard.width, currentBoard.height);
      const direction = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
      const tileDistance = direction.length();
      if (tileDistance <= 0.01) continue;

      direction.normalize();
      const origin = new THREE.Vector3(
        from.x + direction.x * 0.23,
        0.19,
        from.z + direction.z * 0.23,
      );
      const arrow = new THREE.ArrowHelper(
        direction,
        origin,
        Math.min(0.62, tileDistance * 0.68),
        0xffffff,
        0.19,
        0.15,
      );

      arrow.line.material.transparent = true;
      arrow.line.material.opacity = 0.95;
      arrow.line.material.depthTest = false;
      arrow.cone.material.transparent = true;
      arrow.cone.material.opacity = 0.95;
      arrow.cone.material.depthTest = false;
      arrow.renderOrder = 30;
      arrow.line.renderOrder = 30;
      arrow.cone.renderOrder = 30;

      pathArrowGroup.add(arrow);
    }
  }

  function updateUnit(unit, entityId, isPlayer, now) {
    const modelConfig = modelConfigForUnit(unit, isPlayer);
    let group = unitMeshes.get(entityId);
    const needsRecreate = group && (
      group.userData.unitType !== unitTypeKey(unit, isPlayer) ||
      !!group.userData.isModelUnit !== !!modelConfig?.modelUrl
    );

    if (needsRecreate) {
      scene.remove(group);
      unitMeshes.delete(entityId);
      mixers.delete(`unit:${entityId}`);
      group = null;
    }

    if (!group) {
      group = createUnitMesh(unit, isPlayer, entityId);
      unitMeshes.set(entityId, group);
    }

    const animations = state.game.animations || [];
    const movement = movementAnimationFor(entityId, animations);
    const modelAction = modelActionFor(entityId, animations, now);
    const { drawX, drawY } = movementPosition(unit, entityId, animations, now);
    const bump = bumpOffset(unit, entityId, animations, now);
    const center = tileCenter(drawX, drawY, currentBoard.width, currentBoard.height);
    group.position.set(center.x + bump.x, 0.02, center.z + bump.z);
    group.userData.tileX = unit.x;
    group.userData.tileY = unit.y;
    group.userData.drawX = drawX;
    group.userData.drawY = drawY;

    if (group.userData.isModelUnit) {
      updateModelUnitState(group, unit, movement, modelAction, now);
      return;
    }

    if (group.userData.frameMaterial) {
      group.userData.frameMaterial.color.set(
        isFlashing(entityId, animations, now) ? '#b94735' : group.userData.tint,
      );
    }
  }

  function updateUnits(now) {
    const desiredIds = new Set(['player']);
    updateUnit(state.game.player, 'player', true, now);

    const units = state.game.mode === GAME_MODES.OVERWORLD
      ? getCurrentWorldEnemies(state.game.overworld)
      : state.game.monsters;

    for (const monster of units) {
      if (
        monster.hp <= 0 &&
        !hasPendingModelAction(monster.id, state.game.animations || [], now, 'Death_A')
      ) {
        continue;
      }
      desiredIds.add(monster.id);
      updateUnit(monster, monster.id, false, now);
    }

    for (const [entityId, mesh] of unitMeshes.entries()) {
      if (desiredIds.has(entityId)) continue;
      scene.remove(mesh);
      unitMeshes.delete(entityId);
      mixers.delete(`unit:${entityId}`);
    }
  }

  function connectionBridgeDirection(conn) {
    if (conn.x <= 0) return { x: -1, y: 0 };
    if (conn.x >= currentBoard.width - 1) return { x: 1, y: 0 };
    if (conn.y <= 0) return { x: 0, y: -1 };
    if (conn.y >= currentBoard.height - 1) return { x: 0, y: 1 };
    return { x: 0, y: 1 };
  }

  function setConnectionBridgeMatrix(
    instance,
    index,
    center,
    direction,
    angle,
    rightOffset,
    forwardOffset,
    y,
    scaleX = 1,
    scaleZ = 1,
  ) {
    dummy.position.set(
      center.x + direction.x * forwardOffset + direction.y * rightOffset,
      y,
      center.z + direction.y * forwardOffset - direction.x * rightOffset,
    );
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(scaleX, 1, scaleZ);
    dummy.updateMatrix();
    instance.setMatrixAt(index, dummy.matrix);
  }

  function syncConnectionBridgeInstance(instance, count) {
    instance.count = count;
    instance.visible = count > 0;
    instance.instanceMatrix.needsUpdate = true;
    if (count > 0) {
      instance.computeBoundingBox();
      instance.computeBoundingSphere();
    }
  }

  function syncConnectionRampInstance(count) {
    connectionRampInstance.count = count;
    connectionRampInstance.visible = count > 0;
    connectionRampInstance.instanceMatrix.needsUpdate = true;
    if (connectionRampInstance.instanceColor) connectionRampInstance.instanceColor.needsUpdate = true;
    if (count > 0) {
      connectionRampInstance.computeBoundingBox();
      connectionRampInstance.computeBoundingSphere();
    }
  }

  function syncConnectionBridgeWaterAccentInstances(shadowCount, outlineCount) {
    connectionBridgeWaterShadowInstance.count = shadowCount;
    connectionBridgeWaterShadowInstance.visible = shadowCount > 0;
    connectionBridgeWaterShadowInstance.instanceMatrix.needsUpdate = true;
    if (shadowCount > 0) {
      connectionBridgeWaterShadowInstance.computeBoundingBox();
      connectionBridgeWaterShadowInstance.computeBoundingSphere();
    }

    connectionBridgePostWaterOutlineInstance.count = outlineCount;
    connectionBridgePostWaterOutlineInstance.visible = outlineCount > 0;
    connectionBridgePostWaterOutlineInstance.instanceMatrix.needsUpdate = true;
    if (outlineCount > 0) {
      connectionBridgePostWaterOutlineInstance.computeBoundingBox();
      connectionBridgePostWaterOutlineInstance.computeBoundingSphere();
    }

    connectionBridgeWaterAccentGroup.visible = shadowCount > 0 || outlineCount > 0;
  }

  function clearConnectionBridgeInstances() {
    connectionBridgeDeckTargets.length = 0;
    connectionBridgeRailTargets.length = 0;
    connectionBridgePostTargets.length = 0;
    connectionBridgePlankTargets.length = 0;
    syncConnectionBridgeInstance(connectionBridgeDeckInstance, 0);
    syncConnectionBridgeInstance(connectionBridgeRailInstance, 0);
    syncConnectionBridgeInstance(connectionBridgePostInstance, 0);
    syncConnectionBridgeInstance(connectionBridgePlankInstance, 0);
    syncConnectionBridgeWaterAccentInstances(0, 0);
  }

  function updateConnections(connections) {
    let deckCount = 0;
    let railCount = 0;
    let postCount = 0;
    let plankCount = 0;
    let rampCount = 0;
    let shadowCount = 0;
    let outlineCount = 0;
    const waterEnabled = currentBoard.waterEnabled !== false;

    if (!waterEnabled) {
      clearConnectionBridgeInstances();

      for (const conn of connections || []) {
        if (rampCount >= MAX_TILES) break;
        const direction = connectionBridgeDirection(conn);
        const center = tileCenter(conn.x, conn.y, currentBoard.width, currentBoard.height);

        dummy.position.set(center.x, 0.006, center.z);
        dummy.rotation.set(0, Math.atan2(direction.x, direction.y), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        connectionRampInstance.setMatrixAt(rampCount, dummy.matrix);
        connectionRampInstance.setColorAt(rampCount, colorFromHex('#ffffff'));
        rampCount += 1;
      }

      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      syncConnectionRampInstance(rampCount);
      return;
    }

    syncConnectionRampInstance(0);

    const deckY = CONNECTION_BRIDGE_DECK_HEIGHT / 2 + 0.022;
    const railY = deckY + CONNECTION_BRIDGE_DECK_HEIGHT / 2 + CONNECTION_BRIDGE_RAIL_HEIGHT / 2 - 0.012;
    const postTopY = deckY + CONNECTION_BRIDGE_DECK_HEIGHT / 2 + CONNECTION_BRIDGE_POST_ABOVE_DECK_HEIGHT - 0.018;
    const postY = postTopY - CONNECTION_BRIDGE_POST_HEIGHT / 2;
    const plankY = deckY + CONNECTION_BRIDGE_DECK_HEIGHT / 2 + 0.012;
    const shadowY = ISLAND_WATER_LEVEL + 0.004;
    const outlineY = ISLAND_WATER_LEVEL + 0.012;
    const bridgeCenterOffset = CONNECTION_BRIDGE_BOARD_EDGE_OFFSET + CONNECTION_BRIDGE_LENGTH / 2;
    const shadowCenterOffset = CONNECTION_BRIDGE_BOARD_EDGE_OFFSET
      + ISLAND_WATER_LIGHT_BAND
      + CONNECTION_BRIDGE_WATER_SHADOW_LENGTH / 2;
    const railOffset = CONNECTION_BRIDGE_WIDTH / 2 - CONNECTION_BRIDGE_RAIL_WIDTH / 2;
    const postOffset = CONNECTION_BRIDGE_WIDTH / 2 - CONNECTION_BRIDGE_POST_SIZE / 2;
    const innerPostForward = CONNECTION_BRIDGE_BOARD_EDGE_OFFSET + 0.16;
    const outerPostForward = CONNECTION_BRIDGE_BOARD_EDGE_OFFSET + CONNECTION_BRIDGE_LENGTH - 0.36;
    const plankSpacing = (CONNECTION_BRIDGE_LENGTH - 0.45) / (CONNECTION_BRIDGE_PLANK_COUNT - 1);
    const postOutlineOffset = CONNECTION_BRIDGE_POST_SIZE / 2
      + CONNECTION_BRIDGE_POST_WATER_OUTLINE_GAP
      + CONNECTION_BRIDGE_POST_WATER_OUTLINE_THICKNESS / 2;
    connectionBridgeDeckTargets.length = 0;
    connectionBridgeRailTargets.length = 0;
    connectionBridgePostTargets.length = 0;
    connectionBridgePlankTargets.length = 0;

    for (const conn of connections || []) {
      if (deckCount >= MAX_TILES) break;
      const direction = connectionBridgeDirection(conn);
      const center = tileCenter(conn.x, conn.y, currentBoard.width, currentBoard.height);
      const angle = Math.atan2(direction.x, direction.y);
      const target = { x: conn.x, y: conn.y };

      setConnectionBridgeMatrix(
        connectionBridgeDeckInstance,
        deckCount,
        center,
        direction,
        angle,
        0,
        bridgeCenterOffset,
        deckY,
      );
      connectionBridgeDeckTargets[deckCount] = target;
      deckCount += 1;

      setConnectionBridgeMatrix(
        connectionBridgeWaterShadowInstance,
        shadowCount,
        center,
        direction,
        angle,
        0,
        shadowCenterOffset,
        shadowY,
        CONNECTION_BRIDGE_WATER_SHADOW_WIDTH,
        CONNECTION_BRIDGE_WATER_SHADOW_LENGTH,
      );
      shadowCount += 1;

      for (const rightOffset of [-railOffset, railOffset]) {
        setConnectionBridgeMatrix(
          connectionBridgeRailInstance,
          railCount,
          center,
          direction,
          angle,
          rightOffset,
          bridgeCenterOffset,
          railY,
        );
        connectionBridgeRailTargets[railCount] = target;
        railCount += 1;
      }

      for (const forwardOffset of [innerPostForward, outerPostForward]) {
        for (const rightOffset of [-postOffset, postOffset]) {
          setConnectionBridgeMatrix(
            connectionBridgePostInstance,
            postCount,
            center,
            direction,
            angle,
            rightOffset,
            forwardOffset,
            postY,
          );
          connectionBridgePostTargets[postCount] = target;
          postCount += 1;

          for (const outlineRightOffset of [-postOutlineOffset, postOutlineOffset]) {
            setConnectionBridgeMatrix(
              connectionBridgePostWaterOutlineInstance,
              outlineCount,
              center,
              direction,
              angle,
              rightOffset + outlineRightOffset,
              forwardOffset,
              outlineY,
              CONNECTION_BRIDGE_POST_WATER_OUTLINE_THICKNESS,
              CONNECTION_BRIDGE_POST_WATER_OUTLINE_LENGTH,
            );
            outlineCount += 1;
          }

          for (const outlineForwardOffset of [-postOutlineOffset, postOutlineOffset]) {
            setConnectionBridgeMatrix(
              connectionBridgePostWaterOutlineInstance,
              outlineCount,
              center,
              direction,
              angle,
              rightOffset,
              forwardOffset + outlineForwardOffset,
              outlineY,
              CONNECTION_BRIDGE_POST_WATER_OUTLINE_LENGTH,
              CONNECTION_BRIDGE_POST_WATER_OUTLINE_THICKNESS,
            );
            outlineCount += 1;
          }
        }
      }

      for (let plankIndex = 0; plankIndex < CONNECTION_BRIDGE_PLANK_COUNT; plankIndex += 1) {
        setConnectionBridgeMatrix(
          connectionBridgePlankInstance,
          plankCount,
          center,
          direction,
          angle,
          0,
          CONNECTION_BRIDGE_BOARD_EDGE_OFFSET + 0.22 + plankIndex * plankSpacing,
          plankY,
        );
        connectionBridgePlankTargets[plankCount] = target;
        plankCount += 1;
      }
    }
    dummy.rotation.set(0, 0, 0);
    connectionBridgeDeckTargets.length = deckCount;
    connectionBridgeRailTargets.length = railCount;
    connectionBridgePostTargets.length = postCount;
    connectionBridgePlankTargets.length = plankCount;
    dummy.scale.set(1, 1, 1);

    syncConnectionBridgeInstance(connectionBridgeDeckInstance, deckCount);
    syncConnectionBridgeInstance(connectionBridgeRailInstance, railCount);
    syncConnectionBridgeInstance(connectionBridgePostInstance, postCount);
    syncConnectionBridgeInstance(connectionBridgePlankInstance, plankCount);
    syncConnectionBridgeWaterAccentInstances(shadowCount, outlineCount);
  }

  function unitGroupForHitObject(object) {
    let current = object;
    while (current) {
      const entityId = current.userData?.entityId;
      if (entityId && unitMeshes.has(entityId)) return unitMeshes.get(entityId);
      current = current.parent;
    }
    return null;
  }

  function connectionBridgePointAt() {
    const hits = raycaster.intersectObjects(connectionBridgeHitMeshes, false);
    for (const hit of hits) {
      if (!Number.isInteger(hit.instanceId)) continue;
      const target = hit.object.userData.connectionTargets?.[hit.instanceId];
      if (!target) continue;

      return {
        x: target.x,
        y: target.y,
        worldX: hit.point.x,
        worldZ: hit.point.z,
        kind: 'connectionBridge',
      };
    }

    return null;
  }

  function unitPointAt(layout, px, py) {
    const viewport = syncCamera(layout, performance.now());

    if (
      px < viewport.x ||
      py < viewport.y ||
      px > viewport.x + viewport.w ||
      py > viewport.y + viewport.h
    ) {
      return null;
    }

    pointer.x = ((px - viewport.x) / viewport.w) * 2 - 1;
    pointer.y = -(((py - viewport.y) / viewport.h) * 2 - 1);
    raycaster.setFromCamera(pointer, activeCamera);

    const hits = raycaster.intersectObjects(Array.from(unitMeshes.values()), true);
    for (const hit of hits) {
      const group = unitGroupForHitObject(hit.object);
      if (!group) continue;

      const x = group.userData.tileX;
      const y = group.userData.tileY;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < 0 || y < 0 || x >= currentBoard.width || y >= currentBoard.height) continue;

      return {
        x,
        y,
        worldX: hit.point.x,
        worldZ: hit.point.z,
        entityId: group.userData.entityId,
        kind: 'unit',
      };
    }

    return null;
  }

  function worldPointAtAny(layout, px, py) {
    const viewport = syncCamera(layout, performance.now());

    if (
      px < viewport.x ||
      py < viewport.y ||
      px > viewport.x + viewport.w ||
      py > viewport.y + viewport.h
    ) {
      return null;
    }

    pointer.x = ((px - viewport.x) / viewport.w) * 2 - 1;
    pointer.y = -(((py - viewport.y) / viewport.h) * 2 - 1);
    raycaster.setFromCamera(pointer, activeCamera);

    if (debugCubeInstance.count > 0) {
      const cubeHits = raycaster.intersectObject(debugCubeInstance, false);
      const cubeHit = cubeHits.find((hit) => {
        return Number.isInteger(hit.instanceId) && debugCubeHitTargets[hit.instanceId];
      });

      if (cubeHit) {
        const cube = debugCubeHitTargets[cubeHit.instanceId];
        return {
          x: cube.x,
          y: cube.y,
          worldX: cubeHit.point.x,
          worldZ: cubeHit.point.z,
          cubeId: cube.id,
          cubeLevel: Math.max(0, cube.level ?? 0),
          kind: 'debugCube',
        };
      }
    }

    const bridgePoint = connectionBridgePointAt();
    if (bridgePoint) return bridgePoint;

    const unitPoint = unitPointAt(layout, px, py);
    if (unitPoint) return unitPoint;

    if (!raycaster.ray.intersectPlane(boardPlane, rayHit)) return null;

    const x = Math.floor(rayHit.x + currentBoard.width / 2);
    const y = Math.floor(rayHit.z + currentBoard.height / 2);

    return {
      x,
      y,
      worldX: rayHit.x,
      worldZ: rayHit.z,
    };
  }

  function worldPointAt(layout, px, py) {
    const point = worldPointAtAny(layout, px, py);
    if (!point) return null;
    if (point.x < 0 || point.y < 0 || point.x >= currentBoard.width || point.y >= currentBoard.height) return null;
    return point;
  }

  function tileAt(layout, px, py) {
    const point = worldPointAt(layout, px, py);
    if (!point) return null;
    return {
      x: point.x,
      y: point.y,
      ...(point.kind ? { kind: point.kind } : {}),
    };
  }

  function updateIslandWater(delta) {
    if (!waterPlane.visible) return;
    waterPlane.userData.phase += delta;
    const bob = Math.sin(waterPlane.userData.phase * ISLAND_WATER_BOB_SPEED) * ISLAND_WATER_BOB_AMOUNT;
    waterPlane.position.y = ISLAND_WATER_LEVEL + bob;
    waterLightStrips.forEach((strip) => {
      strip.position.y = ISLAND_WATER_LEVEL + 0.008 + bob;
    });
    waterDarkStrips.forEach((strip) => {
      strip.position.y = ISLAND_WATER_LEVEL + 0.006 + bob;
    });
    connectionBridgeWaterAccentGroup.position.y = bob;
  }

  function disposeMaterial(material) {
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const currentMaterial of materials) {
      for (const value of Object.values(currentMaterial)) {
        if (value?.isTexture && typeof value.dispose === 'function') value.dispose();
      }
      currentMaterial.dispose?.();
    }
  }

  function disposeObject3D(object) {
    object.traverse?.((child) => {
      child.geometry?.dispose?.();
      disposeMaterial(child.material);
    });
  }

  function disposeThreeBoard() {
    mixers.clear();
    textureCache.forEach((texture) => texture.dispose?.());
    textureCache.clear();
    geometryCache.forEach((geometry) => geometry.dispose?.());
    geometryCache.clear();
    materialCache.forEach((material) => material.dispose?.());
    materialCache.clear();
    disposeObject3D(scene);
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer.domElement.remove();
    if (state.boardInteraction?.tileAt === tileAt) state.boardInteraction = null;
  }

  state.boardInteraction = {
    tileAt,
    worldPointAt,
    worldPointAtAny,
  };

  return {
    setVisible(visible) {
      renderer.domElement.style.display = visible ? 'block' : 'none';
    },
    getViewport(layout) {
      return boardViewport(layout, state.game.mode || GAME_MODES.DUNGEON_LEGACY);
    },
    screenPositionForTile(layout, x, y, height = 0.95) {
      const viewport = syncCamera(layout, performance.now());
      const center = tileCenter(x, y, currentBoard.width, currentBoard.height);
      const projected = new THREE.Vector3(center.x, height, center.z).project(activeCamera);

      return {
        x: viewport.x + ((projected.x + 1) / 2) * viewport.w,
        y: viewport.y + ((-projected.y + 1) / 2) * viewport.h,
      };
    },
    render({
      currentLayout,
      boardWidth = BOARD_SIZE,
      boardHeight = BOARD_SIZE,
      walls,
      objects = [],
      hoverTile,
      hoverPath,
      reachable,
      playerAttackTiles,
      monsterReachable,
      monsterAttackTiles,
      connections = [],
      now,
    }) {
      syncDebugColorMaterials();
      syncBoardGeometry(boardWidth, boardHeight, connections);
      syncRendererSize(currentLayout);
      const viewport = syncCamera(currentLayout, now);
      
      // Update visuals from state
      if (state.visuals) {
        renderer.toneMappingExposure = state.visuals.exposure;
        renderer.shadowMap.enabled = state.visuals.shadowMapEnabled;
        if (state.visuals.fogDensity > 0) {
          if (!scene.fog) scene.fog = new THREE.FogExp2('#070807', state.visuals.fogDensity);
          scene.fog.density = state.visuals.fogDensity;
        } else {
          scene.fog = null;
        }
        hemisphere.intensity = state.visuals.ambientIntensity;
        keyLight.intensity = state.visuals.keyIntensity;
        keyLight.castShadow = state.visuals.shadowMapEnabled;
        applyKeyLightDirection();
      }

      updateWalls(walls);
      updateWorldObjects(objects);
      updateDebugEditorModels();
      updateDebugCubes();
      updateHighlights({
        hoverTile,
        reachable,
        playerAttackTiles,
        monsterReachable,
        monsterAttackTiles,
      });
      updatePathArrows(hoverPath);
      updateUnits(now);
      updateConnections(connections);

      // Atualizar animações 3D
      const delta = animationTimer.getDelta();
      for (const mixer of mixers.values()) {
        mixer.update(delta);
      }
      updateIslandWater(delta);
      updateAnimatedTextures();

      const y = currentLayout.sh - viewport.y - viewport.h;
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setViewport(viewport.x, y, viewport.w, viewport.h);
      renderer.setScissor(viewport.x, y, viewport.w, viewport.h);
      renderer.setScissorTest(true);
      renderer.render(scene, activeCamera);
      renderer.setScissorTest(false);
    },
    dispose() {
      disposeThreeBoard();
    },
  };
}
