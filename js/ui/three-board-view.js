import * as THREE from 'three';
import { BOARD_SIZE, CARD_SOURCES, DEBUG_CONFIG, GAME_MODES, WORLD_ASSETS, WORLD_OBJECT_TYPES } from '../config/game-data.js';
import { getCurrentWorldEnemies } from '../game/world-state.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const CARD_WIDTH = 0.56;
const CARD_HEIGHT = 0.82;
const CARD_ROTATION_Y = Math.PI / 4;
const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.atan(1 / Math.sqrt(2));
const ISO_CAMERA_DISTANCE = 12;
const ORTHO_VIEW_HEIGHT = 7.48;
const COMPACT_ORTHO_VIEW_HEIGHT = 8.16;
const COMBAT_ORTHO_VIEW_HEIGHT = 8.26;
const COMPACT_COMBAT_ORTHO_VIEW_HEIGHT = 8.98;
const OVERWORLD_ORTHO_VIEW_HEIGHT = 9.18;
const COMPACT_OVERWORLD_ORTHO_VIEW_HEIGHT = 8.16;
const FLOOR_COLORS = ['#353124', '#252217'];
const SPECULAR_GLOSSINESS_EXTENSION = 'KHR_materials_pbrSpecularGlossiness';
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
  walkAnimation: 'Walking_A',
  attackAnimation: 'Hit_A',
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

function setIsometricCameraPosition(camera, target = { x: 0, z: 0 }) {
  const horizontalDistance = ISO_CAMERA_DISTANCE * Math.cos(ISO_ELEVATION);

  camera.position.set(
    target.x + horizontalDistance * Math.sin(ISO_AZIMUTH),
    ISO_CAMERA_DISTANCE * Math.sin(ISO_ELEVATION),
    target.z + horizontalDistance * Math.cos(ISO_AZIMUTH),
  );
  camera.lookAt(target.x, 0, target.z);
}

function boardViewport(layout, mode = GAME_MODES.DUNGEON_LEGACY) {
  if (mode === GAME_MODES.OVERWORLD) {
    return {
      x: 0,
      y: 0,
      w: Math.max(1, layout.sw),
      h: Math.max(1, layout.sh),
    };
  }

  const marginX = Math.min(118, layout.tileSize * 0.82);
  const marginTop = Math.min(142, layout.tileSize * 1.05);
  const marginBottom = Math.min(88, layout.tileSize * 0.7);
  const minX = layout.compact ? 0 : layout.sidebarW;
  const minY = layout.compact ? Math.max(0, layout.leftY + layout.leftH + 8) : 0;
  const x = Math.max(minX, Math.floor(layout.boardX - marginX));
  const y = Math.max(minY, Math.floor(layout.boardY - marginTop));
  const right = Math.min(layout.sw, Math.ceil(layout.boardX + layout.boardW + marginX));
  const bottom = Math.min(layout.sh, Math.ceil(layout.boardY + layout.boardH + marginBottom));

  return {
    x,
    y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y),
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
  return isPlayer ? `player:${playerModelKey(unit)}` : unit?.type || 'unit';
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
  };
  const scene = new THREE.Scene();
  scene.background = colorFromHex('#070807');
  if (state.visuals?.fogDensity > 0) {
    scene.fog = new THREE.FogExp2('#070807', state.visuals.fogDensity);
  }

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  setIsometricCameraPosition(camera);

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

    const texture = textureLoader.load(src);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    textureCache.set(src, texture);
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

  function prepareGltfModel(gltf, model, url = null) {
    let overrideTexture = null;
    if (url) {
      const overridePath = CHARACTER_TEXTURE_OVERRIDES[url] || CHARACTER_TEXTURE_OVERRIDES[url.replace(/^\.\//, '')];
      if (overridePath) {
        overrideTexture = textureFor(overridePath);
      }
    }

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
    map: textureFor(WORLD_ASSETS.terrain.grass),
  });
  if (groundMaterial.map) {
    groundMaterial.map.wrapS = THREE.RepeatWrapping;
    groundMaterial.map.wrapT = THREE.RepeatWrapping;
    groundMaterial.map.repeat.set(1, 1);
  }

  const wallMeshes = new Map();
  const objectMeshes = new Map();
  const unitMeshes = new Map();
  const wallGeometry = new THREE.BoxGeometry(0.9, 0.54, 0.9);
  
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

  const MAX_TILES = 5000;
  const tileGeometry = new THREE.BoxGeometry(0.94, 0.08, 0.94);
  const tileMaterial = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 });
  const tileInstance = new THREE.InstancedMesh(tileGeometry, tileMaterial, MAX_TILES);
  tileInstance.receiveShadow = true;
  tileInstance.frustumCulled = true;
  boardGroup.add(tileInstance);

  const highlightGeometry = new THREE.PlaneGeometry(0.86, 0.86);
  highlightGeometry.rotateX(-Math.PI / 2);

  const portalMeshes = new Map();
  const portalGeometry = new THREE.PlaneGeometry(0.85, 0.85);
  portalGeometry.rotateX(-Math.PI / 2);
  const portalMaterial = new THREE.MeshBasicMaterial({
    map: textureFor(WORLD_ASSETS.objects.portal),
    transparent: true,
    alphaTest: 0.5,
  });
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
  keyLight.position.set(5, 10, 5);
  keyLight.castShadow = state.visuals?.shadowMapEnabled ?? false;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.left = -15;
  keyLight.shadow.camera.right = 15;
  keyLight.shadow.camera.top = 15;
  keyLight.shadow.camera.bottom = -15;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

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

    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    setIsometricCameraPosition(camera, target);
    camera.updateProjectionMatrix();
    return viewport;
  }

  function syncBoardGeometry(width = BOARD_SIZE, height = BOARD_SIZE) {
    const isOverworld = state.game.mode === GAME_MODES.OVERWORLD;
    const hasGround = !!groundMaterial.map && isOverworld;

    if (
      currentBoard.width === width &&
      currentBoard.height === height &&
      currentBoard.hasGround === hasGround
    ) {
      return;
    }

    currentBoard.width = width;
    currentBoard.height = height;
    currentBoard.hasGround = hasGround;

    base.scale.set(width + 0.55, 1, height + 0.55);

    // Update ground plane
    groundPlane.scale.set(width, height, 1);
    groundPlane.position.set(0, 0.01, 0);
    groundPlane.visible = hasGround;

    // Toggle tiles
    tileInstance.visible = !hasGround;

    if (!hasGround) {
      let count = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (count >= MAX_TILES) break;
          const center = tileCenter(x, y, width, height);
          
          dummy.position.set(center.x, 0, center.z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          tileInstance.setMatrixAt(count, dummy.matrix);
          tileInstance.setColorAt(count, colorFromHex(FLOOR_COLORS[(x + y) % FLOOR_COLORS.length]));

          count += 1;
        }
      }
      tileInstance.count = count;
      tileInstance.instanceMatrix.needsUpdate = true;
      tileInstance.instanceColor.needsUpdate = true;
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



  function playModelUnitAnimation(group, clipName) {
    const actions = group.userData.actions;
    const next = actions?.[clipName];
    if (!next || group.userData.activeAnimation === clipName) return;

    const previous = actions[group.userData.activeAnimation];
    next.enabled = true;
    next.reset().fadeIn(0.12).play();
    if (previous && previous !== next) previous.fadeOut(0.12);

    group.userData.activeAnimation = clipName;
  }

  function updateModelUnitState(group, movement, action, now) {
    const modelConfig = group.userData.modelConfig || DEFAULT_PLAYER_MODEL;

    if (action) {
      faceDirection(group, {
        x: action.targetX - action.sourceX,
        y: action.targetY - action.sourceY,
      });
      playModelUnitAnimation(group, action.animation || modelConfig.attackAnimation);
      return;
    }

    const isMoving = isMovementActive(movement, now);
    playModelUnitAnimation(
      group,
      isMoving ? modelConfig.walkAnimation : modelConfig.idleAnimation,
    );

    if (!isMoving) return;

    const direction = movementDirection(movement, now);
    faceDirection(group, direction);
  }

  function createCardUnitMesh(unit, isPlayer) {
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
    group.add(frame);

    const faceMaterial = new THREE.MeshBasicMaterial({
      color: texture ? colorFromHex('#ffffff') : colorFromHex(tint),
      map: texture,
      side: THREE.DoubleSide,
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT), faceMaterial);
    face.position.set(0, CARD_HEIGHT / 2 + 0.1, 0.012);
    group.add(face);

    group.userData = {
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
      isModelUnit: true,
      isPlayer,
      tint: isPlayer ? '#047857' : unit.tint,
      unitType: unitTypeKey(unit, isPlayer),
      modelConfig,
      activeAnimation: null,
      actions: {},
    };
    scene.add(group);

    Promise.all([
      loadGltfAsset(modelConfig.modelUrl),
      ...modelConfig.animations.map((url) => loadGltfAsset(url)),
    ]).then(([modelGltf, ...animationGltfs]) => {
      const model = cloneSkeleton(modelGltf.scene);
      model.scale.setScalar(modelConfig.scale);
      centerModelOnGround(model);
      model.position.y += modelConfig.groundOffset;
      prepareGltfModel(modelGltf, model, modelConfig.modelUrl);
      group.add(model);

      const mixer = new THREE.AnimationMixer(model);
      const clips = new Map();
      for (const gltf of animationGltfs) {
        for (const clip of gltf.animations || []) {
          clips.set(clip.name, clip);
        }
      }

      for (const clipName of [
        modelConfig.idleAnimation,
        modelConfig.walkAnimation,
        modelConfig.attackAnimation,
        modelConfig.damageAnimation,
      ]) {
        const clip = clips.get(clipName);
        if (!clip) continue;
        const action = mixer.clipAction(clip);
        if (clipName === modelConfig.attackAnimation) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        } else if (clipName === modelConfig.damageAnimation) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        } else {
          action.setLoop(THREE.LoopRepeat, Infinity);
        }
        if (clipName === modelConfig.walkAnimation) {
          action.timeScale = modelConfig.walkTimeScale;
        }
        group.userData.actions[clipName] = action;
      }

      mixers.set(`unit:${entityId}`, mixer);
      playModelUnitAnimation(group, modelConfig.idleAnimation);
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

    return createCardUnitMesh(unit, isPlayer);
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

      loadGltfAsset(type.modelUrl).then((gltf) => {
        const model = cloneSkeleton(gltf.scene);
        centerModelOnGround(model);
        prepareGltfModel(gltf, model, type.modelUrl);

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
        dummy.position.set(center.x, 0.055, center.z);
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

    if (group.userData.isModelUnit) {
      updateModelUnitState(group, movement, modelAction, now);
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
      if (monster.hp <= 0) continue;
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

  function updateConnections(connections) {
    const active = new Set();
    for (const conn of connections || []) {
      active.add(conn.id);
      let mesh = portalMeshes.get(conn.id);
      if (!mesh) {
        mesh = new THREE.Mesh(portalGeometry, portalMaterial);
        portalMeshes.set(conn.id, mesh);
        boardGroup.add(mesh);
      }
      const center = tileCenter(conn.x, conn.y, currentBoard.width, currentBoard.height);
      mesh.position.set(center.x, 0.045, center.z);
    }
    for (const [id, mesh] of portalMeshes.entries()) {
      if (!active.has(id)) {
        boardGroup.remove(mesh);
        portalMeshes.delete(id);
      }
    }
  }

  function tileAt(layout, px, py) {
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
    raycaster.setFromCamera(pointer, camera);

    if (!raycaster.ray.intersectPlane(boardPlane, rayHit)) return null;

    const x = Math.floor(rayHit.x + currentBoard.width / 2);
    const y = Math.floor(rayHit.z + currentBoard.height / 2);

    if (x < 0 || y < 0 || x >= currentBoard.width || y >= currentBoard.height) return null;
    return { x, y };
  }

  state.boardInteraction = {
    tileAt,
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
      const projected = new THREE.Vector3(center.x, height, center.z).project(camera);

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
      syncBoardGeometry(boardWidth, boardHeight);
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
      }

      updateWalls(walls);
      updateWorldObjects(objects);
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

      const y = currentLayout.sh - viewport.y - viewport.h;
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setViewport(viewport.x, y, viewport.w, viewport.h);
      renderer.setScissor(viewport.x, y, viewport.w, viewport.h);
      renderer.setScissorTest(true);
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
    },
  };
}
