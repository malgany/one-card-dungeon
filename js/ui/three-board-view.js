import * as THREE from 'three';
import { BOARD_SIZE, CARD_SOURCES } from '../config/game-data.js';

const BOARD_HALF = BOARD_SIZE / 2;
const CARD_WIDTH = 0.56;
const CARD_HEIGHT = 0.82;
const CARD_ROTATION_Y = Math.PI / 4;
const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.atan(1 / Math.sqrt(2));
const ISO_CAMERA_DISTANCE = 12;
const ORTHO_VIEW_HEIGHT = 8.8;
const COMPACT_ORTHO_VIEW_HEIGHT = 9.6;
const FLOOR_COLORS = ['#3b3126', '#2f271f'];
const HIGHLIGHT_ORDER = [
  'hover',
  'playerAttack',
  'monsterAttack',
  'move',
  'monsterMove',
];
const HIGHLIGHT_COLORS = {
  hover: { color: '#f8fafc', opacity: 0.2 },
  move: { color: '#22d3ee', opacity: 0.28 },
  playerAttack: { color: '#f472b6', opacity: 0.3 },
  monsterMove: { color: '#22c55e', opacity: 0.22 },
  monsterAttack: { color: '#ef4444', opacity: 0.28 },
};

function colorFromHex(hex, fallback = '#64748b') {
  return new THREE.Color(hex || fallback);
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function tileCenter(x, y) {
  return {
    x: x - BOARD_HALF + 0.5,
    z: y - BOARD_HALF + 0.5,
  };
}

function setIsometricCameraPosition(camera) {
  const horizontalDistance = ISO_CAMERA_DISTANCE * Math.cos(ISO_ELEVATION);

  camera.position.set(
    horizontalDistance * Math.sin(ISO_AZIMUTH),
    ISO_CAMERA_DISTANCE * Math.sin(ISO_ELEVATION),
    horizontalDistance * Math.cos(ISO_AZIMUTH),
  );
  camera.lookAt(0, 0, 0);
}

function boardViewport(layout) {
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
  return CARD_SOURCES[isPlayer ? 'player' : unit.type] || null;
}

function movementPosition(unit, entityId, animations, now) {
  let drawX = unit.x;
  let drawY = unit.y;

  const movement = animations.find((animation) => {
    return animation.type === 'movement' && animation.entityId === entityId;
  });

  if (movement) {
    const elapsed = now - movement.startTime;
    if (elapsed >= 0) {
      const tileIndex = Math.floor(elapsed / movement.durationPerTile);
      const tileProgress = (elapsed % movement.durationPerTile) / movement.durationPerTile;

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
  const scene = new THREE.Scene();
  scene.background = colorFromHex('#07090f');

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  setIsometricCameraPosition(camera);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(colorFromHex('#07090f'), 1);
  renderer.domElement.className = 'board-webgl';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.tabIndex = -1;
  document.body.prepend(renderer.domElement);

  const boardGroup = new THREE.Group();
  scene.add(boardGroup);

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#111827'),
    roughness: 0.82,
    metalness: 0.08,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.55, 0.18, 6.55), baseMaterial);
  base.position.y = -0.13;
  base.receiveShadow = true;
  boardGroup.add(base);

  const tileGeometry = new THREE.BoxGeometry(0.94, 0.08, 0.94);

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: colorFromHex(FLOOR_COLORS[(x + y) % FLOOR_COLORS.length]),
        roughness: 0.92,
        metalness: 0.02,
      });
      const tile = new THREE.Mesh(tileGeometry, material);
      const center = tileCenter(x, y);
      tile.position.set(center.x, 0, center.z);
      tile.receiveShadow = true;
      boardGroup.add(tile);
    }
  }

  const highlights = new Map();
  const highlightGeometry = new THREE.PlaneGeometry(0.86, 0.86);

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: colorFromHex('#ffffff'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const highlight = new THREE.Mesh(highlightGeometry, material);
      const center = tileCenter(x, y);
      highlight.position.set(center.x, 0.055, center.z);
      highlight.rotation.x = -Math.PI / 2;
      highlight.visible = false;
      highlights.set(keyFor(x, y), highlight);
      boardGroup.add(highlight);
    }
  }

  const wallMeshes = new Map();
  const wallGeometry = new THREE.BoxGeometry(0.9, 0.54, 0.9);
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#64748b'),
    roughness: 0.78,
    metalness: 0.06,
  });

  const textureLoader = new THREE.TextureLoader();
  const textureCache = new Map();
  const unitMeshes = new Map();
  const pathArrowGroup = new THREE.Group();
  scene.add(pathArrowGroup);

  const hemisphere = new THREE.HemisphereLight(colorFromHex('#dbeafe'), colorFromHex('#25170f'), 1.05);
  scene.add(hemisphere);

  const keyLight = new THREE.DirectionalLight(colorFromHex('#fff7ed'), 1.75);
  keyLight.position.set(2.8, 6.2, 4.8);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(colorFromHex('#7dd3fc'), 0.86);
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

  function syncCamera(layout) {
    const viewport = boardViewport(layout);
    const aspect = viewport.w / viewport.h;
    const viewHeight = layout.compact ? COMPACT_ORTHO_VIEW_HEIGHT : ORTHO_VIEW_HEIGHT;
    const viewWidth = viewHeight * aspect;

    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    setIsometricCameraPosition(camera);
    camera.updateProjectionMatrix();
    return viewport;
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

  function createUnitMesh(unit, isPlayer) {
    const group = new THREE.Group();
    const tint = isPlayer ? '#047857' : unit.tint;
    const source = imageSourceForUnit(unit, isPlayer);
    const texture = textureFor(source);
    group.rotation.y = CARD_ROTATION_Y;

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 32),
      new THREE.MeshBasicMaterial({
        color: colorFromHex('#000000'),
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.065;
    shadow.scale.y = 0.62;
    group.add(shadow);

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
      tint,
    };

    scene.add(group);
    return group;
  }

  function updateWalls(walls) {
    const active = new Set(walls);

    for (const wallKey of active) {
      if (wallMeshes.has(wallKey)) continue;
      const [x, y] = wallKey.split(',').map(Number);
      const center = tileCenter(x, y);
      const wall = new THREE.Mesh(wallGeometry, wallMaterial);
      wall.position.set(center.x, 0.31, center.z);
      wallMeshes.set(wallKey, wall);
      boardGroup.add(wall);
    }

    for (const [wallKey, wall] of wallMeshes.entries()) {
      if (active.has(wallKey)) continue;
      boardGroup.remove(wall);
      wallMeshes.delete(wallKey);
    }
  }

  function updateHighlights({
    hoverTile,
    reachable,
    playerAttackTiles,
    monsterReachable,
    monsterAttackTiles,
  }) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const tileKey = keyFor(x, y);
        const flags = {
          hover: hoverTile && hoverTile.x === x && hoverTile.y === y,
          move: reachable.has(tileKey),
          playerAttack: playerAttackTiles.has(tileKey),
          monsterMove: monsterReachable.has(tileKey),
          monsterAttack: monsterAttackTiles.has(tileKey),
        };
        const type = HIGHLIGHT_ORDER.find((name) => flags[name]);
        const mesh = highlights.get(tileKey);

        if (!type) {
          mesh.visible = false;
          continue;
        }

        const style = HIGHLIGHT_COLORS[type];
        mesh.visible = true;
        mesh.material.color.set(style.color);
        mesh.material.opacity = style.opacity;
      }
    }
  }

  function clearPathArrows() {
    while (pathArrowGroup.children.length > 0) {
      pathArrowGroup.remove(pathArrowGroup.children[0]);
    }
  }

  function updatePathArrows(path) {
    clearPathArrows();
    if (!Array.isArray(path) || path.length < 2) return;

    for (let index = 0; index < path.length - 1; index += 1) {
      const from = tileCenter(path[index].x, path[index].y);
      const to = tileCenter(path[index + 1].x, path[index + 1].y);
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
    let group = unitMeshes.get(entityId);
    if (!group) {
      group = createUnitMesh(unit, isPlayer);
      unitMeshes.set(entityId, group);
    }

    const animations = state.game.animations || [];
    const { drawX, drawY } = movementPosition(unit, entityId, animations, now);
    const bump = bumpOffset(unit, entityId, animations, now);
    const center = tileCenter(drawX, drawY);
    group.position.set(center.x + bump.x, 0.02, center.z + bump.z);

    group.userData.frameMaterial.color.set(
      isFlashing(entityId, animations, now) ? '#ef4444' : group.userData.tint,
    );
  }

  function updateUnits(now) {
    const desiredIds = new Set(['player']);
    updateUnit(state.game.player, 'player', true, now);

    for (const monster of state.game.monsters) {
      if (monster.hp <= 0) continue;
      desiredIds.add(monster.id);
      updateUnit(monster, monster.id, false, now);
    }

    for (const [entityId, mesh] of unitMeshes.entries()) {
      if (desiredIds.has(entityId)) continue;
      scene.remove(mesh);
      unitMeshes.delete(entityId);
    }
  }

  function tileAt(layout, px, py) {
    const viewport = syncCamera(layout);

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

    const x = Math.floor(rayHit.x + BOARD_HALF);
    const y = Math.floor(rayHit.z + BOARD_HALF);

    if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return null;
    return { x, y };
  }

  state.boardInteraction = {
    tileAt,
  };

  return {
    getViewport: boardViewport,
    screenPositionForTile(layout, x, y, height = 0.95) {
      const viewport = syncCamera(layout);
      const center = tileCenter(x, y);
      const projected = new THREE.Vector3(center.x, height, center.z).project(camera);

      return {
        x: viewport.x + ((projected.x + 1) / 2) * viewport.w,
        y: viewport.y + ((-projected.y + 1) / 2) * viewport.h,
      };
    },
    render({
      currentLayout,
      walls,
      hoverTile,
      hoverPath,
      reachable,
      playerAttackTiles,
      monsterReachable,
      monsterAttackTiles,
      now,
    }) {
      syncRendererSize(currentLayout);
      const viewport = syncCamera(currentLayout);
      updateWalls(walls);
      updateHighlights({
        hoverTile,
        reachable,
        playerAttackTiles,
        monsterReachable,
        monsterAttackTiles,
      });
      updatePathArrows(hoverPath);
      updateUnits(now);

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
