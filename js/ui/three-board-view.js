import * as THREE from 'three';
import { BOARD_SIZE, CARD_SOURCES, GAME_MODES } from '../config/game-data.js';

const CARD_WIDTH = 0.56;
const CARD_HEIGHT = 0.82;
const CARD_ROTATION_Y = Math.PI / 4;
const ISO_AZIMUTH = Math.PI / 4;
const ISO_ELEVATION = Math.atan(1 / Math.sqrt(2));
const ISO_CAMERA_DISTANCE = 12;
const ORTHO_VIEW_HEIGHT = 7.48;
const COMPACT_ORTHO_VIEW_HEIGHT = 8.16;
const OVERWORLD_ORTHO_VIEW_HEIGHT = 9.18;
const COMPACT_OVERWORLD_ORTHO_VIEW_HEIGHT = 8.16;
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
    const top = layout.compact ? Math.max(0, layout.leftY + layout.leftH + 8) : 0;
    const x = layout.compact ? 0 : layout.sidebarW;
    const y = top;
    const right = layout.sw;
    const bottom = layout.sh;

    return {
      x,
      y,
      w: Math.max(1, right - x),
      h: Math.max(1, bottom - y),
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

  const textureLoader = new THREE.TextureLoader();
  const textureCache = new Map();

  function textureFor(src) {
    if (!src) return null;
    if (textureCache.has(src)) return textureCache.get(src);

    const texture = textureLoader.load(src);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    textureCache.set(src, texture);
    return texture;
  }

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: colorFromHex('#111827'),
    roughness: 0.82,
    metalness: 0.08,
  });

  const wallSideTexture = textureFor('./assets/grama-lado.png');
  const wallTopTexture = textureFor('./assets/grama-topo.png');

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
    color: colorFromHex('#64748b'),
    roughness: 0.78,
    metalness: 0.06,
  });

  const groundMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    metalness: 0.05,
    map: textureFor('./assets/chao1.png'),
  });

  const wallMeshes = new Map();
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

  function syncCamera(layout, now) {
    const mode = state.game.mode || GAME_MODES.DUNGEON_LEGACY;
    const viewport = boardViewport(layout, mode);
    const aspect = viewport.w / viewport.h;
    const isOverworld = mode === GAME_MODES.OVERWORLD;
    const baseViewHeight = isOverworld
      ? (layout.compact ? COMPACT_OVERWORLD_ORTHO_VIEW_HEIGHT : OVERWORLD_ORTHO_VIEW_HEIGHT)
      : (layout.compact ? COMPACT_ORTHO_VIEW_HEIGHT : ORTHO_VIEW_HEIGHT);
    const viewHeight = baseViewHeight / (state.debugZoom || 1.0);
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

    if (currentBoard.width === width && currentBoard.height === height && currentBoard.hasGround === hasGround) {
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
    let group = unitMeshes.get(entityId);
    if (!group) {
      group = createUnitMesh(unit, isPlayer);
      unitMeshes.set(entityId, group);
    }

    const animations = state.game.animations || [];
    const { drawX, drawY } = movementPosition(unit, entityId, animations, now);
    const bump = bumpOffset(unit, entityId, animations, now);
    const center = tileCenter(drawX, drawY, currentBoard.width, currentBoard.height);
    group.position.set(center.x + bump.x, 0.02, center.z + bump.z);

    group.userData.frameMaterial.color.set(
      isFlashing(entityId, animations, now) ? '#ef4444' : group.userData.tint,
    );
  }

  function updateUnits(now) {
    const desiredIds = new Set(['player']);
    updateUnit(state.game.player, 'player', true, now);

    const units = state.game.mode === GAME_MODES.OVERWORLD
      ? (state.game.overworld?.enemies || [])
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
      hoverTile,
      hoverPath,
      reachable,
      playerAttackTiles,
      monsterReachable,
      monsterAttackTiles,
      now,
    }) {
      syncBoardGeometry(boardWidth, boardHeight);
      syncRendererSize(currentLayout);
      const viewport = syncCamera(currentLayout, now);
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
