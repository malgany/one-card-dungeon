import { BOARD_SIZE, GAME_MODES, STAT_META, PHASES, DEBUG_CONFIG } from '../config/game-data.js';
import { getCurrentWorldBounds } from '../game/world-state.js';

const TEXTURE_OUTSIDE_BOARD_MULTIPLIER = 2;

export function registerCanvasInput({ canvas, state, actions, layout }) {
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

  function moveSelectedDebugPlacement(mouseX, mouseY) {
    const editor = state.debugEditor;
    const placement = editor?.placements?.find((item) => item.id === editor.selectedPlacementId);
    const point = placement?.kind === 'texture'
      ? state.boardInteraction?.worldPointAtAny?.(layout.getLayout(), mouseX, mouseY)
      : state.boardInteraction?.worldPointAt?.(layout.getLayout(), mouseX, mouseY);
    if (!placement || !point) return false;

    placement.position = placement.position || { x: 0, y: 0, z: 0 };
    if (placement.kind === 'texture') {
      const center = tileCenterFromPoint(point);
      placement.position.x = center.x;
      placement.position.z = center.z;
    } else {
      placement.position.x = point.worldX;
      placement.position.z = point.worldZ;
    }
    return true;
  }

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = event.clientX - rect.left;
    state.mouse.y = event.clientY - rect.top;

    if (state.game.draggingControl) {
      state.game.draggingControl.onDrag?.(state.mouse.x, state.mouse.y);
    }
  });
 
  canvas.addEventListener('wheel', (event) => {
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

    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.92 : 1.08;
    state.debugZoom = Math.min(8.0, Math.max(0.2, (state.debugZoom || 1.15) * delta));
  }, { passive: false });

  canvas.addEventListener('mousedown', () => {
    for (let index = state.game.buttons.length - 1; index >= 0; index -= 1) {
      const button = state.game.buttons[index];
      if (!layout.pointInRect(state.mouse.x, state.mouse.y, button)) continue;
      if (button.onDrag || button.onDragStart) {
        state.game.draggingControl = button;
        button.onDragStart?.(state.mouse.x, state.mouse.y);
      }
      return;
    }

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
  });

  canvas.addEventListener('mouseup', () => {
    if (state.game.draggingControl) {
      state.game.draggingControl.onDragEnd?.(state.mouse.x, state.mouse.y);
      state.game.draggingControl = null;
      state.suppressClick = true;
      return;
    }

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
  });

  canvas.addEventListener('click', () => {
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

    if (state.game.menuOpen) {
      state.game.menuOpen = false;
      state.game.menuView = 'main';
      return;
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
      } else if (!isPlayer) {
        state.game.selectedEntity = null;
        actions.moveOverworldPlayer(tile);
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
  });
}
