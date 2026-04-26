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
    
    const statItemW = barW / 4;
    const statsArray = [
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
      } else if (game.phase === PHASES.HERO) {
        draw.drawText('Passe o mouse no herói para ver', x + w / 2, cy, { align: 'center', font: '14px Inter, sans-serif', color: '#94a3b8' });
        draw.drawText('movimento. Clique em inimigos', x + w / 2, cy + 20, { align: 'center', font: '14px Inter, sans-serif', color: '#94a3b8' });
        draw.drawText('destacados para atacar.', x + w / 2, cy + 40, { align: 'center', font: '14px Inter, sans-serif', color: '#94a3b8' });
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

    }

  function drawMenu(currentLayout) {
    if (!state.game.menuOpen) return;

    const w = 220;
    const h = 218;
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
      fill: '#0f766e',
      hoverFill: '#115e59',
      stroke: '#5eead4',
    });
    draw.drawButton(x + 18, y + 90, w - 36, 34, 'Salvar jogo', actions.saveGame, {
      fill: '#1f2937',
      hoverFill: '#374151',
      stroke: '#64748b',
    });
    draw.drawButton(x + 18, y + 132, w - 36, 34, 'Carregar jogo', actions.loadGame, {
      fill: '#1f2937',
      hoverFill: '#374151',
      stroke: '#64748b',
    });
    draw.drawButton(x + 18, y + 174, w - 36, 34, 'Novo jogo', actions.newGame, {
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

  function drawBottomUI(currentLayout) {
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
    
    // Turn Queue
    if (game.turnQueue && game.turnQueue.length > 0) {
      const queueW = 48;
      const queueSpacing = 16;
      const queueY = bottomY + 26;
      
      let currentX = uiX + heartSize + 40;
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
    draw.drawButton(btnX, btnY, btnW, btnH, 'Encerrar Turno', actions.endHeroPhase, {
      fill: '#7c2d12', hoverFill: '#9a3412', stroke: '#fdba74',
      disabled: game.phase !== PHASES.HERO || game.busy, font: 'bold 18px Inter, sans-serif',
    });
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

    const cardW = 110;
    const cardH = 146;
    const width = currentLayout.leftW - 32;
    const height = 200;
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
      draw.drawText(icons[index], textX + 2, y + 80 + index * 22, {
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

  function drawBanner(currentLayout) {
    const banner = state.game.banner;
    if (!banner) return;

    const now = performance.now();
    const remaining = Math.max(0, banner.until - now);
    const alpha = Math.min(1, remaining / 250);

    const cx = currentLayout.boardX + currentLayout.boardW / 2;
    const cy = currentLayout.boardY + currentLayout.boardH / 2;
    const hasCard = !!banner.cardKey;
    const panelW = hasCard ? 460 : 520;
    const panelH = hasCard ? 132 : 148;
    const panelX = cx - panelW / 2;
    const panelY = hasCard ? cy + 44 : cy - 74;
    const accent = banner.accent || '#facc15';

    ctx.save();
    ctx.globalAlpha = alpha;
    if (hasCard) {
      const cardImage = cardImages[banner.cardKey] || null;
      const cardW = 144;
      const cardH = 194;
      const cardX = cx - cardW / 2;
      const cardY = panelY - cardH + 30;

      draw.roundRect(cardX - 10, cardY - 10, cardW + 20, cardH + 20, 22, 'rgba(0,0,0,0.4)', null);
      draw.roundRect(cardX, cardY, cardW, cardH, 16, '#111827', accent);

      ctx.save();
      draw.roundRect(cardX + 4, cardY + 4, cardW - 8, cardH - 8, 12, null, null);
      ctx.clip();
      const drew = draw.drawImageCover(cardImage, cardX + 4, cardY + 4, cardW - 8, cardH - 8);
      if (!drew) {
        draw.drawText(banner.subtitle || banner.title, cx, cardY + cardH / 2 + 8, {
          align: 'center',
          font: 'bold 20px Inter, sans-serif',
          color: '#f8fafc',
          maxWidth: cardW - 20,
        });
      }
      ctx.restore();

      ctx.lineWidth = 3;
      draw.roundRect(panelX, panelY, panelW, panelH, 24, 'rgba(0,0,0,0.8)', accent);
      draw.drawText(banner.title, cx, panelY + 54, {
        align: 'center',
        font: 'bold 28px Inter, sans-serif',
        color: '#f8fafc',
      });

      if (banner.subtitle) {
        draw.drawText(banner.subtitle, cx, panelY + 88, {
          align: 'center',
          font: '16px Inter, sans-serif',
          color: '#cbd5e1',
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

  function render() {
    requestAnimationFrame(render);

    state.game.buttons = [];
    const now = performance.now();

    const currentLayout = layout.getLayout();
    
    if (state.game.phase !== PHASES.ENERGY) {
      state.game.energyConfirmStartTime = null;
      state.game.energyConfirmed = false;
    }

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

    let monsterReachable = new Map();
    let monsterAttackTiles = new Set();
    if (hoverMonster && !state.game.busy) {
       monsterReachable = actions.getMonsterReachableTiles(hoverMonster.id);
       monsterAttackTiles = actions.getMonsterAttackTiles(hoverMonster.id);
    }

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

        if (!isWall && showMoveHints && reachable.has(key) && !monster && !samePos({ x, y }, state.game.player)) {
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

        if (monster && attackable.has(monster.id)) {
          ctx.strokeStyle = 'rgba(244,114,182,0.95)';
          ctx.lineWidth = 4;
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

    drawHoverStats(currentLayout);
    drawSelectedEntityModal(currentLayout);
    drawMenu(currentLayout);
    drawBottomUI(currentLayout);

    // Top right settings button
    draw.drawButton(currentLayout.sw - 48, 16, 32, 32, '⚙️', () => {
      state.game.menuOpen = !state.game.menuOpen;
    }, {
      fill: '#111827', hoverFill: '#1f2937', stroke: '#64748b', font: '16px Inter, sans-serif',
    });
    
    drawEnergyFocusMask(currentLayout);
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
