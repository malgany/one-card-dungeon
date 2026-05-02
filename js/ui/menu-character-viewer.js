import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { getCharacterDefinition } from '../config/character-palettes.js';
import { configureCharacterTexture, loadCharacterPaletteTexture } from './character-palette-texture.js';

const IDLE_ANIMATION_URL = '/assets/models/adventurers/animations/rig-medium/general.glb';
const PREVIEW_MODEL_HEIGHT = 3.15;
const PREVIEW_MODEL_GROUND_OFFSET = -0.32;
const PREVIEW_CAMERA_TARGET_Y = 1.24;
const PREVIEW_CAMERA_MIN_DISTANCE = 6.9;
const PREVIEW_MODEL_FRONT_ROTATION = 0;
const PREVIEW_DRAG_ROTATION_SPEED = 0.01;
const PREVIEW_SLOT_FLASH_STEP_DURATION = 160;
const PREVIEW_SLOT_FLASH_COLORS = ['#FF4FD8', '#FFFFFF', '#FFD84D', '#050505', '#FF4FD8'];

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
    configureCharacterTexture(texture);
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

function normalizeModelForPreview(model) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(PREVIEW_MODEL_HEIGHT / height);
  model.updateMatrixWorld(true);
  centerModelOnGround(model);
  model.position.y += PREVIEW_MODEL_GROUND_OFFSET;
  model.updateMatrixWorld(true);
}

function frameModel(camera, model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const target = new THREE.Vector3(0, PREVIEW_CAMERA_TARGET_Y, 0);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const distanceForHeight = size.y / (2 * Math.tan(verticalFov / 2));
  const distanceForWidth = size.x / (2 * Math.tan(horizontalFov / 2));
  const distance = Math.max(
    PREVIEW_CAMERA_MIN_DISTANCE,
    distanceForHeight * 1.08,
    distanceForWidth * 1.08,
    size.z * 2.3,
  );

  camera.position.set(0, PREVIEW_CAMERA_TARGET_Y + 0.18, distance);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

async function textureForPalette(typeId, textureUrl, palette, slotOverrides = null) {
  return await loadCharacterPaletteTexture({ typeId, textureUrl, palette, slotOverrides })
    || loadTexture(textureUrl);
}

function applyTextureToModel(model, texture) {
  if (!model || !texture) return;

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

export function mountMenuCharacterPreview(container, { typeId = 'mage', fallbackImage = '', palette = null } = {}) {
  const modelConfig = getCharacterDefinition(typeId);
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
  let activePalette = palette;
  let textureRequestId = 0;
  let flashTimer = null;
  let draggingPointerId = null;
  let lastPointerX = 0;

  function endDrag(pointerId) {
    if (draggingPointerId !== pointerId) return;

    renderer.domElement.releasePointerCapture?.(pointerId);
    draggingPointerId = null;
    renderer.domElement.classList.remove('is-dragging');
  }

  function handlePointerDown(event) {
    if (!model || event.button !== 0) return;

    draggingPointerId = event.pointerId;
    lastPointerX = event.clientX;
    renderer.domElement.setPointerCapture?.(event.pointerId);
    renderer.domElement.classList.add('is-dragging');
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!model || draggingPointerId !== event.pointerId) return;

    const deltaX = event.clientX - lastPointerX;
    lastPointerX = event.clientX;
    model.rotation.y += deltaX * PREVIEW_DRAG_ROTATION_SPEED;
    event.preventDefault();
  }

  function handlePointerUp(event) {
    endDrag(event.pointerId);
  }

  function handlePointerCancel(event) {
    endDrag(event.pointerId);
  }

  renderer.domElement.addEventListener('pointerdown', handlePointerDown);
  renderer.domElement.addEventListener('pointermove', handlePointerMove);
  renderer.domElement.addEventListener('pointerup', handlePointerUp);
  renderer.domElement.addEventListener('pointercancel', handlePointerCancel);

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
    renderer.render(scene, camera);
  }

  async function applyTextureRequest(slotOverrides = null, requestId = ++textureRequestId) {
    try {
      const texture = await textureForPalette(modelConfig.id, modelConfig.textureUrl, activePalette, slotOverrides);
      if (!disposed && requestId === textureRequestId) {
        applyTextureToModel(model, texture);
        return true;
      }
    } catch (error) {
      console.error('Erro ao aplicar paleta do personagem:', error);
    }

    return false;
  }

  async function applyActiveTexture(slotOverrides = null) {
    return applyTextureRequest(slotOverrides);
  }

  function clearFlashTimer() {
    if (flashTimer === null) return;
    clearTimeout(flashTimer.id);
    flashTimer.resolve();
    flashTimer = null;
  }

  function waitForFlashStep() {
    return new Promise((resolve) => {
      clearFlashTimer();
      const id = setTimeout(() => {
        flashTimer = null;
        resolve();
      }, PREVIEW_SLOT_FLASH_STEP_DURATION);
      flashTimer = { id, resolve };
    });
  }

  async function runSlotFlash(slotIds, requestId) {
    for (const color of PREVIEW_SLOT_FLASH_COLORS) {
      if (disposed || requestId !== textureRequestId) return;

      const slotOverrides = Object.fromEntries(slotIds.map((slotId) => [slotId, color]));
      await applyTextureRequest(slotOverrides, requestId);
      if (disposed || requestId !== textureRequestId) return;

      await waitForFlashStep();
    }

    if (model && requestId === textureRequestId) applyActiveTexture();
  }

  Promise.all([
    loadGltf(modelConfig.modelUrl),
    loadGltf(IDLE_ANIMATION_URL),
  ]).then(async ([modelGltf, animationGltf]) => {
    if (disposed) return;

    model = cloneSkeleton(modelGltf.scene);
    normalizeModelForPreview(model);
    model.rotation.y = PREVIEW_MODEL_FRONT_ROTATION;
    await applyActiveTexture();
    if (disposed) return;

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
    updatePalette(nextPalette) {
      activePalette = nextPalette;
      clearFlashTimer();
      if (model) applyActiveTexture();
    },
    flashPaletteSlot(slotIdOrSlots) {
      const slotIds = Array.isArray(slotIdOrSlots) ? slotIdOrSlots : [slotIdOrSlots];
      if (!model || slotIds.length === 0 || !slotIds[0]) return;

      clearFlashTimer();
      const requestId = ++textureRequestId;
      runSlotFlash(slotIds, requestId);
    },
    dispose() {
      disposed = true;
      clearFlashTimer();
      if (frameId !== null) cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      if (model) {
        scene.remove(model);
        disposeObject(model);
      }
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel);
      renderer.dispose();
      renderer.domElement.remove();
      fallback.remove();
    },
  };
}
