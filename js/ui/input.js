import { BOARD_SIZE, GAME_MODES, STAT_META, PHASES, DEBUG_CONFIG } from '../config/game-data.js';
import { getOverworldWaterEnabled } from '../config/visual-settings.js';
import { getCurrentWorldBounds } from '../game/world-state.js';

const TEXTURE_OUTSIDE_BOARD_MULTIPLIER = 2;
const MODEL_OUTSIDE_BOARD_PADDING = 18;
const DEBUG_MODEL_LOWER_FLOOR_Y = -0.62;
const ACTION_SLOT_KEY_CODES = new Map([
  ['Digit1', 0],
  ['Digit2', 1],
  ['Digit3', 2],
  ['Digit4', 3],
  ['Digit5', 4],
  ['Digit6', 5],
  ['Numpad1', 0],
  ['Numpad2', 1],
  ['Numpad3', 2],
  ['Numpad4', 3],
  ['Numpad5', 4],
  ['Numpad6', 5],
]);

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
}

export function registerCanvasInput({ canvas, state, actions, layout }) {
  function syncMouseFromEvent(event) {
    if (!event) return;
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = event.clientX - rect.left;
    state.mouse.y = event.clientY - rect.top;
  }

  function ensureDebugCubes() {
    if (!state.debugCubes) state.debugCubes = {};
    const debugCubes = state.debugCubes;
    if (!Array.isArray(debugCubes.placements)) debugCubes.placements = [];
    if (debugCubes.enabled === undefined) debugCubes.enabled = false;
    if (debugCubes.selectedCubeId === undefined) debugCubes.selectedCubeId = null;
    return debugCubes;
  }

  function pointInDebugPanel() {
    return (
      state.debugPanelOpen &&
      state.debugPanelBounds &&
      layout.pointInRect(state.mouse.x, state.mouse.y, state.debugPanelBounds)
    );
  }

  function currentDebugBounds() {
    if (state.game.mode === GAME_MODES.OVERWORLD) {
      return getCurrentWorldBounds(state.game.overworld);
    }
    return { width: BOARD_SIZE, height: BOARD_SIZE };
  }

  function currentDebugMapId() {
    if (state.game.mode === GAME_MODES.OVERWORLD) {
      return state.game.overworld?.currentMapId || null;
    }
    return `combat:${state.game.levelIndex ?? 0}`;
  }

  function tileCenterFromPoint(point) {
    const bounds = currentDebugBounds();
    const minX = -bounds.width * TEXTURE_OUTSIDE_BOARD_MULTIPLIER;
    const maxX = bounds.width * (TEXTURE_OUTSIDE_BOARD_MULTIPLIER + 1) - 1;
    const minY = -bounds.height * TEXTURE_OUTSIDE_BOARD_MULTIPLIER;
    const maxY = bounds.height * (TEXTURE_OUTSIDE_BOARD_MULTIPLIER + 1) - 1;
    const tileX = Math.round(Math.min(maxX, Math.max(minX, point.x)));
    const tileY = Math.round(Math.min(maxY, Math.max(minY, point.y)));

    return {
      x: tileX - bounds.width / 2 + 0.5,
      z: tileY - bounds.height / 2 + 0.5,
    };
  }

  function modelCenterFromPoint(point) {
    const bounds = currentDebugBounds();
    const minX = -MODEL_OUTSIDE_BOARD_PADDING;
    const maxX = bounds.width + MODEL_OUTSIDE_BOARD_PADDING - 1;
    const minY = -MODEL_OUTSIDE_BOARD_PADDING;
    const maxY = bounds.height + MODEL_OUTSIDE_BOARD_PADDING - 1;
    const tileX = Math.round(Math.min(maxX, Math.max(minX, point.x)));
    const tileY = Math.round(Math.min(maxY, Math.max(minY, point.y)));

    return {
      x: tileX - bounds.width / 2 + 0.5,
      z: tileY - bounds.height / 2 + 0.5,
      outsideStage: tileX < 0 || tileY < 0 || tileX >= bounds.width || tileY >= bounds.height,
    };
  }

  function moveSelectedDebugPlacement(mouseX, mouseY) {
    const editor = state.debugEditor;
    const placement = editor?.placements?.find((item) => item.id === editor.selectedPlacementId);
    const upperPoint = state.boardInteraction?.worldPointAtAny?.(layout.getLayout(), mouseX, mouseY);
    const lowerPoint = placement?.kind === 'texture'
      ? null
      : state.boardInteraction?.worldPointAtLower?.(layout.getLayout(), mouseX, mouseY);
    const upperCenter = upperPoint ? modelCenterFromPoint(upperPoint) : null;
    const point = placement?.kind === 'texture'
      ? upperPoint
      : (upperCenter && !upperCenter.outsideStage ? upperPoint : lowerPoint || upperPoint);
    if (!placement || !point) return false;

    placement.position = placement.position || { x: 0, y: 0, z: 0 };
    if (placement.kind === 'texture') {
      const center = tileCenterFromPoint(point);
      placement.position.x = center.x;
      placement.position.z = center.z;
    } else {
      const center = modelCenterFromPoint(point);
      placement.position.x = center.x;
      placement.position.z = center.z;
      if (placement.position.y === 0 && center.outsideStage) {
        placement.position.y = DEBUG_MODEL_LOWER_FLOOR_Y;
      } else if (placement.position.y === DEBUG_MODEL_LOWER_FLOOR_Y && !center.outsideStage) {
        placement.position.y = 0;
      }
    }
    return true;
  }

  function placeDebugCube(mouseX, mouseY) {
    const debugCubes = ensureDebugCubes();
    if (!debugCubes.enabled || pointInDebugPanel() || state.game.menuOpen) return false;

    const mapId = currentDebugMapId();
    const tile = layout.tileAt(layout.getLayout(), mouseX, mouseY);
    if (!mapId || !tile) return false;

    const sameTile = debugCubes.placements.filter((cube) => {
      return cube.mapId === mapId && cube.x === tile.x && cube.y === tile.y;
    });
    const level = sameTile.reduce((highest, cube) => Math.max(highest, cube.level ?? 0), -1) + 1;
    const cube = {
      id: `debug-cube-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      mapId,
      x: tile.x,
      y: tile.y,
      level,
    };

    debugCubes.placements.push(cube);
    debugCubes.selectedCubeId = cube.id;
    return true;
  }

  function handleMouseMove(event) {
    syncMouseFromEvent(event);

    if (state.game.draggingControl) {
      state.game.draggingControl.onDrag?.(state.mouse.x, state.mouse.y);
    }
  }
 
  function handleWheel(event) {
    if (!DEBUG_CONFIG.SHOW_STATS) return;
    if (
      state.debugPanelOpen &&
      state.debugPanelTab === 'editor' &&
      state.debugEditorTreeBounds &&
      layout.pointInRect(state.mouse.x, state.mouse.y, state.debugEditorTreeBounds)
    ) {
      event.preventDefault();
      const editor = state.debugEditor;
      editor.treeScroll = Math.max(0, (editor.treeScroll || 0) + event.deltaY * 0.65);
      return;
    }
    if (
      state.debugPanelOpen &&
      state.debugPanelTab === 'editor' &&
      state.debugEditorSceneBounds &&
      layout.pointInRect(state.mouse.x, state.mouse.y, state.debugEditorSceneBounds)
    ) {
      event.preventDefault();
      const editor = state.debugEditor;
      editor.sceneScroll = Math.max(0, (editor.sceneScroll || 0) + event.deltaY * 0.65);
      return;
    }
    if (
      state.debugPanelOpen &&
      state.debugPanelTab === 'cube' &&
      state.debugCubeListBounds &&
      layout.pointInRect(state.mouse.x, state.mouse.y, state.debugCubeListBounds)
    ) {
      event.preventDefault();
      const debugCubes = ensureDebugCubes();
      debugCubes.listScroll = Math.max(0, (debugCubes.listScroll || 0) + event.deltaY * 0.65);
      return;
    }
    if (
      state.debugPanelOpen &&
      state.debugPanelTab === 'color' &&
      state.debugColorListBounds &&
      layout.pointInRect(state.mouse.x, state.mouse.y, state.debugColorListBounds)
    ) {
      event.preventDefault();
      const debugColors = state.debugColors;
      if (debugColors) debugColors.scroll = Math.max(0, (debugColors.scroll || 0) + event.deltaY * 0.65);
      return;
    }

    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.92 : 1.08;
    state.debugZoom = Math.min(8.0, Math.max(0.2, (state.debugZoom || 1.15) * delta));
  }

  function handleMouseDown(event) {
    syncMouseFromEvent(event);

    for (let index = state.game.buttons.length - 1; index >= 0; index -= 1) {
      const button = state.game.buttons[index];
      if (!layout.pointInRect(state.mouse.x, state.mouse.y, button)) continue;
      if (button.onDrag || button.onDragStart) {
        state.game.draggingControl = button;
        button.onDragStart?.(state.mouse.x, state.mouse.y);
      }
      return;
    }

    if (state.game.cutscene) return;

    if (state.game.activeModal) return;

    if (
      DEBUG_CONFIG.SHOW_STATS &&
      state.debugPanelOpen &&
      state.debugPanelTab === 'editor' &&
      !pointInDebugPanel() &&
      state.debugEditor?.selectedPlacementId &&
      moveSelectedDebugPlacement(state.mouse.x, state.mouse.y)
    ) {
      state.game.draggingControl = {
        onDrag: moveSelectedDebugPlacement,
      };
      return;
    }

    if (state.game.phase !== PHASES.ENERGY || state.game.busy) return;

    for (let index = state.game.diceRects.length - 1; index >= 0; index -= 1) {
      const rect = state.game.diceRects[index];
      if (!layout.pointInRect(state.mouse.x, state.mouse.y, rect)) continue;

      state.game.draggingDie = {
        dieIndex: rect.dieIndex,
        fromStat: actions.assignedStatForDie(rect.dieIndex),
        offsetX: state.mouse.x - rect.x,
        offsetY: state.mouse.y - rect.y,
      };
      return;
    }
  }

  function handleMouseUp(event) {
    syncMouseFromEvent(event);

    if (state.game.draggingControl) {
      state.game.draggingControl.onDragEnd?.(state.mouse.x, state.mouse.y);
      state.game.draggingControl = null;
      state.suppressClick = true;
      return;
    }

    if (state.game.cutscene) return;

    if (!state.game.draggingDie) return;

    const dieIndex = state.game.draggingDie.dieIndex;
    const fromStat = state.game.draggingDie.fromStat;
    const target = state.game.dropZones.find((zone) => {
      return layout.pointInRect(state.mouse.x, state.mouse.y, zone);
    });

    if (target) {
      const targetStat = target.stat;
      const existingDieIndex = state.game.energyAssigned[targetStat];

      for (const stat of ['speed', 'attack', 'defense']) {
        if (state.game.energyAssigned[stat] === dieIndex) state.game.energyAssigned[stat] = null;
      }

      state.game.energyAssigned[targetStat] = dieIndex;

      if (existingDieIndex !== null && existingDieIndex !== dieIndex) {
        if (fromStat) {
          state.game.energyAssigned[fromStat] = existingDieIndex;
        }
      }

      const stats = ['speed', 'attack', 'defense'];
      const unassignedStats = stats.filter((s) => state.game.energyAssigned[s] === null);
      
      if (unassignedStats.length === 1) {
        const assignedDice = stats.map((s) => state.game.energyAssigned[s]).filter((v) => v !== null);
        const unassignedDieIndex = [0, 1, 2].find((d) => !assignedDice.includes(d));
        
        if (unassignedDieIndex !== undefined) {
          state.game.energyAssigned[unassignedStats[0]] = unassignedDieIndex;
        }
      }

      actions.setEvent(`${STAT_META[targetStat].label} recebeu o dado ${state.game.roll[dieIndex]}.`);
    }

    state.game.draggingDie = null;
    state.suppressClick = true;
  }

  function overworldMovementOptionsForTile(tile) {
    if (tile?.kind === 'connectionBridge') {
      return { activateConnection: true };
    }

    const mapId = state.game.overworld?.currentMapId || null;
    const runtimeValues = mapId ? state.game.overworld?.mapStates?.[mapId]?.debugVisualSettings?.values : null;
    const hasWaterSetting = !!state.visuals || typeof runtimeValues?.overworldWater === 'boolean';
    if (hasWaterSetting && getOverworldWaterEnabled({ mapId, baseValues: state.visuals, runtimeValues })) {
      return { activateConnection: false };
    }

    return undefined;
  }

  function handleClick(event) {
    syncMouseFromEvent(event);

    if (state.suppressClick) {
      state.suppressClick = false;
      return;
    }

    for (let index = state.game.buttons.length - 1; index >= 0; index -= 1) {
      const button = state.game.buttons[index];
      if (!layout.pointInRect(state.mouse.x, state.mouse.y, button)) continue;
      button.onClick();
      return;
    }

    if (state.game.cutscene) {
      actions.advanceCutscene?.();
      return;
    }

    if (state.game.activeModal) return;

    if (state.game.menuOpen) {
      state.game.menuOpen = false;
      state.game.menuView = 'main';
      return;
    }

    if (DEBUG_CONFIG.SHOW_STATS && ensureDebugCubes().enabled) {
      if (placeDebugCube(state.mouse.x, state.mouse.y)) return;
    }

    if (state.game.phase === PHASES.ENERGY) return;
    if (state.game.busy) return;

    const currentLayout = layout.getLayout();
    const tile = layout.tileAt(currentLayout, state.mouse.x, state.mouse.y);
    
    if (!tile) {
      state.game.selectedEntity = null;
      state.game.selectedAttackId = null;
      return;
    }

    if (state.game.mode === GAME_MODES.OVERWORLD) {
      const enemy = actions.getOverworldEnemyAt(tile);
      const isPlayer = state.game.player.x === tile.x && state.game.player.y === tile.y;

      if (enemy) {
        actions.startOverworldEncounter(enemy.id);
      } else if (!isPlayer || tile.kind === 'connectionBridge') {
        state.game.selectedEntity = null;
        const movementOptions = overworldMovementOptionsForTile(tile);
        if (movementOptions) {
          actions.moveOverworldPlayer(tile, movementOptions);
        } else {
          actions.moveOverworldPlayer(tile);
        }
      }
      return;
    }

    const monster = state.game.monsters.find((currentMonster) => {
      return currentMonster.x === tile.x && currentMonster.y === tile.y;
    });
    
    const isPlayer = state.game.player.x === tile.x && state.game.player.y === tile.y;

    if (state.game.selectedAttackId) {
      actions.attackTile(tile);
      return;
    }

    if (monster) {
      actions.attackMonster(monster.id);
      return;
    } else if (isPlayer) {
      return;
    } else {
      state.game.selectedEntity = null;
      actions.movePlayer(tile);
    }
  }

  function handleKeyDown(event) {
    if (event.repeat || isTypingTarget(event.target)) return;
    if (state.game.cutscene) {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        actions.advanceCutscene?.();
      }
      return;
    }
    if (state.game.activeModal || state.game.menuOpen) return;

    const slotIndex = ACTION_SLOT_KEY_CODES.get(event.code);
    if (slotIndex !== undefined) {
      const attacks = actions.getAvailableAttacks?.(state.game) || [];
      const attack = attacks[slotIndex];
      if (!attack) return;

      event.preventDefault();
      actions.toggleAttackSelection?.(attack.id);
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      actions.endHeroPhase?.();
    }
  }

  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('click', handleClick);
  window.addEventListener('keydown', handleKeyDown);

  return () => {
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('wheel', handleWheel);
    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('mouseup', handleMouseUp);
    canvas.removeEventListener('click', handleClick);
    window.removeEventListener('keydown', handleKeyDown);
  };
}
