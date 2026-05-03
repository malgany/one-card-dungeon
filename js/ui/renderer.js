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

const UI_THEME = {
  bg0: '#070807',
  bg1: '#0d0f0b',
  bg2: '#14150f',
  surface0: '#171912',
  surface1: '#202219',
  surface2: '#29291f',
  border0: '#4a4638',
  border1: '#6f6342',
  accent: '#d39b32',
  accentDark: '#8f6724',
  success: '#5f8f54',
  successDark: '#3f6f45',
  danger: '#b94735',
  dangerDark: '#7b2d23',
  text: '#f2ead7',
  textMuted: '#c9bea5',
  textDim: '#8f8773',
  overlay: 'rgba(7,8,7,0.94)',
};

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

  if (
    anim.type === 'floatingText' ||
    anim.type === 'bumpAttack' ||
    anim.type === 'damageShake' ||
    anim.type === 'modelAction'
  ) {
    return startTime + Math.max(0, anim.duration || 0);
  }

  return startTime;
}

function isAnimationActive(anim, now) {
  return now < getAnimationEndTime(anim);
}

export function createRenderer({ canvas, ctx, cardImages, state, actions, layout, onExitToMainMenu = null }) {
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

  function getPlayerName(game) {
    return game?.player?.name || 'Aventureiro';
  }

  function getPlayerCardImage(game) {
    return cardImages[game?.player?.characterType] || cardImages.player;
  }

  function getBannerCardImage(banner, game) {
    if (banner.cardKey === 'player') return getPlayerCardImage(game);
    return cardImages[banner.cardKey] || null;
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
    ctx.fillStyle = '#3b1c18';
    ctx.fill();

    ctx.save();
    beginHeartPath(cx, cy, size);
    ctx.clip();
    const top = cy - size * 0.48;
    const height = size * 0.86;
    const fillY = top + height * (1 - ratio);
    const gradient = ctx.createLinearGradient(cx, fillY, cx, top + height);
    gradient.addColorStop(0, '#cf6b55');
    gradient.addColorStop(1, UI_THEME.danger);
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - size * 0.62, fillY, size * 1.24, height * ratio);
    ctx.restore();

    ctx.lineWidth = Math.max(2, size * 0.045);
    ctx.strokeStyle = '#d8a06e';
    beginHeartPath(cx, cy, size);
    ctx.stroke();

    draw.drawText(String(hp), cx, cy + size * 0.04, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.28)}px Inter, sans-serif`,
      color: UI_THEME.text,
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
    ctx.fillStyle = UI_THEME.accentDark;
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = '#d9c894';
    ctx.stroke();
    draw.drawText(String(value), cx, cy + size * 0.08, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.42)}px Inter, sans-serif`,
      color: UI_THEME.text,
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
    ctx.fillStyle = UI_THEME.success;
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.strokeStyle = '#b6c79a';
    ctx.stroke();
    draw.drawText(String(value), cx, cy + size * 0.07, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(size * 0.42)}px Inter, sans-serif`,
      color: UI_THEME.text,
    });
    ctx.restore();
  }

  function drawClockIcon(cx, cy, radius, color = UI_THEME.textMuted) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(23,25,18,0.88)';
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

  function drawShadowedText(text, x, y, options = {}, shadowColor = 'rgba(0,0,0,0.85)') {
    ctx.save();
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = options.shadowBlur ?? 0;
    ctx.shadowOffsetX = options.shadowOffsetX ?? 1;
    ctx.shadowOffsetY = options.shadowOffsetY ?? 1;
    draw.drawText(text, x, y, options);
    ctx.restore();
  }

  function heroTurnPalette(activeTurn, remainingMs = 0) {
    if (!activeTurn) {
      return {
        timerText: UI_THEME.textDim,
        timerTrack: 'rgba(41,41,31,0.9)',
        timerFill: UI_THEME.border0,
        timerBorder: UI_THEME.border0,
        buttonFillTop: '#343226',
        buttonFillMid: UI_THEME.surface2,
        buttonFillBottom: UI_THEME.surface1,
        buttonStroke: UI_THEME.border0,
        buttonText: UI_THEME.textMuted,
      };
    }

    if (remainingMs <= 5000) {
      return {
        timerText: '#e9b5a7',
        timerTrack: 'rgba(75,28,22,0.92)',
        timerFill: UI_THEME.danger,
        timerBorder: UI_THEME.dangerDark,
        buttonFillTop: '#e0b35e',
        buttonFillMid: UI_THEME.accent,
        buttonFillBottom: UI_THEME.accentDark,
        buttonStroke: '#e6c06f',
        buttonText: UI_THEME.text,
      };
    }

    if (remainingMs <= 15000) {
      return {
        timerText: '#d9c894',
        timerTrack: 'rgba(71,54,24,0.92)',
        timerFill: UI_THEME.accent,
        timerBorder: UI_THEME.accentDark,
        buttonFillTop: '#e0b35e',
        buttonFillMid: UI_THEME.accent,
        buttonFillBottom: UI_THEME.accentDark,
        buttonStroke: '#e6c06f',
        buttonText: UI_THEME.text,
      };
    }

    return {
      timerText: '#b6c79a',
      timerTrack: 'rgba(28,49,31,0.94)',
      timerFill: UI_THEME.success,
      timerBorder: UI_THEME.successDark,
      buttonFillTop: '#e0b35e',
      buttonFillMid: UI_THEME.accent,
      buttonFillBottom: UI_THEME.accentDark,
      buttonStroke: '#e6c06f',
      buttonText: UI_THEME.text,
    };
  }

  function drawHeroTurnControl(x, y, w, now, compact = false) {
    const game = state.game;
    const activeTurn = game.phase === PHASES.HERO;
    const heroTimer = activeTurn ? actions.getHeroTurnTimer(now) : null;
    const expired = !!(activeTurn && heroTimer && heroTimer.remainingMs <= 0 && !game.busy);
    if (expired) {
      actions.endHeroPhase();
    }

    const clickable = activeTurn && !game.busy && !expired;
    const palette = heroTurnPalette(activeTurn, heroTimer?.remainingMs ?? 0);
    const outerPad = compact ? 5 : 6;
    const controlH = compact ? 64 : 84;
    const headerH = compact ? 20 : 24;
    const headerY = y + outerPad;
    const headerX = x + outerPad;
    const headerW = w - outerPad * 2;
    const panelRadius = compact ? 6 : 8;
    const badgeW = compact ? 34 : 38;
    const badgeH = compact ? 18 : 20;
    const timerH = compact ? 16 : 18;
    const progressH = compact ? 3 : 4;
    const badgeX = headerX + 3;
    const badgeY = headerY + Math.floor((headerH - badgeH) / 2);
    const timerX = badgeX + badgeW + (compact ? 6 : 8);
    const timerY = headerY + Math.floor((headerH - timerH) / 2);
    const timerW = Math.max(54, headerX + headerW - timerX - (compact ? 4 : 6));
    const buttonX = x + outerPad;
    const buttonW = w - outerPad * 2;
    const buttonY = headerY + headerH + (compact ? 5 : 6);
    const buttonH = Math.max(compact ? 24 : 34, y + controlH - buttonY - outerPad);
    const buttonActive = activeTurn && !game.busy && !expired;
    const hovered = clickable && layout.pointInRect(state.mouse.x, state.mouse.y, { x, y, w, h: controlH });
    const buttonGradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonH);
    const buttonTop = buttonActive && hovered ? '#f0c978' : (buttonActive ? palette.buttonFillTop : '#343226');
    const buttonMid = buttonActive && hovered ? '#d39b32' : (buttonActive ? palette.buttonFillMid : UI_THEME.surface2);
    const buttonBottom = buttonActive && hovered ? '#73501d' : (buttonActive ? palette.buttonFillBottom : UI_THEME.surface1);

    buttonGradient.addColorStop(0, buttonTop);
    buttonGradient.addColorStop(0.52, buttonMid);
    buttonGradient.addColorStop(1, buttonBottom);

    draw.roundRect(x, y, w, controlH, panelRadius, UI_THEME.overlay, 'rgba(111,99,66,0.72)');
    draw.roundRect(headerX, headerY, headerW, headerH, 5, 'rgba(32,34,25,0.92)', 'rgba(74,70,56,0.95)');

    draw.roundRect(badgeX, badgeY, badgeW, badgeH, 4, 'rgba(23,25,18,0.95)', 'rgba(111,99,66,0.9)');
    drawClockIcon(badgeX + 10, badgeY + badgeH / 2, Math.max(4.5, badgeH * 0.24), UI_THEME.textMuted);
    drawShadowedText(String(game.turnCount), badgeX + badgeW - 10, badgeY + badgeH / 2 + 4, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.max(10, Math.floor(badgeH * 0.55))}px Inter, sans-serif`,
      color: UI_THEME.text,
    }, 'rgba(0,0,0,0.9)');

    draw.roundRect(timerX, timerY, timerW, timerH, 10, palette.timerTrack, palette.timerBorder);

    if (activeTurn && heroTimer) {
      const innerPad = compact ? 3 : 4;
      const innerX = timerX + innerPad;
      const innerY = timerY + innerPad;
      const innerW = Math.max(0, timerW - innerPad * 2);
      const innerH = Math.max(0, timerH - innerPad * 2);
      const barH = progressH;
      const barY = timerY + timerH - barH - (compact ? 2 : 3);
      const barW = Math.max(0, timerW - 14);
      const fillW = Math.min(barW, Math.max(2, barW * heroTimer.progress));

      draw.roundRect(innerX, innerY, innerW, innerH, 4, 'rgba(7,8,7,0.55)', null);

      draw.roundRect(timerX + 7, barY, barW, barH, barH / 2, 'rgba(23,25,18,0.78)', null);
      if (fillW > 0) {
        draw.roundRect(timerX + 7, barY, fillW, barH, barH / 2, palette.timerFill, null);
      }

      drawShadowedText(`${heroTimer.remainingSeconds}s`, timerX + timerW / 2, timerY + timerH / 2 + (compact ? 1 : 2), {
        align: 'center',
        baseline: 'middle',
        font: `900 ${compact ? 13 : 15}px Inter, sans-serif`,
        color: palette.timerText,
      }, 'rgba(0,0,0,0.85)');
    } else {
      drawShadowedText('AGUARDE', timerX + timerW / 2, timerY + timerH / 2 + (compact ? 1 : 2), {
        align: 'center',
        baseline: 'middle',
        font: `900 ${compact ? 11 : 13}px Inter, sans-serif`,
        color: palette.timerText,
      }, 'rgba(0,0,0,0.85)');
    }

    draw.roundRect(buttonX, buttonY, buttonW, buttonH, 6, buttonGradient, buttonActive ? palette.buttonStroke : UI_THEME.border0);
    if (buttonActive) {
      draw.roundRect(buttonX + 2, buttonY + 2, buttonW - 4, Math.max(4, Math.floor(buttonH * 0.24)), 4, 'rgba(242,234,215,0.14)', null);
    }

    drawShadowedText('FIM DE TURNO', buttonX + buttonW / 2, buttonY + buttonH / 2 + (compact ? 2 : 3), {
      align: 'center',
      baseline: 'middle',
      font: `900 ${compact ? 11 : 15}px Inter, sans-serif`,
      color: buttonActive ? palette.buttonText : UI_THEME.textMuted,
    }, 'rgba(0,0,0,0.9)');

    if (buttonActive) {
      state.game.buttons.push({ x: buttonX, y: buttonY, w: buttonW, h: buttonH, onClick: actions.endHeroPhase });
    }
  }

  function drawSidebar(currentLayout) {
    const game = state.game;
    const x = currentLayout.leftX;
    const y = currentLayout.leftY;
    const w = currentLayout.leftW;
    const h = currentLayout.leftH;

    draw.roundRect(x, y, w, h, 8, UI_THEME.surface1, '#0b0c08');
    const inOverworld = game.mode === GAME_MODES.OVERWORLD;
    const worldMap = inOverworld ? getCurrentWorldMap(game.overworld) : null;
    const worldMapState = inOverworld ? getCurrentWorldMapState(game.overworld) : null;
    
    let cy = y + 40;
    draw.drawText('ONE CARD', x + w / 2, cy, {
      align: 'center', font: 'bold 28px Inter, sans-serif', color: UI_THEME.textDim,
    });
    cy += 30;
    draw.drawText(inOverworld ? 'WORLD' : 'DUNGEON', x + w / 2, cy, {
      align: 'center', font: 'bold 28px Inter, sans-serif', color: UI_THEME.textDim,
    });
    
    cy += 36;
    const progressLabel = inOverworld
      ? `${worldMapState?.enemies?.length || 0} inimigos em ${worldMap?.name || 'mapa'}`
      : `Nível ${LEVELS[game.levelIndex].id}/12 • Vez ${game.turnCount}`;
    draw.drawText(progressLabel, x + w / 2, cy, {
      align: 'center', font: 'bold 18px Inter, sans-serif', color: UI_THEME.accent,
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
      align: 'center', font: 'bold 22px Inter, sans-serif', color: '#d9c894',
    });

    cy += 16;
    const totals = actions.getTotals();
    const topMargin = 90;
    const availableW = w - 32;
    const barW = w - 32;
    const barH = 40;
    const barX = x + 16;
    draw.roundRect(barX, cy, barW, barH, 6, 'rgba(23,25,18,0.95)', UI_THEME.border0);
    
    const statItemW = barW / 5;
    const statsArray = [
      { icon: '⚡', val: game.apRemaining ?? totals.ap, color: UI_THEME.accent },
      { icon: '🏃', val: game.speedRemaining ?? totals.speed, color: '#b6c79a' },
      { icon: '⚔️', val: totals.attack, color: '#e0b35e' },
      { icon: '🛡️', val: totals.defense, color: '#b8ac86' },
      { icon: '🎯', val: totals.range, color: '#cf8a43' }
    ];
    
    statsArray.forEach((stat, i) => {
      const cx = barX + (i * statItemW) + statItemW / 2;
      draw.drawText(stat.icon, cx - 12, cy + 26, { align: 'center', font: '16px Inter, sans-serif' });
      draw.drawText(String(stat.val), cx + 10, cy + 26, { align: 'center', font: 'bold 16px Inter, sans-serif', color: stat.color });
    });

    cy += barH + 30;

    if (game.lastEvent && !inOverworld) {
      draw.drawText(game.lastEvent, x + w / 2, cy, {
        align: 'center', font: 'italic 14px Inter, sans-serif', color: UI_THEME.textMuted, maxWidth: w - 24,
      });
      cy += 30;
    }

    game.diceRects = [];
    game.dropZones = [];

    if (game.phase === PHASES.ENERGY) {
      draw.drawText('Dados rolados', x + w / 2, cy, {
        align: 'center', font: '20px Inter, sans-serif', color: UI_THEME.textMuted,
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
            fill: UI_THEME.accentDark, hoverFill: UI_THEME.accent, stroke: '#e6c06f',
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
          fill: UI_THEME.successDark, hoverFill: UI_THEME.success, stroke: '#b6c79a',
          disabled: game.busy, font: 'bold 14px Inter, sans-serif',
        });
      });
    }

    if (game.phase === PHASES.WON || game.phase === PHASES.LOST) {
      draw.drawButton(x + 24, cy, w - 48, 48, 'Novo jogo', actions.newGame, {
        fill: UI_THEME.accentDark, hoverFill: UI_THEME.accent, stroke: '#e6c06f',
      });
      cy += 60;
      draw.drawButton(x + 24, cy, w - 48, 48, 'Carregar', actions.loadGame, {
        fill: UI_THEME.surface1, hoverFill: UI_THEME.surface2, stroke: UI_THEME.border1,
      });
    }

    if (DEBUG_CONFIG.SHOW_STATS && !currentLayout.compact) {
      drawDebugPanel(x + 12, y + h - 230, w - 24);
    }
  }

  function drawMenu(currentLayout) {
    if (!state.game.menuOpen) return;

    const menuView = state.game.menuView || 'main';
    const optionsTab = state.game.optionsTab || 'how-to';
    const w = menuView === 'options' ? 420 : 220;
    const h = menuView === 'options' ? 300 : 142;
    const x = (currentLayout.sw - w) / 2;
    const y = (currentLayout.sh - h) / 2;

    draw.roundRect(x, y, w, h, 8, UI_THEME.overlay, UI_THEME.border1);
    draw.drawText(menuView === 'options' ? 'Opções' : 'Menu', x + w / 2, y + 30, {
      align: 'center',
      font: 'bold 17px Inter, sans-serif',
      color: UI_THEME.text,
    });

    if (menuView === 'main') {
      draw.drawButton(x + 18, y + 48, w - 36, 34, 'Opções', () => {
        state.game.menuView = 'options';
        state.game.optionsTab = state.game.optionsTab || 'how-to';
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
      draw.drawButton(x + 18, y + 92, w - 36, 34, 'Sair', () => {
        state.game.menuOpen = false;
        state.game.menuView = 'main';
        onExitToMainMenu?.();
      }, {
        fill: UI_THEME.dangerDark,
        hoverFill: UI_THEME.danger,
        stroke: '#fca5a5',
      });
      return;
    }

    draw.drawButton(x + w - 38, y + 9, 28, 26, '×', () => {
      state.game.menuOpen = false;
      state.game.menuView = 'main';
    }, {
      fill: UI_THEME.surface1,
      hoverFill: UI_THEME.surface2,
      stroke: UI_THEME.border1,
    });

    const tabs = [
      ['how-to', 'Como jogar'],
      ['sound', 'Sons'],
      ['game', 'Jogo'],
    ];
    const tabY = y + 48;
    const tabGap = 8;
    const tabW = (w - 36 - tabGap * (tabs.length - 1)) / tabs.length;
    tabs.forEach(([id, label], index) => {
      const active = optionsTab === id;
      draw.drawButton(x + 18 + index * (tabW + tabGap), tabY, tabW, 32, label, () => {
        state.game.optionsTab = id;
      }, {
        fill: active ? UI_THEME.accentDark : UI_THEME.surface1,
        hoverFill: active ? UI_THEME.accent : UI_THEME.surface2,
        stroke: active ? '#e6c06f' : UI_THEME.border1,
        font: 'bold 12px Inter, sans-serif',
      });
    });

    const contentX = x + 24;
    const contentY = y + 104;
    const contentW = w - 48;

    if (optionsTab === 'how-to') {
      draw.drawText('Guia de regras e controles', contentX, contentY + 6, {
        align: 'left',
        font: 'bold 16px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawButton(contentX, contentY + 34, contentW, 38, 'Como jogar', () => {
        state.game.menuOpen = false;
        state.game.menuView = 'main';
        const modal = document.getElementById('tutorial-modal');
        if (modal) modal.style.display = 'flex';
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
    } else if (optionsTab === 'sound') {
      const volume = actions.getOverworldMusicVolume?.() ?? 0.5;
      const percent = Math.round(volume * 100);
      const sliderX = contentX;
      const sliderY = contentY + 80;
      const sliderW = contentW;
      const sliderH = 24;
      const trackY = sliderY + sliderH / 2;
      const knobX = sliderX + sliderW * volume;

      function setVolumeFromMouse(mouseX) {
        const nextVolume = clamp((mouseX - sliderX) / sliderW, 0, 1);
        actions.setOverworldMusicVolume?.(nextVolume);
      }

      draw.drawText('Volume da música', contentX, contentY + 6, {
        align: 'left',
        font: 'bold 16px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawText(`${percent}%`, x + w - 24, contentY + 6, {
        align: 'right',
        font: 'bold 16px Inter, sans-serif',
        color: UI_THEME.accent,
      });
      draw.drawText('Volume da música do jogo como um todo.', contentX, contentY + 34, {
        align: 'left',
        font: '13px Inter, sans-serif',
        color: UI_THEME.textMuted,
        maxWidth: contentW,
      });

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = UI_THEME.border1;
      ctx.fillStyle = 'rgba(32,34,25,0.92)';
      draw.roundRect(sliderX, trackY - 4, sliderW, 8, 4, 'rgba(32,34,25,0.92)', UI_THEME.border1);
      draw.roundRect(sliderX, trackY - 4, Math.max(8, knobX - sliderX), 8, 4, UI_THEME.accentDark, null);
      draw.roundRect(knobX - 9, trackY - 11, 18, 22, 6, '#d6b36e', '#f3d79a');
      ctx.restore();

      state.game.buttons.push({
        x: sliderX,
        y: sliderY,
        w: sliderW,
        h: sliderH,
        onClick: () => setVolumeFromMouse(state.mouse.x),
        onDragStart: () => setVolumeFromMouse(state.mouse.x),
        onDrag: (mouseX) => setVolumeFromMouse(mouseX),
      });
    } else {
      draw.drawText('Modos de jogo', contentX, contentY + 6, {
        align: 'left',
        font: 'bold 16px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawButton(contentX, contentY + 34, contentW, 38, 'Dungeon legada', () => {
        state.game.menuOpen = false;
        state.game.menuView = 'main';
        actions.newDungeonLegacyGame();
      }, {
        fill: UI_THEME.surface1,
        hoverFill: UI_THEME.surface2,
        stroke: UI_THEME.border1,
      });
    }

    draw.drawButton(x + 18, y + h - 46, w - 36, 34, 'Voltar', () => {
      state.game.menuView = 'main';
    }, {
      fill: UI_THEME.surface1,
      hoverFill: UI_THEME.surface2,
      stroke: UI_THEME.border1,
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

    draw.roundRect(uiX, bottomY + 10, 72, 50, 6, 'rgba(23,25,18,0.88)', UI_THEME.border0);
    draw.drawText('HP', uiX + 36, bottomY + 30, {
      align: 'center',
      font: 'bold 12px Inter, sans-serif',
      color: '#d89a82',
    });
    draw.drawText(`${hp}/${maxHp}`, uiX + 36, bottomY + 50, {
      align: 'center',
      font: 'bold 17px Inter, sans-serif',
      color: UI_THEME.text,
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
        ? 'rgba(23,25,18,0.52)'
        : selected
          ? UI_THEME.accentDark
          : hovered && !attackDisabled
            ? '#73501d'
            : UI_THEME.surface1;
      const stroke = selected ? '#e6c06f' : filled ? UI_THEME.accentDark : UI_THEME.border0;

      draw.roundRect(sx, slotsY, slotSize, slotSize, 6, fill, stroke);

      if (filled) {
        draw.drawText('ATQ', sx + slotSize / 2, slotsY + 26, {
          align: 'center',
          font: 'bold 12px Inter, sans-serif',
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.text,
        });
        draw.drawText(String(attack.apCost), sx + slotSize - 11, slotsY + slotSize - 7, {
          align: 'center',
          font: 'bold 10px Inter, sans-serif',
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.accent,
        });

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: actions.toggleAttackSelection });
        }
      } else {
        draw.drawText('+', sx + slotSize / 2, slotsY + 29, {
          align: 'center',
          font: '20px Inter, sans-serif',
          color: UI_THEME.border0,
        });
      }
    }

    const btnW = Math.min(156, uiW * 0.48);
    const btnX = uiX + uiW - btnW;
    drawHeroTurnControl(btnX, bottomY + 68, btnW, now, true);
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
    ctx.fillStyle = '#3f352b';
    ctx.fill();

    // Fill red portion based on HP
    if (hp > 0 && maxHp > 0) {
      ctx.save();
      ctx.clip(); 
      const fillPercent = hp / maxHp;
      const fillHeight = h * fillPercent;
      const startY = h - fillHeight;
      
      ctx.fillStyle = UI_THEME.danger;
      ctx.fillRect(-w / 2, startY, w, fillHeight);
      ctx.restore();
    }

    // Stroke heart
    ctx.strokeStyle = UI_THEME.border0;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Text inside heart
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = UI_THEME.text;
    ctx.font = 'bold 18px Inter, sans-serif';
    
    // Draw current hp
    ctx.fillText(hp, 0, h * 0.35);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(-10, h * 0.5);
    ctx.lineTo(10, h * 0.5);
    ctx.strokeStyle = UI_THEME.text;
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
        ? 'rgba(23,25,18,0.52)'
        : selected
          ? UI_THEME.accentDark
          : hovered && !attackDisabled
            ? '#73501d'
            : UI_THEME.surface1;
      const stroke = selected ? '#e6c06f' : filled ? UI_THEME.accentDark : UI_THEME.border0;

      draw.roundRect(sx, slotsY, slotSize, slotSize, 6, fill, stroke);

      if (filled) {
        draw.drawText('✊', sx + slotSize / 2, slotsY + 34, {
          align: 'center',
          font: '28px Inter, sans-serif',
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.text,
        });
        draw.drawText(String(attack.apCost), sx + slotSize - 12, slotsY + slotSize - 8, {
          align: 'center',
          font: 'bold 11px Inter, sans-serif',
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.accent,
        });

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: actions.toggleAttackSelection });
        }
      } else {
        draw.drawText('+', sx + slotSize / 2, slotsY + 36, {
          align: 'center',
          font: '22px Inter, sans-serif',
          color: UI_THEME.border0,
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
         const bgColor = isCurrent ? UI_THEME.success : UI_THEME.surface0;
         const borderColor = UI_THEME.border1;

         const boxSize = isCurrent ? queueW + 8 : queueW;
         const yOffset = isCurrent ? -4 : 0;
         const bx = currentX;
         
         draw.roundRect(bx, queueY + yOffset, boxSize, boxSize, 6, bgColor, borderColor);
         draw.drawText(icon, bx + boxSize / 2, queueY + yOffset + boxSize / 2 + 8, {
            align: 'center', font: isCurrent ? '30px Inter' : '24px Inter'
         });

         draw.roundRect(bx - 8, queueY + yOffset - 8, 20, 20, 6, UI_THEME.surface1, borderColor);
         draw.drawText(`${i + 1}`, bx + 2, queueY + yOffset + 6, {
            align: 'center', font: 'bold 12px Inter, sans-serif', color: UI_THEME.text
         });

         currentX += (queueW + queueSpacing);
      }
    }

    const btnW = Math.min(156, currentLayout.boardW * 0.48);
    const btnX = currentLayout.boardX + currentLayout.boardW - btnW;
    drawHeroTurnControl(btnX, bottomY + 68, btnW, now, true);
  }

  function drawPlayerResourceHud(x, y, scale = 1) {
    const game = state.game;
    const width = 154 * scale;
    const height = 94 * scale;
    const heartSize = 74 * scale;
    const heartCx = x + width / 2;
    const heartCy = y + 38 * scale;

    draw.roundRect(x, y + 8 * scale, width, height - 8 * scale, 8 * scale, 'rgba(23,25,18,0.74)', UI_THEME.border0);
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
    ctx.strokeStyle = disabled ? UI_THEME.textDim : UI_THEME.accent;
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
      ctx.fillStyle = UI_THEME.textMuted;
      ctx.fill();
      draw.drawText('FEITICOS', x + 20, y + 13, {
        font: '700 12px Inter, sans-serif',
        color: UI_THEME.textMuted,
      });
    }

    for (let index = 0; index < slotCount; index += 1) {
      const sx = x + index * (slotSize + slotGap);
      const slot = { x: sx, y: slotsY, w: slotSize, h: slotSize };
      const hovered = layout.pointInRect(state.mouse.x, state.mouse.y, slot);
      const filled = index === 0;
      const selected = filled && attackSelected;
      const fill = !filled
        ? 'rgba(23,25,18,0.48)'
        : selected
          ? UI_THEME.accentDark
          : hovered && !attackDisabled
            ? '#73501d'
            : UI_THEME.surface1;
      const stroke = selected ? '#e6c06f' : filled ? UI_THEME.accent : UI_THEME.border0;

      draw.roundRect(sx, slotsY, slotSize, slotSize, Math.min(6, slotSize * 0.18), fill, stroke);

      if (filled) {
        draw.drawText('\u270A', sx + slotSize / 2, slotsY + slotSize * 0.62, {
          align: 'center',
          font: `${Math.floor(slotSize * 0.52)}px Inter, sans-serif`,
          color: attackDisabled ? UI_THEME.textDim : UI_THEME.text,
        });

        if (!attackDisabled) {
          state.game.buttons.push({ ...slot, onClick: actions.toggleAttackSelection });
        }
      } else {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(sx + slotSize / 2, slotsY + slotSize / 2, Math.max(2, slotSize * 0.06), 0, Math.PI * 2);
        ctx.fillStyle = UI_THEME.border0;
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
          name: getPlayerName(game),
          hp: game.player.health,
          maxHp: game.player.maxHealth,
          emoji: '\uD83E\uDDD9',
          tint: UI_THEME.success,
        };
      }

      const monster = game.monsters.find((currentMonster) => currentMonster.id === entityId);
      if (!monster) return null;
      return {
        id: monster.id,
        name: monster.name,
        hp: monster.hp,
        maxHp: monster.maxHp,
        emoji: monster.emoji,
        tint: monster.tint,
      };
    }).filter(Boolean);
  }

  function turnQueueWidth(game, itemSize, gap) {
    const entryCount = turnQueueEntries(game).length;
    return (entryCount + 1) * itemSize + entryCount * gap + 8;
  }

  function drawTurnQueueHpBar(x, y, w, h, hp, maxHp) {
    const ratio = maxHp > 0 ? clamp(hp / maxHp, 0, 1) : 0;
    const fillColor = UI_THEME.danger;
    const fillTop = '#cf6b55';
    const trackRadius = 2;

    draw.roundRect(x, y, w, h, trackRadius, 'rgba(41,18,15,0.92)', 'rgba(185,71,53,0.22)');

    const innerPad = 1;
    const innerX = x + innerPad;
    const innerY = y + innerPad;
    const innerW = Math.max(0, w - innerPad * 2);
    const innerH = Math.max(0, h - innerPad * 2);
    const fillH = Math.max(0, innerH * ratio);

    if (fillH > 0) {
      const fillY = innerY + innerH - fillH;
      const gradient = ctx.createLinearGradient(innerX, fillY, innerX, fillY + fillH);
      gradient.addColorStop(0, fillTop);
      gradient.addColorStop(1, fillColor);

      ctx.save();
      draw.roundRect(innerX, innerY, innerW, innerH, Math.max(1, Math.min(innerW, innerH) / 2), null, null);
      ctx.clip();
      ctx.fillStyle = gradient;
      ctx.fillRect(innerX, fillY, innerW, fillH);
      ctx.restore();
    }
  }

  function drawTurnQueue(x, y, itemSize, gap, now, compact = false) {
    const game = state.game;
    const entries = turnQueueEntries(game);
    if (entries.length === 0) return;

    const clockW = itemSize;
    const clockH = itemSize;
    const cardRadius = compact ? 4 : 5;
    draw.roundRect(x, y, clockW, clockH, cardRadius, 'rgba(23,25,18,0.88)', UI_THEME.border0);
    draw.drawText(String(game.turnCount), x + itemSize * 0.28, y + itemSize / 2 + 1, {
      align: 'center',
      baseline: 'middle',
      font: `900 ${Math.floor(itemSize * 0.34)}px Inter, sans-serif`,
      color: UI_THEME.text,
    });
    drawClockIcon(x + itemSize * 0.73, y + itemSize / 2, Math.max(4, itemSize * 0.17), '#d9c894');

    let currentX = x + clockW + gap;
    for (const entry of entries) {
      const isCurrent = entry.id === game.turnQueue?.[0];
      const bx = currentX;
      const cardX = bx;
      const cardY = y;
      const cardSize = itemSize;
      const hpBarW = compact ? 3 : 4;
      const contentPad = compact ? 2 : 3;
      const hpBarH = Math.max(10, cardSize - (compact ? 6 : 8));
      const hpBarX = cardX + cardSize - hpBarW - contentPad;
      const hpBarY = cardY + Math.floor((cardSize - hpBarH) / 2);
      const contentCx = cardX + (cardSize - hpBarW - contentPad * 2) / 2;
      const contentCy = cardY + cardSize / 2;
      const fill = isCurrent ? 'rgba(154,122,50,0.34)' : 'rgba(23,25,18,0.78)';
      const stroke = isCurrent ? UI_THEME.accent : UI_THEME.border0;

      draw.roundRect(cardX, cardY, cardSize, cardSize, cardRadius, fill, stroke);
      drawTurnQueueHpBar(hpBarX, hpBarY, hpBarW, hpBarH, entry.hp, entry.maxHp);
      draw.drawText(entry.emoji || 'P', contentCx, contentCy + 1, {
        align: 'center',
        baseline: 'middle',
        font: `700 ${Math.floor(cardSize * 0.52)}px Inter, sans-serif`,
        color: UI_THEME.text,
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

    drawTurnQueue(x, y, itemSize, gap, now, false);
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
      drawTurnQueue(uiX, bottomY + 78, queueItem, queueGap, now, true);

      const btnW = Math.min(156, uiW * 0.48);
      drawHeroTurnControl(uiX + uiW - btnW, bottomY + 68, btnW, now, true);
      return;
    }

    const uiX = currentLayout.sidebarW + 24;
    const uiW = currentLayout.sw - currentLayout.sidebarW - 48;
    const tight = uiW < 760;
    const hudScale = tight ? 0.74 : 0.88;
    const hudW = drawPlayerResourceHud(uiX, bottomY + 15, hudScale);
    const btnW = tight ? 162 : 182;
    const btnX = uiX + uiW - btnW;
    const btnY = bottomY + 18;
    const spellX = uiX + hudW + 18;
    const spellAvailableW = Math.max(150, btnX - spellX - 18);

    drawSpellBar(spellX, bottomY + 20, spellAvailableW, tight ? 40 : 46, 8, true);
    drawHeroTurnControl(btnX, btnY, btnW, now, false);
  }

  function drawSelectedEntityModal(currentLayout) {
    const game = state.game;
    const playerSelected = !!layout.hoveredPlayer();
    const monster = playerSelected ? null : layout.hoveredMonster();
    if (!playerSelected && !monster) return;

    const tile = playerSelected ? game.player : monster;

    const rect = layout.tileRect(currentLayout, tile.x, tile.y);
    const totals = actions.getTotals();
    const image = playerSelected ? getPlayerCardImage(game) : cardImages[monster.type];
    const title = playerSelected ? getPlayerName(game) : monster.name;
    const titleIcon = playerSelected ? '🧙' : monster.emoji;
    const attackLine = totals.attackLifeSteal > 0
      ? `Ataque ${totals.attack} | suga ${totals.attackLifeSteal}`
      : `Ataque ${totals.attack}`;
    const lines = playerSelected
      ? [
          `Vida ${game.player.health}/${game.player.maxHealth}`,
          `AP ${game.apRemaining}/${game.player.apMax} | ${totals.attackName} custa ${totals.attackCost} AP`,
          `Movimento ${game.speedRemaining}/${game.player.speedBase} | só em cruz`,
          attackLine,
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

    draw.roundRect(x, y, width, height, 8, UI_THEME.overlay, UI_THEME.border1);
    draw.roundRect(x + 12, y + 27, cardW, cardH, 8, UI_THEME.surface0, '#d6a85c');

    ctx.save();
    draw.roundRect(x + 16, y + 31, cardW - 8, cardH - 8, 6, null, null);
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
      color: UI_THEME.text,
    });

    const icons = playerSelected
      ? ['❤️', '🏃', '⚔️', '🛡️', '🎯']
      : ['❤️', '⚔️', '🛡️', '🎯', '🏃'];

    for (let index = 0; index < lines.length; index += 1) {
      draw.drawText(icons[index] || '', textX + 2, y + 80 + index * 22, {
        font: '14px Inter, sans-serif',
        color: UI_THEME.text,
      });
      draw.drawText(lines[index], textX + 26, y + 80 + index * 22, {
        font: '13px Inter, sans-serif',
        color: UI_THEME.textMuted,
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
    const name = playerHovered ? getPlayerName(game) : monster.name;
    const hp = playerHovered ? game.player.health : monster.hp;
    const point = screenPointForTile(currentLayout, entity.x, entity.y, 1.28);
    const label = `${name} | ${hp} \u2665`;

    ctx.save();
    ctx.font = '800 13px Inter, sans-serif';
    const width = Math.min(currentLayout.sw - 24, Math.max(118, ctx.measureText(label).width + 26));
    const height = 30;
    const x = clamp(point.x - width / 2, 12, currentLayout.sw - width - 12);
    const y = clamp(point.y - 34, 12, currentLayout.sh - height - 12);

    draw.roundRect(x, y, width, height, 6, 'rgba(7,8,7,0.92)', '#d9c894');
    draw.drawText(label, x + width / 2, y + 20, {
      align: 'center',
      font: '800 13px Inter, sans-serif',
      color: UI_THEME.text,
    });
    ctx.restore();
  }

  function drawFloatingTextAnimations(currentLayout, now) {
    state.game.animations.forEach((anim) => {
      if (anim.type !== 'floatingText' || now < anim.startTime) return;

      const progress = (now - anim.startTime) / anim.duration;
      const point = screenPointForTile(currentLayout, anim.x, anim.y, 1.18);
      const isDamage = anim.color === '#ef4444' || anim.color === UI_THEME.danger;
      const fontSize = isDamage ? 38 : 28;
      const lift = (isDamage ? 54 : 42) * progress;
      const cx = point.x;
      const cy = point.y - lift;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.pow(progress, 2.6));
      ctx.strokeStyle = 'rgba(23,25,18,0.92)';
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
    const accent = banner.accent || UI_THEME.accent;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (hasCard) {
      const cardImage = getBannerCardImage(banner, state.game);
      const cardW = 118;
      const cardH = 150;
      const cardX = panelX + 20;
      const cardY = panelY + (panelH - cardH) / 2;
      const textX = cardX + cardW + 24;
      const textW = panelW - (textX - panelX) - 20;

      draw.roundRect(panelX, panelY, panelW, panelH, 10, 'rgba(7,8,7,0.86)', accent);
      draw.roundRect(cardX - 8, cardY - 8, cardW + 16, cardH + 16, 8, 'rgba(0,0,0,0.35)', null);
      draw.roundRect(cardX, cardY, cardW, cardH, 8, UI_THEME.surface0, accent);

      ctx.save();
      draw.roundRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8, 6, null, null);
      ctx.clip();
      const drew = draw.drawImageCover(cardImage, cardX + 4, cardY + 4, cardW - 8, cardH - 8);
      if (!drew) {
        draw.drawText(banner.subtitle || banner.title, cardX + cardW / 2, cardY + cardH / 2 + 8, {
          align: 'center',
          font: 'bold 18px Inter, sans-serif',
          color: UI_THEME.text,
          maxWidth: cardW - 16,
        });
      }
      ctx.restore();

      draw.drawText(banner.title, textX, panelY + 62, {
        align: 'left',
        font: 'bold 30px Inter, sans-serif',
        color: UI_THEME.text,
        maxWidth: textW,
      });

      if (banner.subtitle) {
        draw.drawText(banner.subtitle, textX, panelY + 102, {
          align: 'left',
          font: '16px Inter, sans-serif',
          color: UI_THEME.textMuted,
          maxWidth: textW,
        });
      }
    } else {
      ctx.lineWidth = 3;
      draw.roundRect(panelX, panelY, panelW, panelH, 10, 'rgba(7,8,7,0.8)', accent);
      draw.drawText(banner.title, cx, cy - 12, {
        align: 'center',
        font: 'bold 32px Inter, sans-serif',
        color: UI_THEME.text,
      });

      if (banner.subtitle) {
        draw.drawText(banner.subtitle, cx, cy + 25, {
          align: 'center',
          font: '16px Inter, sans-serif',
          color: UI_THEME.textMuted,
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
    draw.roundRect(x, y, size, size, 6, UI_THEME.accentDark, '#e6c06f');
    draw.drawText('✊', x + size / 2, y + 25, {
      align: 'center',
      font: '22px Inter, sans-serif',
      color: UI_THEME.text,
    });
    ctx.restore();
  }

  function drawEnergyFocusMask(currentLayout) {
    if (state.game.phase !== PHASES.ENERGY) return;

    const maskX = currentLayout.boardX - 18;
    const maskW = currentLayout.sw - maskX;
    const gradient = ctx.createLinearGradient(maskX, 0, currentLayout.sw, 0);
    gradient.addColorStop(0, 'rgba(13,15,11,0.54)');
    gradient.addColorStop(0.35, 'rgba(10,11,8,0.66)');
    gradient.addColorStop(1, 'rgba(7,8,7,0.78)');

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(maskX, 0, maskW, currentLayout.sh);
    ctx.restore();
  }

  function drawOverworldChat(currentLayout) {
    const game = state.game;
    const log = (game.eventLog || []).slice(-4);
    if (!log || log.length === 0) return;

    const viewport = threeBoard.getViewport(currentLayout);
    const chatW = Math.min(280, viewport.w - 16);
    const lineH = 18;
    const padV = 8;
    const padH = 10;
    const chatH = log.length * lineH + padV * 2;
    const chatX = viewport.x + 8;
    const chatY = viewport.y + viewport.h - chatH - 10;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(7, 8, 7, 0.34)';
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(chatX + r, chatY);
    ctx.lineTo(chatX + chatW - r, chatY);
    ctx.quadraticCurveTo(chatX + chatW, chatY, chatX + chatW, chatY + r);
    ctx.lineTo(chatX + chatW, chatY + chatH - r);
    ctx.quadraticCurveTo(chatX + chatW, chatY + chatH, chatX + chatW - r, chatY + chatH);
    ctx.lineTo(chatX + r, chatY + chatH);
    ctx.quadraticCurveTo(chatX, chatY + chatH, chatX, chatY + chatH - r);
    ctx.lineTo(chatX, chatY + r);
    ctx.quadraticCurveTo(chatX, chatY, chatX + r, chatY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    log.forEach((entry, i) => {
      const alpha = 0.45 + 0.55 * ((i + 1) / log.length);
      ctx.globalAlpha = alpha;
      ctx.font = `italic ${i === log.length - 1 ? 'bold ' : ''}12px Inter, sans-serif`;
      ctx.fillStyle = i === log.length - 1 ? UI_THEME.text : UI_THEME.textMuted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const ty = chatY + padV + i * lineH + lineH / 2;
      const maxW = chatW - padH * 2;
      const text = ctx.measureText(entry).width > maxW
        ? entry.slice(0, Math.floor(entry.length * maxW / ctx.measureText(entry).width) - 1) + '…'
        : entry;
      ctx.fillText(text, chatX + padH, ty);
    });

    ctx.globalAlpha = 1;
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
      connections: worldMap.connections,
      hoverTile,
      hoverPath: hoverEnemy ? null : hoverPath,
      reachable: moveHighlight,
      playerAttackTiles: new Set(),
      monsterReachable: new Map(),
      monsterAttackTiles: new Set(),
      now,
    });

    const background = ctx.createLinearGradient(0, 0, 0, currentLayout.sh);
    background.addColorStop(0, UI_THEME.bg2);
    background.addColorStop(0.55, UI_THEME.bg1);
    background.addColorStop(1, UI_THEME.bg0);

    ctx.save();
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, currentLayout.sw, currentLayout.sh);

    clearThreeBoardViewport(currentLayout);

    drawMenu(currentLayout);
    draw.drawButton(currentLayout.sw - 48, 16, 32, 32, '⚙️', () => {
      state.game.menuOpen = !state.game.menuOpen;
    }, {
      fill: UI_THEME.surface0, hoverFill: UI_THEME.surface1, stroke: UI_THEME.border1, font: '16px Inter, sans-serif',
    });
    drawOverworldChat(currentLayout);
    drawBanner(currentLayout);
 
    if (DEBUG_CONFIG.SHOW_STATS) {
      drawDebugPanel(16, 60, 190);
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

    ctx.save();

    const background = ctx.createLinearGradient(0, 0, 0, currentLayout.sh);
    background.addColorStop(0, UI_THEME.bg2);
    background.addColorStop(0.55, UI_THEME.bg1);
    background.addColorStop(1, UI_THEME.bg0);
    ctx.fillStyle = background;
    ctx.fillRect(-20, -20, currentLayout.sw + 40, currentLayout.sh + 40);

    drawSidebar(currentLayout);
    draw.roundRect(
      currentLayout.boardX - 14,
      currentLayout.boardY - 14,
      currentLayout.boardW + 28,
      currentLayout.boardH + 28,
      24,
      '#10110c',
      UI_THEME.border0
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
          ctx.fillStyle = 'rgba(185,71,53,0.18)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(207,107,85,0.85)';
          ctx.lineWidth = 4;
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
          ctx.lineWidth = 1;
        } else if (!isWall && showMoveHints && reachable.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(95,143,84,0.2)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(182,199,154,0.55)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        } else if (!isWall && monsterAttackTiles.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(185,71,53,0.26)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(207,107,85,0.58)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        } else if (!isWall && monsterReachable.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(95,143,84,0.18)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(182,199,154,0.48)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        }

      }
    }

    if (hoverMonster && monsterAttackTiles.has(posKey(hoverMonster))) {
      const hoverRect = layout.tileRect(currentLayout, hoverMonster.x, hoverMonster.y);
      ctx.strokeStyle = 'rgba(207,107,85,0.95)';
      ctx.lineWidth = 4;
      ctx.strokeRect(hoverRect.x + 4, hoverRect.y + 4, hoverRect.w - 8, hoverRect.h - 8);
    }

    if (hoverPath && hoverPath.length > 1) {
      ctx.strokeStyle = 'rgba(182,199,154,0.98)';
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
      ctx.strokeStyle = 'rgba(230,192,111,0.95)';
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
      fill: UI_THEME.surface0, hoverFill: UI_THEME.surface1, stroke: UI_THEME.border1, font: '16px Inter, sans-serif',
    });

    drawCarriedAttack();
    
    drawEnergyFocusMask(currentLayout);
    drawBanner(currentLayout);
    
    if (DEBUG_CONFIG.SHOW_STATS) {
      drawStats(currentLayout);
    }
    
    ctx.restore();

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
    ctx.fillStyle = 'rgba(7, 8, 7, 0.78)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = UI_THEME.success;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    
    draw.drawText(`FPS: ${currentFps}`, x + 10, y + 17, {
      font: 'bold 12px Inter, sans-serif',
      color: UI_THEME.success,
    });
    
    const zoomPct = Math.round((state.debugZoom || 1.15) * 100);
    draw.drawText(`ZOOM: ${zoomPct}%`, x + 65, y + 17, {
      font: 'bold 12px Inter, sans-serif',
      color: UI_THEME.accent,
    });

    // Simple memory check for Chrome
    if (window.performance && window.performance.memory) {
      const mb = Math.round(window.performance.memory.usedJSHeapSize / 1048576);
      draw.drawText(`MEM: ${mb}MB`, x + 145, y + 17, {
        font: 'bold 12px Inter, sans-serif',
        color: '#b8ac86',
      });
    }
    ctx.restore();
  }

  function drawDebugPanel(x, y, w) {
    let cy = y;
    
    draw.roundRect(x, cy, w, 220, 8, 'rgba(23,25,18,0.88)', UI_THEME.border0);
    
    cy += 20;
    draw.drawText('AJUSTES VISUAIS', x + w / 2, cy, { align: 'center', font: '900 11px Inter, sans-serif', color: UI_THEME.textDim });
    cy += 24;

    const controls = [
      { label: 'Expos.', key: 'exposure', step: 0.1, min: 0.1, max: 3.0 },
      { label: 'Amb.', key: 'ambientIntensity', step: 0.1, min: 0, max: 3.0 },
      { label: 'Dir.', key: 'keyIntensity', step: 0.1, min: 0, max: 5.0 },
      { label: 'Névoa', key: 'fogDensity', step: 0.005, min: 0, max: 0.1 },
    ];

    controls.forEach(ctrl => {
      const val = state.visuals[ctrl.key];
      draw.drawText(`${ctrl.label}: ${val.toFixed(3)}`, x + 12, cy + 14, { font: '10px Inter, sans-serif', color: UI_THEME.textDim });
      
      draw.drawButton(x + w - 52, cy, 20, 18, '-', () => {
        state.visuals[ctrl.key] = Math.max(ctrl.min, state.visuals[ctrl.key] - ctrl.step);
      }, { fill: UI_THEME.surface1, stroke: UI_THEME.border0, font: 'bold 12px Inter' });

      draw.drawButton(x + w - 28, cy, 20, 18, '+', () => {
        state.visuals[ctrl.key] = Math.min(ctrl.max, state.visuals[ctrl.key] + ctrl.step);
      }, { fill: UI_THEME.surface1, stroke: UI_THEME.border0, font: 'bold 12px Inter' });

      cy += 24;
    });

    cy += 8;
    const shadowLabel = state.visuals.shadowMapEnabled ? 'Sombras: ON' : 'Sombras: OFF';
    draw.drawButton(x + 10, cy, (w / 2) - 14, 22, shadowLabel, () => {
      state.visuals.shadowMapEnabled = !state.visuals.shadowMapEnabled;
    }, { fill: state.visuals.shadowMapEnabled ? UI_THEME.successDark : UI_THEME.surface1, stroke: UI_THEME.border0, font: 'bold 9px Inter' });

    const outlineLabel = state.visuals.showOutlines ? 'Bordas: ON' : 'Bordas: OFF';
    draw.drawButton(x + (w / 2) + 4, cy, (w / 2) - 14, 22, outlineLabel, () => {
      state.visuals.showOutlines = !state.visuals.showOutlines;
    }, { fill: state.visuals.showOutlines ? UI_THEME.successDark : UI_THEME.surface1, stroke: UI_THEME.border0, font: 'bold 9px Inter' });
  }

  return {
    start() {
      render();
    },
  };
}
