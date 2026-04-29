import { BOARD_SIZE, DEBUG_CONFIG, GAME_MODES, LEVELS, PHASES, STAT_META } from '../config/game-data.js';
import { levelWallsSet, posKey, samePos } from '../game/board-logic.js';
import {
  getCurrentWorldBounds,
  getCurrentWorldMap,
  getCurrentWorldMapState,
  getCurrentWorldObjects,
} from '../game/world-state.js';
import { createDrawPrimitives } from './draw-primitives.js';
import { createThreeBoardView } from './three-board-view.js';

export function getAnimationEndTime(anim) {
  const startTime = Number.isFinite(anim.startTime) ? anim.startTime : 0;

  if (anim.type === 'movement') {
    if (Number.isFinite(anim.totalDuration)) {
      return startTime + Math.max(0, anim.totalDuration);
    }

    const pathSteps = Math.max(0, (anim.path?.length || 1) - 1);
    const durationPerTile = Number.isFinite(anim.durationPerTile) ? anim.durationPerTile : 0;
    return startTime + pathSteps * durationPerTile;
  }

  if (anim.type === 'floatingText' || anim.type === 'bumpAttack' || anim.type === 'damageShake') {
    return startTime + Math.max(0, anim.duration || 0);
  }

  return startTime;
}

function isAnimationActive(anim, now) {
  return now < getAnimationEndTime(anim);
}

export function createRenderer({ canvas, ctx, cardImages, state, actions, layout }) {
  const draw = createDrawPrimitives({ ctx, state, cardImages });
  const threeBoard = createThreeBoardView({ state });

  function clearThreeBoardViewport(currentLayout) {
    const viewport = threeBoard.getViewport(currentLayout);
    const pixelRatio = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(viewport.x, viewport.y, viewport.w, viewport.h);
    ctx.restore();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function beginHeartPath(cx, cy, size) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.36);
    ctx.bezierCurveTo(cx - size * 0.62, cy - size * 0.05, cx - size * 0.44, cy - size * 0.52, cx - size * 0.13, cy - size * 0.42);
    ctx.bezierCurveTo(cx - size * 0.02, cy - size * 0.38, cx, cy - size * 0.24, cx, cy - size * 0.12);
    ctx.bezierCurveTo(cx, cy - size * 0.24, cx + size * 0.02, cy - size * 0.38, cx + size * 0.13, cy - size * 0.42);
    ctx.bezierCurveTo(cx + size * 0.44, cy - size * 0.52, cx + size * 0.62, cy - size * 0.05, cx, cy + size * 0.36);
    ctx.closePath();
  }

  function drawHeartMeter(cx, cy, size, hp, maxHp) {
    const ratio = maxHp > 0 ? clamp(hp / maxHp, 0, 1) : 0;

    ctx.save();
    beginHeartPath(cx, cy, size);
    ctx.fillStyle = '#4b1f2d';
    ctx.fill();

    ctx.save();
    beginHeartPath(cx, cy, size);
    ctx.clip();
    const top = cy - size * 0.48;
    const height = size * 0.86;
    const fillY = top + height * (1 - ratio);
    const gradient = ctx.createLinearGradient(cx, fillY, cx, top + height);
    gradient.addColorStop(0, '#fb7185');
    gradient.addColorStop(1, '#b91c1c');
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - size * 0.62, fillY, size * 1.24, height * ratio);
    ctx.restore();

    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeStyle = '#fecdd3';
    beginHeartPath(cx, cy, size);
    ctx.stroke();

    draw.drawText(String(hp), cx, cy + size * 0.04, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.28)}px Inter, sans-serif`,
      color: '#ffffff',
    });
    ctx.restore();
  }

  function beginStarPath(cx, cy, outerRadius, innerRadius) {
    ctx.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + index * (Math.PI / 5);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawActionPointBadge(cx, cy, size, value) {
    ctx.save();
    beginStarPath(cx, cy, size * 0.52, size * 0.26);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = '#bfdbfe';
    ctx.stroke();
    draw.drawText(String(value), cx, cy + size * 0.08, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.42)}px Inter, sans-serif`,
      color: '#ffffff',
    });
    ctx.restore();
  }

  function drawMovementPointBadge(cx, cy, size, value) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.54);
    ctx.lineTo(cx + size * 0.54, cy);
    ctx.lineTo(cx, cy + size * 0.54);
    ctx.lineTo(cx - size * 0.54, cy);
    ctx.closePath();
    ctx.fillStyle = '#22c55e';
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = '#bbf7d0';
    ctx.stroke();
    draw.drawText(String(value), cx, cy + size * 0.07, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.42)}px Inter, sans-serif`,
      color: '#ffffff',
    });
    ctx.restore();
  }

  function drawClockIcon(cx, cy, radius, color = '#e2e8f0') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,23,42,0.88)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, radius * 0.16);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - radius * 0.52);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * 0.42, cy + radius * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  function drawSidebar(currentLayout) {
    const game = state.game;
    const x = currentLayout.leftX;
    const y = currentLayout.leftY;
    const w = currentLayout.leftW;
    const h = currentLayout.leftH;

    draw.roundRect(x, y, w, h, 20, '#1e2328', '#111827');
    const inOverworld = game.mode === GAME_MODES.OVERWORLD;
    const worldMap = inOverworld ? getCurrentWorldMap(game.overworld) : null;
    const worldMapState = inOverworld ? getCurrentWorldMapState(game.overworld) : null;
    
    let cy = y + 40;
    draw.drawText('ONE CARD', x + w / 2, cy, {
      align: 'center', font: 'bold 28px Inter, sans-serif', color: '#94a3b8',
    });
    cy += 30;
    draw.drawText(inOverworld ? 'WORLD' : 'DUNGEON', x + w / 2, cy, {
      align: 'center', font: 'bold 28px Inter, sans-serif', color: '#94a3b8',
    });
    
    cy += 36;
    const progressLabel = inOverworld
      ? `${worldMapState?.enemies?.length || 0} inimigos em ${worldMap?.name || 'mapa'}`
      : `Nível ${LEVELS[game.levelIndex].id}/12 • Vez ${game.turnCount}`;
    draw.drawText(progressLabel, x + w / 2, cy, {
      align: 'center', font: 'bold 18px Inter, sans-serif', color: '#facc15',
    });

    const phaseName = inOverworld
      ? 'MAPA ABERTO'
      : {
          energy: 'ENERGIA',
          hero: 'AVENTUREIRO',
          monsterTurn: 'MONSTROS',
          monsterMove: 'MONSTROS',
          monsterAttack: 'ATAQUE INIMIGO',
          levelup: 'RECOMPENSA',
          won: 'VITÓRIA',
          lost: 'DERROTA',
        }[game.phase];

    cy += 36;
    draw.drawText(phaseName, x + w / 2, cy, {
      align: 'center', font: 'bold 22px Inter, sans-serif', color: '#38bdf8',
    });

    cy += 16;
    const totals = actions.getTotals();
    const topMargin = 90;
    const availableW = w - 32;
    const barW = w - 32;
    const barH = 40;
    const barX = x + 16;
    draw.roundRect(barX, cy, barW, barH, 8, 'rgba(15,23,42,0.95)', '#334155');
    
    const statItemW = barW / 5;
    const statsArray = [
      { icon: '⚡', val: game.apRemaining ?? totals.ap, color: '#facc15' },
      { icon: '🏃', val: game.speedRemaining ?? totals.speed, color: '#34d399' },
      { icon: '⚔️', val: totals.attack, color: '#fbbf24' },
      { icon: '🛡️', val: totals.defense, color: '#60a5fa' },
      { icon: '🎯', val: totals.range, color: '#fb923c' }
    ];
    
    statsArray.forEach((stat, i) => {
      const cx = barX + (i * statItemW) + statItemW / 2;
      draw.drawText(stat.icon, cx - 12, cy + 26, { align: 'center', font: '16px Inter, sans-serif' });
      draw.drawText(String(stat.val), cx + 10, cy + 26, { align: 'center', font: 'bold 16px Inter, sans-serif', color: stat.color });
    });

    cy += barH + 30;

    if (game.lastEvent) {
      draw.drawText(game.lastEvent, x + w / 2, cy, {
        align: 'center', font: 'italic 14px Inter, sans-serif', color: '#cbd5e1', maxWidth: w - 24,
      });
      cy += 30;
    }

    game.diceRects = [];
    game.dropZones = [];

    if (game.phase === PHASES.ENERGY) {
      draw.drawText('Dados rolados', x + w / 2, cy, {
        align: 'center', font: '20px Inter, sans-serif', color: '#d1d5db',
      });
      
      cy += 20;
      const diceSize = 64;
      const diceSpacing = 20;
      const totalDiceW = (diceSize * 3) + (diceSpacing * 2);
      let diceX = x + (w - totalDiceW) / 2;
      
      for (let index = 0; index < 3; index += 1) {
        if (game.phase === PHASES.ENERGY) {
          const stat = actions.assignedStatForDie(index);
          const isDraggingThisDie = game.draggingDie && game.draggingDie.dieIndex === index;
          const currentDiceX = diceX + index * (diceSize + diceSpacing);

          if (stat === null && !isDraggingThisDie) {
            draw.drawDieToken(currentDiceX, cy, diceSize, game.roll[index], index);
          } else if (stat === null) {
            draw.drawDieToken(currentDiceX, cy, diceSize, game.roll[index], index, true);
          }
        }
      }

      cy += diceSize + 40;
      
      const boardY = topMargin + Math.floor((h - topMargin - 140) / 2);
      const boxW = Math.floor((w - 48) / 3);
      const boxH = 140;
      const boxSpacing = 8;
      const startBoxX = x + 16 + (w - 32 - (boxW * 3 + boxSpacing * 2)) / 2;

      ['speed', 'attack', 'defense'].forEach((stat, index) => {
        const meta = STAT_META[stat];
        const bx = startBoxX + index * (boxW + boxSpacing);
        const by = cy;
        const assigned = game.energyAssigned[stat];
        const hoveringDrop = game.phase === PHASES.ENERGY && layout.pointInRect(state.mouse.x, state.mouse.y, {
          x: bx, y: by, w: boxW, h: boxH,
        }) && !!game.draggingDie;

        if (game.phase === PHASES.ENERGY) {
          game.dropZones.push({ x: bx, y: by, w: boxW, h: boxH, stat });
        }
        
        draw.roundRect(
          bx, by, boxW, boxH, 8,
          hoveringDrop ? '#e7e5e4' : '#d6d3d1',
          '#a8a29e'
        );
        
        draw.drawText(meta.label, bx + boxW / 2, by + 24, {
          align: 'center', font: 'bold 16px Inter, sans-serif', color: '#292524',
        });
        draw.drawText(`Base ${game.player[`${stat}Base`]}`, bx + boxW / 2, by + 42, {
          align: 'center', font: '14px Inter, sans-serif', color: '#44403c',
        });

        ctx.beginPath();
        ctx.arc(bx + boxW / 2, by + 80, 24, 0, Math.PI * 2);
        ctx.fillStyle = '#a8a29e';
        ctx.fill();
        ctx.strokeStyle = '#78716c';
        ctx.lineWidth = 3;
        ctx.stroke();

        draw.drawText(meta.icon, bx + boxW / 2, by + 130, {
          align: 'center', font: '24px Inter, sans-serif',
        });

        if (game.phase === PHASES.ENERGY && assigned !== null && (!game.draggingDie || game.draggingDie.dieIndex !== assigned)) {
          const dieSize = 48;
          draw.drawDieToken(bx + boxW / 2 - dieSize / 2, by + 80 - dieSize / 2, dieSize, game.roll[assigned], assigned);
        }
      });
      
      cy += boxH + 40;
      
      const btnW = w - 64;
      if (game.phase === PHASES.ENERGY) {
        if (actions.allDiceAssigned() && !game.energyConfirmStartTime) {
          game.energyConfirmStartTime = performance.now();
        }

        if (game.energyConfirmStartTime) {
          const elapsed = performance.now() - game.energyConfirmStartTime;
          const remaining = Math.max(0, 5 - Math.floor(elapsed / 1000));

          if (remaining === 0 && actions.allDiceAssigned() && !game.busy && !game.energyConfirmed) {
            game.energyConfirmed = true; // prevent multiple calls
            setTimeout(() => actions.confirmEnergy(), 0);
          }

          draw.drawButton(x + 32, cy, btnW, 56, String(remaining), () => {
            if (actions.allDiceAssigned()) actions.confirmEnergy();
          }, {
            fill: '#b45309', hoverFill: '#d97706', stroke: '#fcd34d',
            disabled: game.busy || !actions.allDiceAssigned(),
            font: 'bold 28px Inter, sans-serif', color: '#fffbeb',
          });
        }

        if (game.draggingDie) {
          draw.drawDieToken(
            state.mouse.x - game.draggingDie.offsetX,
            state.mouse.y - game.draggingDie.offsetY,
            64, game.roll[game.draggingDie.dieIndex], game.draggingDie.dieIndex
          );
        }
      }
    }

    if (game.phase === PHASES.LEVELUP) {
      const options = [
        ['❤️ Curar', 'heal'],
        ['🏃 +1 Velocidade', 'speed'],
        ['⚔️ +1 Dano do Ataque', 'attack'],
        ['🛡️ +1 Defesa', 'defense'],
        ['🎯 +1 Alcance', 'range'],
      ];

      options.forEach((option, index) => {
        draw.drawButton(x + 24, cy + index * 54, w - 48, 44, option[0], () => {
          actions.applyReward(option[1]);
        }, {
          fill: '#065f46', hoverFill: '#047857', stroke: '#34d399',
          disabled: game.busy, font: 'bold 14px Inter, sans-serif',
        });
      });
    }

    if (game.phase === PHASES.WON || game.phase === PHASES.LOST) {
      draw.drawButton(x + 24, cy, w - 48, 48, 'Novo jogo', actions.newGame, {
        fill: '#1d4ed8', hoverFill: '#2563eb', stroke: '#93c5fd',
      });
      cy += 60;
      draw.drawButton(x + 24, cy, w - 48, 48, 'Carregar', actions.loadGame, {
        fill: '#1f2937', hoverFill: '#374151', stroke: '#64748b',
      });
    }

    // Visual Debug Controls
    if (DEBUG_CONFIG.SHOW_STATS) {
      cy = h - 220;
      draw.drawText('AJUSTES VISUAIS', x + w / 2, cy, { align: 'center', font: '900 12px Inter, sans-serif', color: '#64748b' });
      cy += 24;

      const controls = [
        { label: 'Exposição', key: 'exposure', step: 0.1, min: 0.1, max: 3.0 },
        { label: 'Luz Amb.', key: 'ambientIntensity', step: 0.1, min: 0, max: 3.0 },
        { label: 'Luz Dir.', key: 'keyIntensity', step: 0.1, min: 0, max: 5.0 },
        { label: 'Névoa', key: 'fogDensity', step: 0.005, min: 0, max: 0.1 },
      ];

      controls.forEach(ctrl => {
        const val = state.visuals[ctrl.key];
        draw.drawText(`${ctrl.label}: ${val.toFixed(3)}`, x + 20, cy + 14, { font: '11px Inter, sans-serif', color: '#94a3b8' });
        
        draw.drawButton(x + w - 70, cy, 24, 20, '-', () => {
          state.visuals[ctrl.key] = Math.max(ctrl.min, state.visuals[ctrl.key] - ctrl.step);
        }, { fill: '#1f2937', stroke: '#475569', font: 'bold 14px Inter' });

        draw.drawButton(x + w - 40, cy, 24, 20, '+', () => {
          state.visuals[ctrl.key] = Math.min(ctrl.max, state.visuals[ctrl.key] + ctrl.step);
        }, { fill: '#1f2937', stroke: '#475569', font: 'bold 14px Inter' });

        cy += 26;
      });

      const shadowLabel = state.visuals.shadowMapEnabled ? 'Sombras: ON' : 'Sombras: OFF';
      draw.drawButton(x + 20, cy, (w / 2) - 24, 24, shadowLabel, () => {
        state.visuals.shadowMapEnabled = !state.visuals.shadowMapEnabled;
      }, { fill: state.visuals.shadowMapEnabled ? '#065f46' : '#1f2937', stroke: '#475569', font: 'bold 11px Inter' });

      const outlineLabel = state.visuals.showOutlines ? 'Bordas: ON' : 'Bordas: OFF';
      draw.drawButton(x + (w / 2) + 4, cy, (w / 2) - 24, 24, outlineLabel, () => {
        state.visuals.showOutlines = !state.visuals.showOutlines;
      }, { fill: state.visuals.showOutlines ? '#065f46' : '#1f2937', stroke: '#475569', font: 'bold 11px Inter' });
    }
  }

  function drawMenu(currentLayout) {
    if (!state.game.menuOpen) return;

    const w = 220;
    const h = 184;
    const x = (currentLayout.sw - w) / 2;
    const y = (currentLayout.sh - h) / 2;

    draw.roundRect(x, y, w, h, 20, 'rgba(5,8,14,0.96)', '#64748b');
    draw.drawText('Menu', x + w / 2, y + 30, {
      align: 'center',
      font: 'bold 17px Inter, sans-serif',
      color: '#f8fafc',
    });
    draw.drawButton(x + 18, y + 48, w - 36, 34, 'Como jogar', () => {
      state.game.menuOpen = false;
      document.getElementById('tutorial-modal').style.display = 'flex';
    }, {
      fill: '#1f2937',
      hoverFill: '#374151',
      stroke: '#64748b',
    });
    draw.drawButton(x + 18, y + 90, w - 36, 34, 'Mapa aberto', () => {
      state.game.menuOpen = false;
      actions.newGame();
    }, {
      fill: '#064e3b',
      hoverFill: '#065f46',
      stroke: '#34d399',
    });
    draw.drawButton(x + 18, y + 132, w - 36, 34, 'Dungeon legada', () => {
      state.game.menuOpen = false;
      actions.newDungeonLegacyGame();
    }, {
      fill: '#1f2937',
      hoverFill: '#374151',
      stroke: '#64748b',
    });
    draw.drawButton(x + 132, y + 8, 70, 28, 'Sair', () => {
      state.game.menuOpen = false;
    }, {
      fill: '#1f2937',
      hoverFill: '#374151',
      stroke: '#64748b',
    });
  }

  function drawCompactBottomUI(currentLayout) {
    const game = state.game;
    const bottomY = currentLayout.sh - currentLayout.bottomUIHeight;
    const uiX = currentLayout.boardX;
    const uiW = currentLayout.boardW;
    const hp = game.player.health;
    const maxHp = game.player.maxHealth;
    const attack = actions.getEquippedAttack(game);
    const attackSelected = game.selectedAttackId === attack.id;
    const attackDisabled = game.phase !== PHASES.HERO || game.busy || game.apRemaining < attack.apCost;

    draw.roundRect(uiX, bottomY + 10, 72, 50, 10, 'rgba(15,23,42,0.88)', '#334155');
    draw.drawText('HP', uiX + 36, bottomY + 30, {
      align: 'center',
      font: 'bold 12px Inter, sans-serif',
      color: '#fca5a5',
    });
    draw.drawText(`${hp}/${maxHp}`, uiX + 36, bottomY + 50, {
      align: 'center',
      font: 'bold 17px Inter, sans-serif',
      color: '#f8fafc',
    });

    const slotSize = 46;
    const slotGap = 8;
    const slotsX = uiX + 84;
    const slotsY = bottomY + 12;

    for (let index = 0; index < 3; index += 1) {
      const sx = slotsX + index * (slotSize + slotGap);
      const slot = { x: sx, y: slotsY, w: slotSize, h: slotSize };
      const hovered = layout.pointInRect(state.mouse.x, state.mouse.y, slot);
      const filled = index === 0;
      const selected = filled && attackSelected;
      const fill = !filled
        ? 'rgba(15,23,42,0.52)'
        : selected
          ? '#92400e'
          : hovered && !attackDisabled
            ? '#78350f'
            : '#1f2937';
      const stroke = selected ? '#fbbf24' : filled ? '#b45309' : '#334155';

      draw.roundRect(sx, slotsY, slotSize, slotSize, 10, fill, stroke);

      if (filled) {
        draw.drawText('ATQ', sx + slotSize / 2, slotsY + 26, {
          align: 'center',
          font: 'bold 12px Inter, sans-serif',
          color: attackDisabled ? '#737b8c' : '#fff7ed',
        });
        draw.drawText(String(attack.apCost), sx + slotSize - 11, slotsY + slotSize - 7, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: attackDisabled ? '#737b8c' : '#facc15',
        });

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: actions.toggleAttackSelection });
        }
      } else {
        draw.drawText('+', sx + slotSize / 2, slotsY + 29, {
          align: 'center',
          font: '20px Inter, sans-serif',
          color: '#475569',
        });
      }
    }

    const btnW = Math.min(176, uiW);
    const btnH = 48;
    const btnX = uiX + uiW - btnW;
    const btnY = bottomY + 74;
    draw.drawButton(btnX, btnY, btnW, btnH, 'Encerrar vez', actions.endHeroPhase, {
      fill: '#7c2d12', hoverFill: '#9a3412', stroke: '#fdba74',
      disabled: game.phase !== PHASES.HERO || game.busy, font: 'bold 16px Inter, sans-serif',
    });
  }

  function drawBottomUI(currentLayout) {
    if (currentLayout.compact) {
      drawCompactBottomUI(currentLayout);
      return;
    }

    const game = state.game;
    const bottomY = currentLayout.sh - currentLayout.bottomUIHeight;
    const uiX = currentLayout.boardX;
    
    // Draw Heart
    const hp = game.player.health;
    const maxHp = game.player.maxHealth;
    
    const heartSize = 74;
    const hx = uiX + heartSize / 2;
    const hy = bottomY + 12;
    
    ctx.save();
    ctx.translate(hx, hy);
    
    // Draw heart path
    ctx.beginPath();
    const w = heartSize;
    const h = heartSize;
    const topCurveHeight = h * 0.3;
    ctx.moveTo(0, topCurveHeight);
    ctx.bezierCurveTo(0, 0, -w / 2, 0, -w / 2, topCurveHeight);
    ctx.bezierCurveTo(-w / 2, (h + topCurveHeight) / 2, 0, (h + topCurveHeight) / 2, 0, h);
    ctx.bezierCurveTo(0, (h + topCurveHeight) / 2, w / 2, (h + topCurveHeight) / 2, w / 2, topCurveHeight);
    ctx.bezierCurveTo(w / 2, 0, 0, 0, 0, topCurveHeight);
    ctx.closePath();

    // Fill background (empty heart)
    ctx.fillStyle = '#4b5563'; // gray-600
    ctx.fill();

    // Fill red portion based on HP
    if (hp > 0 && maxHp > 0) {
      ctx.save();
      ctx.clip(); 
      const fillPercent = hp / maxHp;
      const fillHeight = h * fillPercent;
      const startY = h - fillHeight;
      
      ctx.fillStyle = '#ef4444'; // red-500
      ctx.fillRect(-w / 2, startY, w, fillHeight);
      ctx.restore();
    }

    // Stroke heart
    ctx.strokeStyle = '#1e293b'; 
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Text inside heart
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter, sans-serif';
    
    // Draw current hp
    ctx.fillText(hp, 0, h * 0.35);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(-10, h * 0.5);
    ctx.lineTo(10, h * 0.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw max hp
    ctx.fillText(maxHp, 0, h * 0.67);
    
    ctx.restore();

    const slotSize = 58;
    const slotGap = 10;
    const slotsX = uiX + heartSize + 28;
    const slotsY = bottomY + 21;
    const attack = actions.getEquippedAttack(game);
    const attackSelected = game.selectedAttackId === attack.id;
    const attackDisabled = game.phase !== PHASES.HERO || game.busy || game.apRemaining < attack.apCost;

    for (let index = 0; index < 3; index += 1) {
      const sx = slotsX + index * (slotSize + slotGap);
      const slot = { x: sx, y: slotsY, w: slotSize, h: slotSize };
      const hovered = layout.pointInRect(state.mouse.x, state.mouse.y, slot);
      const filled = index === 0;
      const selected = filled && attackSelected;
      const fill = !filled
        ? 'rgba(15,23,42,0.52)'
        : selected
          ? '#92400e'
          : hovered && !attackDisabled
            ? '#78350f'
            : '#1f2937';
      const stroke = selected ? '#fbbf24' : filled ? '#b45309' : '#334155';

      draw.roundRect(sx, slotsY, slotSize, slotSize, 12, fill, stroke);

      if (filled) {
        draw.drawText('✊', sx + slotSize / 2, slotsY + 34, {
          align: 'center',
          font: '28px Inter, sans-serif',
          color: attackDisabled ? '#737b8c' : '#fff7ed',
        });
        draw.drawText(String(attack.apCost), sx + slotSize - 12, slotsY + slotSize - 8, {
          align: 'center',
          font: 'bold 11px Inter, sans-serif',
          color: attackDisabled ? '#737b8c' : '#facc15',
        });

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: actions.toggleAttackSelection });
        }
      } else {
        draw.drawText('+', sx + slotSize / 2, slotsY + 36, {
          align: 'center',
          font: '22px Inter, sans-serif',
          color: '#475569',
        });
      }
    }
    
    // Turn Queue
    if (game.turnQueue && game.turnQueue.length > 0) {
      const queueW = 48;
      const queueSpacing = 16;
      const queueY = bottomY + 26;
      
      let currentX = slotsX + (slotSize + slotGap) * 3 + 28;
      const staticQueue = ['player', ...game.monsters.map(m => m.id)];

      for (let i = 0; i < staticQueue.length; i++) {
         const entityId = staticQueue[i];
         let icon;

         if (entityId === 'player') {
            icon = '🧙';
         } else {
            const monster = game.monsters.find(m => m.id === entityId);
            if (!monster) continue;
            icon = monster.emoji;
         }

         const isCurrent = (entityId === game.turnQueue[0]);
         const bgColor = isCurrent ? '#4ade80' : '#111827';
         const borderColor = '#64748b';

         const boxSize = isCurrent ? queueW + 8 : queueW;
         const yOffset = isCurrent ? -4 : 0;
         const bx = currentX;
         
         draw.roundRect(bx, queueY + yOffset, boxSize, boxSize, 8, bgColor, borderColor);
         draw.drawText(icon, bx + boxSize / 2, queueY + yOffset + boxSize / 2 + 8, {
            align: 'center', font: isCurrent ? '30px Inter' : '24px Inter'
         });

         draw.roundRect(bx - 8, queueY + yOffset - 8, 20, 20, 10, '#1f2937', borderColor);
         draw.drawText(`${i + 1}`, bx + 2, queueY + yOffset + 6, {
            align: 'center', font: 'bold 12px Inter, sans-serif', color: '#fff'
         });

         currentX += (queueW + queueSpacing);
      }
    }

    const btnW = 180;
    const btnH = 50;
    const btnX = currentLayout.boardX + currentLayout.boardW - btnW;
    const btnY = bottomY + 24;
    draw.drawButton(btnX, btnY, btnW, btnH, 'Encerrar vez', actions.endHeroPhase, {
      fill: '#7c2d12', hoverFill: '#9a3412', stroke: '#fdba74',
      disabled: game.phase !== PHASES.HERO || game.busy, font: 'bold 18px Inter, sans-serif',
    });
  }

  function drawPlayerResourceHud(x, y, scale = 1) {
    const game = state.game;
    const width = 154 * scale;
    const height = 94 * scale;
    const heartSize = 74 * scale;
    const heartCx = x + width / 2;
    const heartCy = y + 38 * scale;

    draw.roundRect(x, y + 8 * scale, width, height - 8 * scale, 14 * scale, 'rgba(15,23,42,0.72)', '#334155');
    drawHeartMeter(heartCx, heartCy, heartSize, game.player.health, game.player.maxHealth);
    drawActionPointBadge(
      heartCx - 45 * scale,
      heartCy + 36 * scale,
      34 * scale,
      game.apRemaining ?? game.player.apMax,
    );
    drawMovementPointBadge(
      heartCx + 45 * scale,
      heartCy + 36 * scale,
      34 * scale,
      game.speedRemaining ?? game.player.speedBase,
    );

    return width;
  }

  function drawSpellGlyph(cx, cy, size, disabled) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, size * 0.08);
    ctx.strokeStyle = disabled ? '#737b8c' : '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.18, cy + size * 0.18);
    ctx.lineTo(cx + size * 0.18, cy - size * 0.18);
    ctx.moveTo(cx - size * 0.2, cy - size * 0.18);
    ctx.lineTo(cx + size * 0.18, cy + size * 0.2);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  function drawSpellBar(x, y, availableW, slotSize, maxSlots, showLabel = true) {
    const game = state.game;
    const attack = actions.getEquippedAttack(game);
    const attackSelected = game.selectedAttackId === attack.id;
    const attackDisabled = game.phase !== PHASES.HERO || game.busy || game.apRemaining < attack.apCost;
    const slotGap = Math.max(6, Math.floor(slotSize * 0.16));
    const slotCount = clamp(Math.floor((availableW + slotGap) / (slotSize + slotGap)), 3, maxSlots);
    const slotsY = y + (showLabel ? 22 : 0);

    if (showLabel) {
      beginStarPath(x + 8, y + 8, 6, 3);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      draw.drawText('FEITICOS', x + 20, y + 13, {
        font: '700 12px Inter, sans-serif',
        color: '#cbd5e1',
      });
    }

    for (let index = 0; index < slotCount; index += 1) {
      const sx = x + index * (slotSize + slotGap);
      const slot = { x: sx, y: slotsY, w: slotSize, h: slotSize };
      const hovered = layout.pointInRect(state.mouse.x, state.mouse.y, slot);
      const filled = index === 0;
      const selected = filled && attackSelected;
      const fill = !filled
        ? 'rgba(15,23,42,0.48)'
        : selected
          ? '#9a3412'
          : hovered && !attackDisabled
            ? '#78350f'
            : '#1f2937';
      const stroke = selected ? '#fed7aa' : filled ? '#f97316' : '#334155';

      draw.roundRect(sx, slotsY, slotSize, slotSize, Math.min(10, slotSize * 0.18), fill, stroke);

      if (filled) {
        draw.drawText('\u270A', sx + slotSize / 2, slotsY + slotSize * 0.62, {
          align: 'center',
          font: `${Math.floor(slotSize * 0.52)}px Inter, sans-serif`,
          color: attackDisabled ? '#737b8c' : '#fff7ed',
        });

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: actions.toggleAttackSelection });
        }
      } else {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(sx + slotSize / 2, slotsY + slotSize / 2, Math.max(2, slotSize * 0.06), 0, Math.PI * 2);
        ctx.fillStyle = '#475569';
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function turnQueueEntries(game) {
    const ids = ['player', ...game.monsters.map((monster) => monster.id)];

    return ids.map((entityId) => {
      if (entityId === 'player') {
        return {
          id: 'player',
          name: 'Aventureiro',
          hp: game.player.health,
          emoji: '\uD83E\uDDD9',
          tint: '#34d399',
        };
      }

      const monster = game.monsters.find((currentMonster) => currentMonster.id === entityId);
      if (!monster) return null;
      return {
        id: monster.id,
        name: monster.name,
        hp: monster.hp,
        emoji: monster.emoji,
        tint: monster.tint,
      };
    }).filter(Boolean);
  }

  function turnQueueWidth(game, itemSize, gap) {
    const clockW = itemSize + 8;
    return clockW + gap + turnQueueEntries(game).length * (itemSize + gap) + 8;
  }

  function drawTurnQueue(x, y, itemSize, gap, now) {
    const game = state.game;
    const entries = turnQueueEntries(game);
    if (entries.length === 0) return;

    const clockW = itemSize + 8;
    const itemH = itemSize + 20;
    draw.roundRect(x, y, clockW, itemH, 10, 'rgba(15,23,42,0.86)', '#334155');
    drawClockIcon(x + clockW / 2, y + itemSize * 0.44, itemSize * 0.23, '#93c5fd');
    draw.drawText(String(game.turnCount), x + clockW / 2, y + itemSize + 14, {
      align: 'center',
      font: `900 ${Math.floor(itemSize * 0.34)}px Inter, sans-serif`,
      color: '#e0f2fe',
    });

    let currentX = x + clockW + gap;
    for (const entry of entries) {
      const isCurrent = entry.id === game.turnQueue?.[0];
      const pulse = isCurrent ? Math.abs(Math.sin(now / 180)) * 3 : 0;
      const highlightSize = itemSize + (isCurrent ? 8 : 0);
      const bx = currentX;
      const cx = bx + itemSize / 2;
      const cy = y + itemSize / 2;
      const fill = isCurrent ? 'rgba(14,165,233,0.34)' : 'rgba(15,23,42,0.76)';
      const stroke = isCurrent ? '#facc15' : '#475569';

      draw.roundRect(cx - highlightSize / 2, cy - highlightSize / 2 + (isCurrent ? -pulse : 0), highlightSize, highlightSize, 10, fill, stroke);
      draw.drawText(entry.emoji || 'P', cx, cy + itemSize * 0.18 + (isCurrent ? -pulse : 0), {
        align: 'center',
        font: `700 ${Math.floor(itemSize * 0.54)}px Inter, sans-serif`,
        color: '#f8fafc',
      });

      draw.roundRect(bx + 2, y + itemSize + 3, itemSize - 4, 17, 7, 'rgba(7,10,17,0.9)', '#334155');
      draw.drawText(`${entry.hp}\u2665`, bx + itemSize / 2, y + itemSize + 16, {
        align: 'center',
        font: `900 ${Math.floor(itemSize * 0.26)}px Inter, sans-serif`,
        color: '#fecaca',
      });

      currentX += itemSize + gap;
    }
  }

  function drawDesktopTurnQueue(currentLayout, now) {
    if (currentLayout.compact) return;

    const game = state.game;
    const itemSize = 48;
    const gap = 8;
    const width = turnQueueWidth(game, itemSize, gap);
    const x = currentLayout.boardX + currentLayout.boardW / 2 - width / 2;
    const y = Math.max(18, currentLayout.boardY - 112);

    drawTurnQueue(x, y, itemSize, gap, now);
  }

  function drawCombatBottomUI(currentLayout, now = performance.now()) {
    const game = state.game;
    const bottomY = currentLayout.sh - currentLayout.bottomUIHeight;

    if (currentLayout.compact) {
      const uiX = currentLayout.boardX;
      const uiW = currentLayout.boardW;
      const hudW = drawPlayerResourceHud(uiX, bottomY + 6, 0.74);
      drawSpellBar(uiX + hudW + 8, bottomY + 13, uiW - hudW - 8, 39, 4, false);

      const queueItem = 29;
      const queueGap = 5;
      drawTurnQueue(uiX, bottomY + 78, queueItem, queueGap, now);

      const btnW = Math.min(148, uiW * 0.44);
      draw.drawButton(uiX + uiW - btnW, bottomY + 84, btnW, 38, 'Encerrar vez', actions.endHeroPhase, {
        fill: '#7c2d12', hoverFill: '#9a3412', stroke: '#fdba74',
        disabled: game.phase !== PHASES.HERO || game.busy, font: 'bold 12px Inter, sans-serif',
      });
      return;
    }

    const uiX = currentLayout.sidebarW + 24;
    const uiW = currentLayout.sw - currentLayout.sidebarW - 48;
    const tight = uiW < 760;
    const hudScale = tight ? 0.74 : 0.88;
    const hudW = drawPlayerResourceHud(uiX, bottomY + 15, hudScale);
    const btnW = tight ? 142 : 170;
    const btnH = 40;
    const btnX = uiX + uiW - btnW;
    const btnY = bottomY + 74;
    const spellX = uiX + hudW + 18;
    const spellAvailableW = Math.max(150, btnX - spellX - 18);

    drawSpellBar(spellX, bottomY + 20, spellAvailableW, tight ? 40 : 46, 8, true);
    draw.drawButton(btnX, btnY, btnW, btnH, 'Encerrar vez', actions.endHeroPhase, {
      fill: '#7c2d12', hoverFill: '#9a3412', stroke: '#fdba74',
      disabled: game.phase !== PHASES.HERO || game.busy, font: 'bold 15px Inter, sans-serif',
    });
  }

  function drawSelectedEntityModal(currentLayout) {
    const game = state.game;
    const playerSelected = !!layout.hoveredPlayer();
    const monster = playerSelected ? null : layout.hoveredMonster();
    if (!playerSelected && !monster) return;

    const tile = playerSelected ? game.player : monster;

    const rect = layout.tileRect(currentLayout, tile.x, tile.y);
    const totals = actions.getTotals();
    const image = playerSelected ? cardImages.player : cardImages[monster.type];
    const title = playerSelected ? 'Aventureiro' : monster.name;
    const titleIcon = playerSelected ? '🧙' : monster.emoji;
    const lines = playerSelected
      ? [
          `Vida ${game.player.health}/${game.player.maxHealth}`,
          `AP ${game.apRemaining}/${game.player.apMax} | ${totals.attackName} custa ${totals.attackCost} AP`,
          `Movimento ${game.speedRemaining}/${game.player.speedBase} | só em cruz`,
          `Ataque ${totals.attack} | suga ${totals.attackLifeSteal}`,
          `Defesa ${totals.defense}`,
          `Alcance ${totals.range}`,
        ]
      : [
          `Vida ${monster.hp}/${monster.maxHp}`,
          `Ataque ${monster.attack}`,
          `Defesa ${monster.defense}`,
          `Alcance ${monster.range}`,
          `Velocidade ${monster.speed}`,
        ];

    const cardW = 110;
    const cardH = 146;
    const width = currentLayout.leftW - 32;
    const height = playerSelected ? 224 : 200;
    let x = currentLayout.leftX + 16;
    let y = currentLayout.leftY + currentLayout.leftH - height - 16;

    draw.roundRect(x, y, width, height, 18, 'rgba(5,8,14,0.95)', '#64748b');
    draw.roundRect(x + 12, y + 27, cardW, cardH, 12, '#111827', '#d6a85c');

    ctx.save();
    draw.roundRect(x + 16, y + 31, cardW - 8, cardH - 8, 10, null, null);
    ctx.clip();

    const drew = draw.drawImageCover(image, x + 16, y + 31, cardW - 8, cardH - 8);
    if (!drew) {
      draw.drawText(titleIcon, x + 16 + cardW / 2, y + 31 + cardH / 2 + 15, {
        align: 'center',
        font: '46px Inter, sans-serif',
      });
    }

    ctx.restore();

    const textX = x + cardW + 24;
    draw.drawText(`${titleIcon} ${title}`, textX, y + 46, {
      font: 'bold 16px Inter, sans-serif',
      color: '#f8fafc',
    });

    const icons = playerSelected
      ? ['❤️', '🏃', '⚔️', '🛡️', '🎯']
      : ['❤️', '⚔️', '🛡️', '🎯', '🏃'];

    for (let index = 0; index < lines.length; index += 1) {
      draw.drawText(icons[index] || '', textX + 2, y + 80 + index * 22, {
        font: '14px Inter, sans-serif',
        color: '#fff',
      });
      draw.drawText(lines[index], textX + 26, y + 80 + index * 22, {
        font: '13px Inter, sans-serif',
        color: '#cbd5e1',
        maxWidth: width - cardW - 32,
      });
    }
  }

  function screenPointForTile(currentLayout, x, y, height = 1) {
    const projected = threeBoard.screenPositionForTile?.(currentLayout, x, y, height);
    if (projected) return projected;

    const rect = layout.tileRect(currentLayout, x, y);
    return {
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
    };
  }

  function drawHoveredEntityTooltip(currentLayout) {
    const game = state.game;
    const playerHovered = !!layout.hoveredPlayer();
    const monster = playerHovered ? null : layout.hoveredMonster();
    if (!playerHovered && !monster) return;

    const entity = playerHovered ? game.player : monster;
    const name = playerHovered ? 'Aventureiro' : monster.name;
    const hp = playerHovered ? game.player.health : monster.hp;
    const point = screenPointForTile(currentLayout, entity.x, entity.y, 1.28);
    const label = `${name} | ${hp} \u2665`;

    ctx.save();
    ctx.font = '800 13px Inter, sans-serif';
    const width = Math.min(currentLayout.sw - 24, Math.max(118, ctx.measureText(label).width + 26));
    const height = 30;
    const x = clamp(point.x - width / 2, 12, currentLayout.sw - width - 12);
    const y = clamp(point.y - 34, 12, currentLayout.sh - height - 12);

    draw.roundRect(x, y, width, height, 10, 'rgba(5,8,14,0.92)', '#f8fafc');
    draw.drawText(label, x + width / 2, y + 20, {
      align: 'center',
      font: '800 13px Inter, sans-serif',
      color: '#f8fafc',
    });
    ctx.restore();
  }

  function drawFloatingTextAnimations(currentLayout, now) {
    state.game.animations.forEach((anim) => {
      if (anim.type !== 'floatingText' || now < anim.startTime) return;

      const progress = (now - anim.startTime) / anim.duration;
      const point = screenPointForTile(currentLayout, anim.x, anim.y, 1.18);
      const isDamage = anim.color === '#ef4444';
      const fontSize = isDamage ? 38 : 28;
      const lift = (isDamage ? 54 : 42) * progress;
      const cx = point.x;
      const cy = point.y - lift;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.pow(progress, 2.6));
      ctx.strokeStyle = 'rgba(15,23,42,0.92)';
      ctx.lineWidth = isDamage ? 7 : 5;
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(anim.text, cx, cy);
      ctx.fillStyle = anim.color;
      ctx.fillText(anim.text, cx, cy);
      ctx.restore();
    });
  }

  function drawBanner(currentLayout) {
    const banner = state.game.banner;
    if (!banner) return;

    const now = performance.now();
    const remaining = Math.max(0, banner.until - now);
    const alpha = Math.min(1, remaining / 250);

    const activeViewport = state.game.mode === GAME_MODES.OVERWORLD
      ? threeBoard.getViewport(currentLayout)
      : null;
    const cx = activeViewport
      ? activeViewport.x + activeViewport.w / 2
      : currentLayout.boardX + currentLayout.boardW / 2;
    const cy = activeViewport
      ? activeViewport.y + activeViewport.h / 2
      : currentLayout.boardY + currentLayout.boardH / 2;
    const hasCard = !!banner.cardKey;
    const panelW = hasCard ? Math.min(620, Math.max(480, currentLayout.boardW * 0.82)) : 520;
    const panelH = hasCard ? 176 : 148;
    const panelX = cx - panelW / 2;
    const panelY = hasCard ? cy - panelH / 2 + 16 : cy - 74;
    const accent = banner.accent || '#facc15';

    ctx.save();
    ctx.globalAlpha = alpha;
    if (hasCard) {
      const cardImage = cardImages[banner.cardKey] || null;
      const cardW = 118;
      const cardH = 150;
      const cardX = panelX + 20;
      const cardY = panelY + (panelH - cardH) / 2;
      const textX = cardX + cardW + 24;
      const textW = panelW - (textX - panelX) - 20;

      draw.roundRect(panelX, panelY, panelW, panelH, 24, 'rgba(0,0,0,0.82)', accent);
      draw.roundRect(cardX - 8, cardY - 8, cardW + 16, cardH + 16, 18, 'rgba(0,0,0,0.35)', null);
      draw.roundRect(cardX, cardY, cardW, cardH, 14, '#111827', accent);

      ctx.save();
      draw.roundRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8, 10, null, null);
      ctx.clip();
      const drew = draw.drawImageCover(cardImage, cardX + 4, cardY + 4, cardW - 8, cardH - 8);
      if (!drew) {
        draw.drawText(banner.subtitle || banner.title, cardX + cardW / 2, cardY + cardH / 2 + 8, {
          align: 'center',
          font: 'bold 18px Inter, sans-serif',
          color: '#f8fafc',
          maxWidth: cardW - 16,
        });
      }
      ctx.restore();

      draw.drawText(banner.title, textX, panelY + 62, {
        align: 'left',
        font: 'bold 30px Inter, sans-serif',
        color: '#f8fafc',
        maxWidth: textW,
      });

      if (banner.subtitle) {
        draw.drawText(banner.subtitle, textX, panelY + 102, {
          align: 'left',
          font: '16px Inter, sans-serif',
          color: '#cbd5e1',
          maxWidth: textW,
        });
      }
    } else {
      ctx.lineWidth = 3;
      draw.roundRect(panelX, panelY, panelW, panelH, 26, 'rgba(0,0,0,0.76)', accent);
      draw.drawText(banner.title, cx, cy - 12, {
        align: 'center',
        font: 'bold 32px Inter, sans-serif',
        color: '#f8fafc',
      });

      if (banner.subtitle) {
        draw.drawText(banner.subtitle, cx, cy + 25, {
          align: 'center',
          font: '16px Inter, sans-serif',
          color: '#cbd5e1',
        });
      }
    }

    ctx.restore();
  }

  function drawCarriedAttack() {
    const game = state.game;
    const attack = actions.getEquippedAttack(game);
    if (game.phase !== PHASES.HERO || game.busy || game.selectedAttackId !== attack.id) return;

    const size = 38;
    const x = state.mouse.x + 16;
    const y = state.mouse.y + 16;

    ctx.save();
    ctx.globalAlpha = 0.94;
    draw.roundRect(x, y, size, size, 10, '#78350f', '#fbbf24');
    draw.drawText('✊', x + size / 2, y + 25, {
      align: 'center',
      font: '22px Inter, sans-serif',
      color: '#fff7ed',
    });
    ctx.restore();
  }

  function drawEnergyFocusMask(currentLayout) {
    if (state.game.phase !== PHASES.ENERGY) return;

    const maskX = currentLayout.boardX - 18;
    const maskW = currentLayout.sw - maskX;
    const gradient = ctx.createLinearGradient(maskX, 0, currentLayout.sw, 0);
    gradient.addColorStop(0, 'rgba(5,8,14,0.54)');
    gradient.addColorStop(0.35, 'rgba(4,7,12,0.66)');
    gradient.addColorStop(1, 'rgba(2,4,8,0.78)');

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(maskX, 0, maskW, currentLayout.sh);
    ctx.restore();
  }

  function drawOverworld(currentLayout, now) {
    const game = state.game;
    const overworld = game.overworld;
    if (!overworld) return;

    state.game.animations = state.game.animations.filter((anim) => isAnimationActive(anim, now));

    const worldMap = getCurrentWorldMap(overworld);
    const bounds = getCurrentWorldBounds(overworld);
    const objects = getCurrentWorldObjects(overworld);
    const reachable = actions.getOverworldReachableTiles();
    const hoverTile = layout.hoveredTile();
    const hoverEnemy = layout.hoveredOverworldEnemy();
    const hoverPath = hoverTile && reachable.has(posKey(hoverTile))
      ? reachable.get(posKey(hoverTile)).path
      : null;
    const moveHighlight = new Map();
    if (hoverTile && !hoverEnemy && reachable.has(posKey(hoverTile))) {
      moveHighlight.set(posKey(hoverTile), reachable.get(posKey(hoverTile)));
    }

    threeBoard.render({
      currentLayout,
      boardWidth: bounds.width,
      boardHeight: bounds.height,
      walls: new Set(),
      objects,
      hoverTile,
      hoverPath: hoverEnemy ? null : hoverPath,
      reachable: moveHighlight,
      playerAttackTiles: new Set(),
      monsterReachable: new Map(),
      monsterAttackTiles: new Set(),
      now,
    });

    const background = ctx.createLinearGradient(0, 0, 0, currentLayout.sh);
    background.addColorStop(0, '#10151f');
    background.addColorStop(0.55, '#07100d');
    background.addColorStop(1, '#050608');

    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, currentLayout.sw, currentLayout.sh);

    drawSidebar(currentLayout);
    clearThreeBoardViewport(currentLayout);

    drawMenu(currentLayout);
    draw.drawButton(currentLayout.sw - 48, 16, 32, 32, '⚙️', () => {
      state.game.menuOpen = !state.game.menuOpen;
    }, {
      fill: '#111827', hoverFill: '#1f2937', stroke: '#64748b', font: '16px Inter, sans-serif',
    });
    drawBanner(currentLayout);
 
    if (DEBUG_CONFIG.SHOW_STATS) {
      drawStats(currentLayout);
    }
 
    ctx.restore();

    canvas.style.cursor = game.busy
      ? 'default'
      : (
          layout.hoveredButton() ||
          hoverEnemy ||
          (hoverTile && reachable.has(posKey(hoverTile)))
        )
        ? 'pointer'
        : 'default';
  }

  function render() {
    requestAnimationFrame(render);

    state.game.buttons = [];
    const now = performance.now();

    const currentLayout = layout.getLayout();
    
    if (state.game.phase !== PHASES.ENERGY) {
      state.game.energyConfirmStartTime = null;
      state.game.energyConfirmed = false;
    }

    if (state.game.mode === GAME_MODES.OVERWORLD) {
      threeBoard.setVisible?.(true);
      drawOverworld(currentLayout, now);
      return;
    }

    threeBoard.setVisible?.(true);

    const walls = levelWallsSet(state.game.levelIndex);
    const reachable = actions.getReachableTiles();
    const playerAttackTiles = actions.getPlayerAttackTiles();
    const hoverTile = layout.hoveredTile();
    const hoverMonster = layout.hoveredMonster();
    const attackMode = state.game.phase === PHASES.HERO && !!state.game.selectedAttackId && !state.game.busy;
    const showMoveHints =
      state.game.phase === PHASES.HERO &&
      !state.game.busy &&
      !attackMode &&
      (layout.hoveredPlayer() || (hoverTile && reachable.has(posKey(hoverTile))));
    const hoverPath =
      showMoveHints && hoverTile && reachable.has(posKey(hoverTile))
        ? reachable.get(posKey(hoverTile)).path
        : null;

    let monsterReachable = new Map();
    let monsterAttackTiles = new Set();
    if (hoverMonster && !state.game.busy && !attackMode) {
       monsterReachable = actions.getMonsterReachableTiles(hoverMonster.id);
       monsterAttackTiles = actions.getMonsterAttackTiles(hoverMonster.id);
    }

    threeBoard.render({
      currentLayout,
      walls,
      hoverTile,
      hoverPath,
      reachable,
      playerAttackTiles,
      monsterReachable,
      monsterAttackTiles,
      now,
    });

    let screenShakeX = 0;
    let screenShakeY = 0;
    let screenFlashRed = false;

    const playerShakeAnim = state.game.animations.find(a => a.type === 'damageShake' && a.entityId === 'player');
    if (playerShakeAnim) {
       const p = (now - playerShakeAnim.startTime) / playerShakeAnim.duration;
       if (p >= 0 && p <= 1) {
           screenShakeX += Math.sin(p * Math.PI * 10) * 16;
           screenShakeY += Math.sin(p * Math.PI * 13) * 12;
           if (Math.floor(p * 12) % 2 === 0) screenFlashRed = true;
       }
    }

    ctx.save();
    if (screenShakeX !== 0 || screenShakeY !== 0) {
        ctx.translate(screenShakeX, screenShakeY);
    }

    const background = ctx.createLinearGradient(0, 0, 0, currentLayout.sh);
    background.addColorStop(0, '#151922');
    background.addColorStop(0.55, '#080a0f');
    background.addColorStop(1, '#050608');
    ctx.fillStyle = background;
    ctx.fillRect(-20, -20, currentLayout.sw + 40, currentLayout.sh + 40);

    drawSidebar(currentLayout);
    draw.roundRect(
      currentLayout.boardX - 14,
      currentLayout.boardY - 14,
      currentLayout.boardW + 28,
      currentLayout.boardH + 28,
      24,
      '#0c111b',
      '#374151'
    );

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const rect = layout.tileRect(currentLayout, x, y);
        const key = `${x},${y}`;
        const isWall = walls.has(key);
        const monster = state.game.monsters.find((currentMonster) => currentMonster.x === x && currentMonster.y === y);

        if (isWall) draw.drawWallTile(rect);
        else draw.drawFloorTile(rect, x, y);

        if (!isWall && playerAttackTiles.has(key) && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(244,114,182,0.14)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(244,114,182,0.85)';
          ctx.lineWidth = 4;
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
          ctx.lineWidth = 1;
        } else if (!isWall && showMoveHints && reachable.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(34,211,238,0.18)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(103,232,249,0.5)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        } else if (!isWall && monsterAttackTiles.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(239,68,68,0.24)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(248,113,113,0.55)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        } else if (!isWall && monsterReachable.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(34,197,94,0.18)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(74,222,128,0.45)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        }

      }
    }

    if (hoverMonster && monsterAttackTiles.has(posKey(hoverMonster))) {
      const hoverRect = layout.tileRect(currentLayout, hoverMonster.x, hoverMonster.y);
      ctx.strokeStyle = 'rgba(248,113,113,0.95)';
      ctx.lineWidth = 4;
      ctx.strokeRect(hoverRect.x + 4, hoverRect.y + 4, hoverRect.w - 8, hoverRect.h - 8);
    }

    if (hoverPath && hoverPath.length > 1) {
      ctx.strokeStyle = 'rgba(34,211,238,0.98)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();

      hoverPath.forEach((point, index) => {
        const rect = layout.tileRect(currentLayout, point.x, point.y);
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;

        if (index === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });

      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    if (attackMode && hoverTile && playerAttackTiles.has(posKey(hoverTile))) {
      const hoverRect = layout.tileRect(currentLayout, hoverTile.x, hoverTile.y);
      ctx.strokeStyle = 'rgba(251,207,232,0.95)';
      ctx.lineWidth = 5;
      ctx.strokeRect(hoverRect.x + 4, hoverRect.y + 4, hoverRect.w - 8, hoverRect.h - 8);
    }

    // now is computed at the top

    state.game.animations = state.game.animations.filter((anim) => isAnimationActive(anim, now));

    for (const monster of state.game.monsters) {
      let drawX = monster.x;
      let drawY = monster.y;
      
      const monsterAnim = state.game.animations.find((a) => a.type === 'movement' && a.entityId === monster.id);
      if (monsterAnim) {
        const elapsed = now - monsterAnim.startTime;
        if (elapsed >= 0) {
          const tileIndex = Math.floor(elapsed / monsterAnim.durationPerTile);
          const tileProgress = (elapsed % monsterAnim.durationPerTile) / monsterAnim.durationPerTile;
          if (tileIndex < monsterAnim.path.length - 1) {
            const p1 = monsterAnim.path[tileIndex];
            const p2 = monsterAnim.path[tileIndex + 1];
            drawX = p1.x + (p2.x - p1.x) * tileProgress;
            drawY = p1.y + (p2.y - p1.y) * tileProgress;
          } else {
            const last = monsterAnim.path[monsterAnim.path.length - 1];
            drawX = last.x;
            drawY = last.y;
          }
        }
      }

      const rect = layout.tileRect(currentLayout, drawX, drawY);
      
      let pixelOffsetX = 0;
      let pixelOffsetY = 0;
      let flashRed = false;

      const bumpAnim = state.game.animations.find(a => a.type === 'bumpAttack' && a.entityId === monster.id);
      if (bumpAnim) {
         const p = (now - bumpAnim.startTime) / bumpAnim.duration;
         const dx = bumpAnim.targetX - monster.x;
         const dy = bumpAnim.targetY - monster.y;
         const len = Math.sqrt(dx*dx + dy*dy) || 1;
         let bump = 0;
         if (p < 0.25) bump = -0.25 * (p / 0.25);
         else if (p < 0.5) bump = -0.25 + 1.25 * ((p - 0.25) / 0.25);
         else bump = 1.0 * (1 - ((p - 0.5) / 0.5));
         pixelOffsetX += (dx / len) * bump * 40;
         pixelOffsetY += (dy / len) * bump * 40;
      }

      const shakeAnim = state.game.animations.find(a => a.type === 'damageShake' && a.entityId === monster.id);
      if (shakeAnim) {
         const p = (now - shakeAnim.startTime) / shakeAnim.duration;
         pixelOffsetX += Math.sin(p * Math.PI * 10) * 6;
         if (Math.floor(p * 10) % 2 === 0) flashRed = true;
      }

      rect.x += pixelOffsetX;
      rect.y += pixelOffsetY;

      draw.drawUnitCardToken(monster, rect, false, flashRed);
    }

    let drawPlayerX = state.game.player.x;
    let drawPlayerY = state.game.player.y;

    const playerAnim = state.game.animations.find((a) => a.type === 'movement' && a.entityId === 'player');
    if (playerAnim) {
      const elapsed = now - playerAnim.startTime;
      if (elapsed >= 0) {
        const tileIndex = Math.floor(elapsed / playerAnim.durationPerTile);
        const tileProgress = (elapsed % playerAnim.durationPerTile) / playerAnim.durationPerTile;

        if (tileIndex < playerAnim.path.length - 1) {
          const p1 = playerAnim.path[tileIndex];
          const p2 = playerAnim.path[tileIndex + 1];
          drawPlayerX = p1.x + (p2.x - p1.x) * tileProgress;
          drawPlayerY = p1.y + (p2.y - p1.y) * tileProgress;
        } else {
          const last = playerAnim.path[playerAnim.path.length - 1];
          drawPlayerX = last.x;
          drawPlayerY = last.y;
        }
      }
    }

    const playerRect = layout.tileRect(currentLayout, drawPlayerX, drawPlayerY);

    let playerOffsetX = 0;
    let playerOffsetY = 0;

    const playerBumpAnim = state.game.animations.find(a => a.type === 'bumpAttack' && a.entityId === 'player');
    if (playerBumpAnim) {
       const p = (now - playerBumpAnim.startTime) / playerBumpAnim.duration;
       if (p >= 0 && p <= 1) {
           const dx = playerBumpAnim.targetX - state.game.player.x;
           const dy = playerBumpAnim.targetY - state.game.player.y;
           const len = Math.sqrt(dx*dx + dy*dy) || 1;
           let bump = 0;
           if (p < 0.25) bump = -0.25 * (p / 0.25);
           else if (p < 0.5) bump = -0.25 + 1.25 * ((p - 0.25) / 0.25);
           else bump = 1.0 * (1 - ((p - 0.5) / 0.5));
           playerOffsetX += (dx / len) * bump * 40;
           playerOffsetY += (dy / len) * bump * 40;
       }
    }

    playerRect.x += playerOffsetX;
    playerRect.y += playerOffsetY;

    draw.drawUnitCardToken(state.game.player, playerRect, true, false);

    clearThreeBoardViewport(currentLayout);

    drawFloatingTextAnimations(currentLayout, now);
    drawDesktopTurnQueue(currentLayout, now);
    drawHoveredEntityTooltip(currentLayout);
    drawMenu(currentLayout);
    drawCombatBottomUI(currentLayout, now);

    // Top right settings button
    draw.drawButton(currentLayout.sw - 48, 16, 32, 32, '⚙️', () => {
      state.game.menuOpen = !state.game.menuOpen;
    }, {
      fill: '#111827', hoverFill: '#1f2937', stroke: '#64748b', font: '16px Inter, sans-serif',
    });

    drawCarriedAttack();
    
    drawEnergyFocusMask(currentLayout);
    drawBanner(currentLayout);
    
    if (DEBUG_CONFIG.SHOW_STATS) {
      drawStats(currentLayout);
    }
    
    ctx.restore();

    if (screenFlashRed) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.fillRect(0, 0, currentLayout.sw, currentLayout.sh);
    }

    canvas.style.cursor = state.game.draggingDie
      ? 'grabbing'
      : (
          layout.hoveredButton() ||
          layout.hoveredDraggableDie() ||
          (hoverTile && reachable.has(posKey(hoverTile))) ||
          (hoverTile && playerAttackTiles.has(posKey(hoverTile)))
        )
        ? 'pointer'
        : 'default';
  }

  let frameCount = 0;
  let lastTime = performance.now();
  let currentFps = 0;

  function drawStats(currentLayout) {
    frameCount += 1;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastTime = now;
    }

    const x = 16;
    const y = currentLayout.sh - 40;
    const w = 210;
    const h = 24;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    
    draw.drawText(`FPS: ${currentFps}`, x + 10, y + 17, {
      font: 'bold 12px Inter, sans-serif',
      color: '#34d399',
    });
    
    const zoomPct = Math.round((state.debugZoom || 1.0) * 100);
    draw.drawText(`ZOOM: ${zoomPct}%`, x + 65, y + 17, {
      font: 'bold 12px Inter, sans-serif',
      color: '#fbbf24',
    });

    // Simple memory check for Chrome
    if (window.performance && window.performance.memory) {
      const mb = Math.round(window.performance.memory.usedJSHeapSize / 1048576);
      draw.drawText(`MEM: ${mb}MB`, x + 145, y + 17, {
        font: 'bold 12px Inter, sans-serif',
        color: '#60a5fa',
      });
    }
    ctx.restore();
  }

  return {
    start() {
      render();
    },
  };
}
