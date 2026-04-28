import { GAME_MODES, STAT_META, PHASES } from '../config/game-data.js';

export function registerCanvasInput({ canvas, state, actions, layout }) {
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = event.clientX - rect.left;
    state.mouse.y = event.clientY - rect.top;
  });

  canvas.addEventListener('mousedown', () => {
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
