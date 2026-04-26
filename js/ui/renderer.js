import { BOARD_SIZE, LEVELS, PHASES, STAT_META } from '../config/game-data.js';
import { levelWallsSet, posKey, samePos } from '../game/board-logic.js';
import { createDrawPrimitives } from './draw-primitives.js';

export function createRenderer({ canvas, ctx, cardImages, state, actions, layout }) {
  const draw = createDrawPrimitives({ ctx, state, cardImages });

  function drawSidebar(currentLayout) {
    const game = state.game;
    const x = currentLayout.leftX;
    const y = currentLayout.leftY;
    const w = currentLayout.leftW;
    const h = currentLayout.leftH;

    draw.roundRect(x, y, w, h, 20, '#1e2328', '#111827');
    
    let cy = y + 40;
    draw.drawText('ONE CARD', x + w / 2, cy, {
      align: 'center', font: 'bold 28px Inter, sans-serif', color: '#94a3b8',
    });
    cy += 30;
    draw.drawText('DUNGEON', x + w / 2, cy, {
      align: 'center', font: 'bold 28px Inter, sans-serif', color: '#94a3b8',
    });
    
    cy += 36;
    draw.drawText(`Nível ${LEVELS[game.levelIndex].id}/12 • Turno ${game.turnCount}`, x + w / 2, cy, {
      align: 'center', font: 'bold 18px Inter, sans-serif', color: '#facc15',
    });

    const phaseName = {
      energy: 'ENERGIA',
      hero: 'AVENTUREIRO',
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
      { icon: '❤️', val: `${game.player.health}/${game.player.maxHealth}`, color: '#ef4444' },
      { icon: '🏃', val: game.speedRemaining || totals.speed, color: '#34d399' },
      { icon: '⚔️', val: game.attackRemaining || totals.attack, color: '#fbbf24' },
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

    if (game.phase === PHASES.ENERGY || game.phase === PHASES.HERO) {
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
        draw.drawButton(x + 32, cy, btnW, 56, 'Confirmar Energia', actions.confirmEnergy, {
          fill: '#b45309', hoverFill: '#d97706', stroke: '#fcd34d',
          disabled: game.busy || !actions.allDiceAssigned(),
          font: 'bold 22px Inter, sans-serif', color: '#fffbeb',
        });
        
        draw.drawText('Movimento: Reto = 2 vel | Diagonal = 3 vel', x + w / 2, cy + 78, { align: 'center', font: '13px Inter, sans-serif', color: '#fbbf24' });

        if (game.draggingDie) {
          draw.drawDieToken(
            state.mouse.x - game.draggingDie.offsetX,
            state.mouse.y - game.draggingDie.offsetY,
            64, game.roll[game.draggingDie.dieIndex], game.draggingDie.dieIndex
          );
        }
      } else if (game.phase === PHASES.HERO) {
        draw.drawButton(x + 32, cy, btnW, 56, 'Encerrar Turno', actions.endHeroPhase, {
          fill: '#7c2d12', hoverFill: '#9a3412', stroke: '#fdba74',
          disabled: game.busy, font: 'bold 22px Inter, sans-serif',
        });
        
        cy += 74;
        draw.drawText('Passe o mouse no herói para ver', x + w / 2, cy, { align: 'center', font: '14px Inter, sans-serif', color: '#94a3b8' });
        draw.drawText('movimento. Clique em inimigos', x + w / 2, cy + 20, { align: 'center', font: '14px Inter, sans-serif', color: '#94a3b8' });
        draw.drawText('destacados para atacar.', x + w / 2, cy + 40, { align: 'center', font: '14px Inter, sans-serif', color: '#94a3b8' });
        
        draw.drawText('Movimento: Reto = 2 vel | Diagonal = 3 vel', x + w / 2, cy + 65, { align: 'center', font: '13px Inter, sans-serif', color: '#fbbf24' });
      }
    }

    if (game.phase === PHASES.LEVELUP) {
      const options = [
        ['❤️ Curar', 'heal'],
        ['🏃 +1 Velocidade', 'speed'],
        ['⚔️ +1 Ataque', 'attack'],
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

    draw.drawButton(x + w - 44, y + h - 44, 32, 32, '⚙️', () => {
      state.game.menuOpen = !state.game.menuOpen;
    }, {
      fill: '#111827', hoverFill: '#1f2937', stroke: '#64748b', font: '16px Inter, sans-serif',
    });
  }

  function drawMenu(currentLayout) {
    if (!state.game.menuOpen) return;

    const w = 190;
    const h = 176;
    const x = currentLayout.leftX + currentLayout.leftW - 20;
    const y = currentLayout.leftY + 54;

    draw.roundRect(x, y, w, h, 20, 'rgba(5,8,14,0.96)', '#64748b');
    draw.drawText('Menu', x + 18, y + 30, {
      font: 'bold 17px Inter, sans-serif',
      color: '#f8fafc',
    });
    draw.drawButton(x + 18, y + 48, w - 36, 34, 'Salvar jogo', actions.saveGame, {
      fill: '#1f2937',
      hoverFill: '#374151',
      stroke: '#64748b',
    });
    draw.drawButton(x + 18, y + 90, w - 36, 34, 'Carregar jogo', actions.loadGame, {
      fill: '#1f2937',
      hoverFill: '#374151',
      stroke: '#64748b',
    });
    draw.drawButton(x + 18, y + 132, w - 36, 34, 'Novo jogo', actions.newGame, {
      fill: '#611818',
      hoverFill: '#7f1d1d',
      stroke: '#fca5a5',
    });
  }

  function drawHoverStats(currentLayout) {
    const monster = layout.hoveredMonster();
    const playerHover = layout.hoveredPlayer();
    if (!monster && !playerHover) return;

    const game = state.game;
    const tile = playerHover ? game.player : monster;
    const rect = layout.tileRect(currentLayout, tile.x, tile.y);

    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const drawMiniStat = (x, y, text, bgColor, color = '#fff', alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();
      ctx.strokeStyle = `rgba(0,0,0,${0.8 * alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.fillText(text, x, y + 1);
      ctx.restore();
    };

    if (playerHover) {
      const attack = game.phase === PHASES.HERO ? game.attackRemaining : game.player.attackBase + game.assignment.attack;
      const speed = game.phase === PHASES.HERO ? game.speedRemaining : game.player.speedBase + game.assignment.speed;
      
      drawMiniStat(rect.x - 4, rect.y + rect.h / 2, `${attack}`, '#ca8a04');
      drawMiniStat(rect.x + rect.w + 4, rect.y + rect.h / 2, `${speed}`, '#16a34a');
    } else {
      const attackable = actions.getAttackableMonsters();
      if (game.phase === PHASES.HERO && attackable.has(monster.id)) {
        const attack = game.attackRemaining;
        const defense = monster.defense;
        
        const loopDuration = 1800;
        const t = (performance.now() % loopDuration) / loopDuration;
        const x_center = rect.x + rect.w / 2;
        const y_center = rect.y - 36;
        
        let atkOffsetX = -20;
        let defOffsetX = 20;
        let atkAlpha = 1;
        let defAlpha = 1;

        if (t > 0.2 && t <= 0.4) {
           const p = Math.pow((t - 0.2) / 0.2, 2); 
           atkOffsetX = -20 + (10 * p); 
        } else if (t > 0.4) {
           atkOffsetX = -10;
        }

        if (t > 0.4 && t <= 0.8) {
           const p = (t - 0.4) / 0.4;
           if (attack >= defense) {
              defOffsetX = 20 + (20 * p);
              defAlpha = 1 - p;
           } else {
              atkOffsetX = -10 - (20 * p);
              atkAlpha = 1 - p;
           }
        } else if (t > 0.8) {
           const p = (t - 0.8) / 0.2;
           atkAlpha = attack >= defense ? 1 - p : 0;
           defAlpha = attack >= defense ? 0 : 1 - p;
        }
        
        if (atkAlpha > 0) drawMiniStat(x_center + atkOffsetX, y_center, `${attack}`, '#ca8a04', '#fff', atkAlpha);
        if (defAlpha > 0) drawMiniStat(x_center + defOffsetX, y_center, `${defense}`, '#2563eb', '#fff', defAlpha);
      } else {
        drawMiniStat(rect.x - 4, rect.y + rect.h / 2, `${monster.attack}`, '#ca8a04');
        drawMiniStat(rect.x + rect.w + 4, rect.y + rect.h / 2, `${monster.defense}`, '#2563eb');
      }
    }
  }

  function drawTurnQueue(currentLayout) {
    const game = state.game;
    if (!game.turnQueue || game.turnQueue.length === 0) return;

    const queueW = 48;
    const queueSpacing = 16;
    let queueY = currentLayout.boardY - 65;
    if (queueY < 10) queueY = 10; // Prevent cutting off on small screens
    
    let currentX = currentLayout.boardX + currentLayout.boardW - queueW;
    // Prevent cutting off on the right
    if (currentX + queueW > currentLayout.sw - 10) currentX = currentLayout.sw - 10 - queueW;

    for (let i = 0; i < game.turnQueue.length; i++) {
       const entityId = game.turnQueue[i];
       let icon;

       if (entityId === 'player') {
          icon = '🧙';
       } else {
          const monster = game.monsters.find(m => m.id === entityId);
          if (!monster) continue;
          icon = monster.emoji;
       }

       const isCurrent = i === 0;
       const bgColor = isCurrent ? '#4ade80' : '#111827'; // Light green for current
       const borderColor = '#64748b'; // Neutral color for border

       const boxSize = isCurrent ? queueW + 8 : queueW;
       const yOffset = isCurrent ? -4 : 0;
       const bx = currentX - (isCurrent ? 4 : 0);
       
       draw.roundRect(bx, queueY + yOffset, boxSize, boxSize, 8, bgColor, borderColor);
       draw.drawText(icon, bx + boxSize / 2, queueY + yOffset + boxSize / 2 + 8, {
          align: 'center', font: isCurrent ? '30px Inter' : '24px Inter'
       });

       draw.roundRect(bx - 8, queueY + yOffset - 8, 20, 20, 10, '#1f2937', borderColor);
       draw.drawText(`${i + 1}`, bx + 2, queueY + yOffset + 6, {
          align: 'center', font: 'bold 12px Inter, sans-serif', color: '#fff'
       });

       currentX -= (queueW + queueSpacing);
    }
  }

  function drawSelectedEntityModal(currentLayout) {
    const game = state.game;
    const selected = game.selectedEntity;
    if (!selected) return;

    let tile, playerSelected, monster;
    if (selected.type === 'player') {
      playerSelected = true;
      tile = game.player;
    } else {
      playerSelected = false;
      monster = game.monsters.find(m => m.id === selected.id);
      if (!monster) return;
      tile = monster;
    }

    const rect = layout.tileRect(currentLayout, tile.x, tile.y);
    const totals = actions.getTotals();
    const image = playerSelected ? cardImages.player : cardImages[monster.type];
    const title = playerSelected ? 'Aventureiro' : monster.name;
    const titleIcon = playerSelected ? '🧙' : monster.emoji;
    const lines = playerSelected
      ? [
          `Vida ${game.player.health}/${game.player.maxHealth}`,
          `Velocidade ${game.player.speedBase} + ${game.assignment.speed} | Restante ${game.speedRemaining} (~${Math.floor(game.speedRemaining / 2)} casas)`,
          `Ataque ${game.player.attackBase} + ${game.assignment.attack} | Restante ${game.attackRemaining}`,
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

    const cardW = 144;
    const cardH = 192;
    const width = 420;
    const height = 230;
    let x = rect.x + rect.w + 14;
    let y = rect.y + 8;

    if (x + width > currentLayout.sw - 18) x = rect.x - width - 14;
    if (y + height > currentLayout.sh - 10) {
      y = currentLayout.sh - height - 14;
    }

    draw.roundRect(x, y, width, height, 18, 'rgba(5,8,14,0.95)', '#64748b');
    draw.roundRect(x + 14, y + 18, cardW, cardH, 12, '#111827', '#d6a85c');

    ctx.save();
    draw.roundRect(x + 18, y + 22, cardW - 8, cardH - 8, 10, null, null);
    ctx.clip();

    const drew = draw.drawImageCover(image, x + 18, y + 22, cardW - 8, cardH - 8);
    if (!drew) {
      draw.drawText(titleIcon, x + 18 + cardW / 2, y + 22 + cardH / 2 + 15, {
        align: 'center',
        font: '56px Inter, sans-serif',
      });
    }

    ctx.restore();

    const textX = x + cardW + 32;
    draw.drawText(`${titleIcon} ${title}`, textX, y + 36, {
      font: 'bold 19px Inter, sans-serif',
      color: '#f8fafc',
    });

    const icons = playerSelected
      ? ['❤️', '🏃', '⚔️', '🛡️', '🎯']
      : ['❤️', '⚔️', '🛡️', '🎯', '🏃'];

    for (let index = 0; index < lines.length; index += 1) {
      draw.drawText(icons[index], textX + 2, y + 74 + index * 26, {
        font: '16px Inter, sans-serif',
        color: '#fff',
      });
      draw.drawText(lines[index], textX + 28, y + 74 + index * 26, {
        font: '15px Inter, sans-serif',
        color: '#cbd5e1',
      });
    }
  }

  function drawBanner(currentLayout) {
    const banner = state.game.banner;
    if (!banner) return;

    const now = performance.now();
    const remaining = Math.max(0, banner.until - now);
    const alpha = Math.min(1, remaining / 250);

    ctx.save();
    ctx.globalAlpha = alpha;
    draw.roundRect(
      currentLayout.sw / 2 - 260,
      currentLayout.sh / 2 - 74,
      520,
      148,
      26,
      'rgba(0,0,0,0.76)',
      '#facc15'
    );
    draw.drawText(banner.title, currentLayout.sw / 2, currentLayout.sh / 2 - 12, {
      align: 'center',
      font: 'bold 32px Inter, sans-serif',
      color: '#f8fafc',
    });

    if (banner.subtitle) {
      draw.drawText(banner.subtitle, currentLayout.sw / 2, currentLayout.sh / 2 + 25, {
        align: 'center',
        font: '16px Inter, sans-serif',
        color: '#cbd5e1',
      });
    }

    ctx.restore();
  }

  function render() {
    requestAnimationFrame(render);

    state.game.buttons = [];
    const now = performance.now();

    const currentLayout = layout.getLayout();
    const walls = levelWallsSet(state.game.levelIndex);
    const reachable = actions.getReachableTiles();
    const attackable = actions.getAttackableMonsters();
    const hoverTile = layout.hoveredTile();
    const hoverMonster = layout.hoveredMonster();
    const showMoveHints =
      state.game.phase === PHASES.HERO &&
      !state.game.busy &&
      (layout.hoveredPlayer() || (hoverTile && reachable.has(posKey(hoverTile))));
    const hoverPath =
      showMoveHints && hoverTile && reachable.has(posKey(hoverTile))
        ? reachable.get(posKey(hoverTile)).path
        : null;

    let screenShakeX = 0;
    let screenShakeY = 0;
    let screenFlashRed = false;

    const playerShakeAnim = state.game.animations.find(a => a.type === 'damageShake' && a.entityId === 'player');
    if (playerShakeAnim) {
       const p = (now - playerShakeAnim.startTime) / playerShakeAnim.duration;
       if (p >= 0 && p <= 1) {
           screenShakeX += Math.sin(p * Math.PI * 10) * 12;
           screenShakeY += Math.sin(p * Math.PI * 13) * 8;
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

        if (!isWall && showMoveHints && reachable.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
          ctx.fillStyle = 'rgba(34,211,238,0.18)';
          ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
          ctx.strokeStyle = 'rgba(103,232,249,0.5)';
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        }

        if (monster && attackable.has(monster.id)) {
          ctx.strokeStyle = 'rgba(244,114,182,0.95)';
          ctx.lineWidth = 4;
          ctx.strokeRect(rect.x + 5, rect.y + 5, rect.w - 10, rect.h - 10);
        }
      }
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

    if (hoverMonster && attackable.has(hoverMonster.id)) {
      const playerRect = layout.tileRect(currentLayout, state.game.player.x, state.game.player.y);
      const monsterRect = layout.tileRect(currentLayout, hoverMonster.x, hoverMonster.y);
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = 'rgba(244,114,182,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(playerRect.x + playerRect.w / 2, playerRect.y + playerRect.h / 2);
      ctx.lineTo(monsterRect.x + monsterRect.w / 2, monsterRect.y + monsterRect.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // now is computed at the top

    state.game.animations = state.game.animations.filter((anim) => {
      if (anim.type === 'floatingText') {
        return now < anim.startTime + anim.duration;
      }
      if (anim.type === 'movement') {
        const totalDuration = (anim.path.length - 1) * anim.durationPerTile;
        return now < anim.startTime + totalDuration;
      }
      if (anim.type === 'bumpAttack' || anim.type === 'damageShake') {
        return now < anim.startTime + anim.duration;
      }
      return false;
    });

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
      
      const barW = rect.w * 0.72;
      const barX = rect.x + (rect.w - barW) / 2;
      const barY = rect.y - 6;
      draw.drawHpBar(barX, barY, barW, 8, monster.hp, monster.maxHp, '#ef4444');
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
    
    const playerBarW = playerRect.w * 0.72;
    const playerBarX = playerRect.x + (playerRect.w - playerBarW) / 2;
    const playerBarY = playerRect.y - 6;
    draw.drawHpBar(playerBarX, playerBarY, playerBarW, 8, state.game.player.health, state.game.player.maxHealth, '#ef4444');

    state.game.animations.forEach((anim) => {
      if (anim.type === 'floatingText' && now >= anim.startTime) {
        const progress = (now - anim.startTime) / anim.duration;
        const rect = layout.tileRect(currentLayout, anim.x, anim.y);
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2 - (progress * 44);

        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.pow(progress, 3));
        ctx.strokeStyle = 'rgba(15,23,42,0.9)';
        ctx.lineWidth = 5;
        ctx.font = '900 32px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText(anim.text, cx, cy);
        
        ctx.fillStyle = anim.color;
        ctx.fillText(anim.text, cx, cy);
        ctx.restore();
      }
    });

    drawTurnQueue(currentLayout);
    drawHoverStats(currentLayout);
    drawSelectedEntityModal(currentLayout);
    drawMenu(currentLayout);
    drawBanner(currentLayout);
    
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
          (hoverMonster && attackable.has(hoverMonster.id))
        )
        ? 'pointer'
        : 'default';
  }

  return {
    start() {
      render();
    },
  };
}
