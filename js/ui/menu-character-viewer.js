import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const CHARACTER_MODELS = {
  mage: {
    modelUrl: '/assets/models/adventurers/characters/mage.glb',
    textureUrl: '/assets/models/adventurers/textures/mage_texture.png',
  },
  barbarian: {
    modelUrl: '/assets/models/adventurers/characters/barbarian.glb',
    textureUrl: '/assets/models/adventurers/textures/barbarian_texture.png',
  },
  knight: {
    modelUrl: '/assets/models/adventurers/characters/knight.glb',
    textureUrl: '/assets/models/adventurers/textures/knight_texture.png',
  },
  ranger: {
    modelUrl: '/assets/models/adventurers/characters/ranger.glb',
    textureUrl: '/assets/models/adventurers/textures/ranger_texture.png',
  },
  rogue: {
    modelUrl: '/assets/models/adventurers/characters/rogue.glb',
    textureUrl: '/assets/models/adventurers/textures/rogue_texture.png',
  },
};

const IDLE_ANIMATION_URL = '/assets/models/adventurers/animations/rig-medium/general.glb';

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const gltfCache = new Map();
const textureCache = new Map();

function loadGltf(url) {
  if (!gltfCache.has(url)) {
    gltfCache.set(url, new Promise((resolve, reject) => {
      gltfLoader.load(url, resolve, undefined, reject);
    }));
  }

  return gltfCache.get(url);
}

function loadTexture(url) {
  if (!textureCache.has(url)) {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    textureCache.set(url, texture);
  }

  return textureCache.get(url);
}

function centerModelOnGround(model) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());

  model.position.x = -center.x;
  model.position.y = -box.min.y;
  model.position.z = -center.z;
}

function frameModel(camera, model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const target = new THREE.Vector3(0, size.y * 0.48, 0);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const distanceForHeight = size.y / (2 * Math.tan(verticalFov / 2));
  const distanceForWidth = size.x / (2 * Math.tan(horizontalFov / 2));
  const distance = Math.max(distanceForHeight, distanceForWidth, size.z * 2.2) * 1.42;

  camera.position.set(distance * 0.28, size.y * 0.58, distance);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

function applyCharacterTexture(model, textureUrl) {
  const texture = loadTexture(textureUrl);

  model.traverse((node) => {
    if (!node.isMesh) return;

    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.map = texture;
      material.side = THREE.DoubleSide;
      if ('metalness' in material) material.metalness = 0;
      if ('roughness' in material) material.roughness = 0.88;
      material.needsUpdate = true;
    }
  });
}

function disposeObject(object) {
  object.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material && typeof material.dispose === 'function') material.dispose();
    }
  });
}

export function mountMenuCharacterPreview(container, { typeId = 'mage', fallbackImage = '' } = {}) {
  const modelConfig = CHARACTER_MODELS[typeId] || CHARACTER_MODELS.mage;
  const fallback = document.createElement('img');
  fallback.className = 'menu-character-preview-fallback';
  fallback.src = fallbackImage;
  fallback.alt = '';

  if (!container || !window.WebGLRenderingContext) {
    container?.append(fallback);
    return { dispose() {} };
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(1.8, 1.4, 6);
  camera.lookAt(0, 1, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'menu-character-preview-canvas';
  container.append(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0xfff6dc, 0x342817, 2.2);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffedd0, 3.2);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8cb8ff, 1.05);
  fill.position.set(-4, 2, 2);
  scene.add(fill);

  const clock = new THREE.Clock();
  let frameId = null;
  let disposed = false;
  let mixer = null;
  let model = null;

  function resize() {
    const width = Math.max(1, container.clientWidth || 1);
    const height = Math.max(1, container.clientHeight || 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (model) frameModel(camera, model);
  }

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(resize)
    : null;
  resizeObserver?.observe(container);
  resize();

  function render() {
    if (disposed) return;
    frameId = requestAnimationFrame(render);
    const delta = clock.getDelta();
    mixer?.update(delta);
    if (model) model.rotation.y += delta * 0.18;
    renderer.render(scene, camera);
  }

  Promise.all([
    loadGltf(modelConfig.modelUrl),
    loadGltf(IDLE_ANIMATION_URL),
  ]).then(([modelGltf, animationGltf]) => {
    if (disposed) return;

    model = cloneSkeleton(modelGltf.scene);
    model.scale.setScalar(0.96);
    centerModelOnGround(model);
    model.rotation.y = -0.38;
    applyCharacterTexture(model, modelConfig.textureUrl);
    scene.add(model);
    frameModel(camera, model);

    const idleClip = animationGltf.animations?.find((clip) => clip.name === 'Idle_A');
    if (idleClip) {
      mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(idleClip).play();
    }
  }).catch((error) => {
    console.error('Erro ao carregar preview 3D do personagem:', error);
    if (!disposed) container.append(fallback);
  });

  render();

  return {
    dispose() {
      disposed = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      if (model) {
        scene.remove(model);
        disposeObject(model);
      }
      renderer.dispose();
      renderer.domElement.remove();
      fallback.remove();
    },
  };
}
