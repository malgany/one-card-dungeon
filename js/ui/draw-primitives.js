import { PHASES } from '../config/game-data.js';
import { pointInRect } from './layout.js';

const PRIMITIVE_THEME = {
  surface: '#202219',
  surfaceHover: '#29291f',
  surfaceDisabled: '#171912',
  border: '#6f6342',
  borderMuted: '#4a4638',
  text: '#f2ead7',
  textMuted: '#8f8773',
  accent: '#d39b32',
  danger: '#b94735',
  success: '#5f8f54',
};

export function createDrawPrimitives({ ctx, state, cardImages }) {
  function roundRect(x, y, w, h, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawText(text, x, y, options = {}) {
    ctx.fillStyle = options.color || PRIMITIVE_THEME.text;
    ctx.font = options.font || '16px Inter, sans-serif';
    ctx.textAlign = options.align || 'left';
    ctx.textBaseline = options.baseline || 'alphabetic';
    if (options.maxWidth) {
      ctx.fillText(text, x, y, options.maxWidth);
    } else {
      ctx.fillText(text, x, y);
    }
  }

  function drawButton(x, y, w, h, label, onClick, style = {}) {
    const hovered = pointInRect(state.mouse.x, state.mouse.y, { x, y, w, h });
    const disabled = style.disabled;
    const fill = disabled
      ? PRIMITIVE_THEME.surfaceDisabled
      : hovered
        ? (style.hoverFill || PRIMITIVE_THEME.surfaceHover)
        : (style.fill || PRIMITIVE_THEME.surface);
    const stroke = disabled ? PRIMITIVE_THEME.borderMuted : (style.stroke || PRIMITIVE_THEME.border);

    roundRect(x, y, w, h, style.radius ?? 6, fill, stroke);
    drawText(label, x + w / 2, y + h / 2 + 5, {
      align: 'center',
      font: style.font || 'bold 14px Inter, sans-serif',
      color: disabled ? PRIMITIVE_THEME.textMuted : (style.color || PRIMITIVE_THEME.text),
    });

    if (!disabled) state.game.buttons.push({ x, y, w, h, onClick });
  }

  function drawFloorTile(rect, x, y) {
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    gradient.addColorStop(0, '#353124');
    gradient.addColorStop(1, '#18160f');
    ctx.fillStyle = gradient;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);

    for (let index = 0; index < 4; index += 1) {
      const px = rect.x + 10 + ((x * 31 + y * 17 + index * 19) % Math.max(12, rect.w - 24));
      const py = rect.y + 10 + ((x * 13 + y * 29 + index * 23) % Math.max(12, rect.h - 24));
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fillRect(px, py, 4, 4);
    }
  }

  function drawWallTile(rect) {
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    gradient.addColorStop(0, '#746b55');
    gradient.addColorStop(0.48, '#4a4638');
    gradient.addColorStop(1, '#26251c');
    ctx.fillStyle = gradient;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(rect.x + 8, rect.y + 12, rect.w - 16, 6);
    ctx.fillRect(rect.x + 8, rect.y + rect.h * 0.44, rect.w - 16, 6);
    ctx.fillRect(rect.x + 8, rect.y + rect.h * 0.72, rect.w - 16, 6);
  }

  function drawHpBar(x, y, w, h, hp, maxHp, fill) {
    roundRect(x, y, w, h, h / 2, 'rgba(0,0,0,0.55)', null);
    
    const innerW = w - 4;
    const innerH = h - 4;
    
    if (maxHp > 0) {
      ctx.save();
      roundRect(x + 2, y + 2, innerW, innerH, innerH / 2, null, null);
      ctx.clip();
      
      const fillW = innerW * (hp / maxHp);
      if (fillW > 0) {
        ctx.fillStyle = fill;
        ctx.fillRect(x + 2, y + 2, fillW, innerH);
      }
      
      if (maxHp > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        const segW = innerW / maxHp;
        for (let i = 1; i < maxHp; i++) {
          const divX = x + 2 + i * segW;
          ctx.fillRect(divX - 1, y + 2, 2, innerH);
        }
      }
      
      ctx.restore();
    }
  }

  function cardImageForUnit(unit, isPlayer = false) {
    if (isPlayer) return cardImages[unit?.characterType] || cardImages.player;
    return cardImages[unit.type] || null;
  }

  function drawImageCover(image, x, y, w, h) {
    if (!image || !image.complete || image.naturalWidth === 0) return false;

    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = w / h;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
    return true;
  }

  function drawUnitCardToken(unit, rect, isPlayer = false, flashRed = false) {
    const image = cardImageForUnit(unit, isPlayer);
    const margin = 8;
    const cardH = rect.h - margin * 2;
    const cardW = cardH * 0.72;
    const x = rect.x + (rect.w - cardW) / 2;
    const y = rect.y + margin;
    const w = cardW;
    const h = cardH;
    let tint = isPlayer ? '#3f6f45' : unit.tint;
    if (flashRed) tint = PRIMITIVE_THEME.danger;

    roundRect(x, y, w, h, 8, `${tint}dd`, 'rgba(0,0,0,0.45)');
    ctx.save();
    roundRect(x + 3, y + 3, w - 6, h - 6, 6, null, null);
    ctx.clip();

    const drew = drawImageCover(image, x + 3, y + 3, w - 6, h - 6);
    if (!drew) {
      drawText(isPlayer ? '🧙' : unit.emoji, rect.x + rect.w / 2, rect.y + rect.h / 2 + 11, {
        align: 'center',
        font: `${Math.floor(w * 0.46)}px Inter, sans-serif`,
      });
    }

    ctx.restore();
    ctx.strokeStyle = isPlayer ? '#9a7a32cc' : 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 8, null, ctx.strokeStyle);
  }

  function drawIconStat(icon, value, x, y) {
    roundRect(x, y, 66, 34, 6, 'rgba(23,25,18,0.86)', PRIMITIVE_THEME.borderMuted);
    drawText(icon, x + 14, y + 23, { align: 'center', font: '17px Inter, sans-serif' });
    drawText(String(value), x + 42, y + 23, {
      align: 'center',
      font: 'bold 16px Inter, sans-serif',
      color: PRIMITIVE_THEME.text,
    });
  }

  function drawDieToken(x, y, size, value, dieIndex, isGhost = false) {
    const hovered = pointInRect(state.mouse.x, state.mouse.y, { x, y, w: size, h: size });

    roundRect(
      x,
      y,
      size,
      size,
      6,
      isGhost ? 'rgba(242,234,215,0.1)' : hovered ? '#f2ead7' : '#d8ceb6',
      isGhost ? 'rgba(242,234,215,0.3)' : PRIMITIVE_THEME.border
    );

    ctx.fillStyle = isGhost ? 'rgba(242,234,215,0.2)' : '#171912';
    const dotSize = size * 0.09;
    const padding = size * 0.25;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const left = x + padding;
    const right = x + size - padding;
    const top = y + padding;
    const bottom = y + size - padding;

    const drawDot = (dx, dy) => {
      ctx.beginPath();
      ctx.arc(dx, dy, dotSize, 0, Math.PI * 2);
      ctx.fill();
    };

    if (value === 1 || value === 3 || value === 5) drawDot(cx, cy);
    if (value === 2 || value === 3 || value === 4 || value === 5 || value === 6) {
      drawDot(left, top);
      drawDot(right, bottom);
    }
    if (value === 4 || value === 5 || value === 6) {
      drawDot(right, top);
      drawDot(left, bottom);
    }
    if (value === 6) {
      drawDot(left, cy);
      drawDot(right, cy);
    }

    if (
      !isGhost &&
      state.game.phase === PHASES.ENERGY &&
      (!state.game.draggingDie || state.game.draggingDie.dieIndex !== dieIndex)
    ) {
      state.game.diceRects.push({ x, y, w: size, h: size, dieIndex });
    }
  }

  return {
    drawButton,
    drawDieToken,
    drawFloorTile,
    drawHpBar,
    drawIconStat,
    drawImageCover,
    drawText,
    drawUnitCardToken,
    drawWallTile,
    roundRect,
  };
}
