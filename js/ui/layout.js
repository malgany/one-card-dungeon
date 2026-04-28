import { BOARD_SIZE, PHASES } from '../config/game-data.js';
import { inBounds, samePos } from '../game/board-logic.js';

export function pointInRect(px, py, rect) {
  return px >= rect.x && py >= rect.y && px <= rect.x + rect.w && py <= rect.y + rect.h;
}

export function createLayoutTools({ canvas, ctx, state }) {
  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function getLayout() {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const compact = sw < 760;

    if (compact) {
      const margin = 16;
      const topUIHeight = Math.min(300, Math.max(270, Math.floor(sh * 0.34)));
      const bottomUIHeight = 132;
      const availableW = sw - margin * 2;
      const availableH = Math.max(180, sh - topUIHeight - bottomUIHeight - margin);
      const boardPixels = Math.floor(Math.min(availableW, availableH, 520));
      const tileSize = Math.max(28, Math.floor(boardPixels / BOARD_SIZE));
      const boardW = tileSize * BOARD_SIZE;
      const boardH = tileSize * BOARD_SIZE;
      const boardX = Math.floor((sw - boardW) / 2);
      const boardY = topUIHeight + Math.max(8, Math.floor((availableH - boardH) / 2));

      return {
        compact,
        sw,
        sh,
        sidebarW: sw,
        boardX,
        boardY,
        boardW,
        boardH,
        tileSize,
        bottomUIHeight,
        topUIHeight,
        leftX: 16,
        leftY: 16,
        leftW: sw - 32,
        leftH: topUIHeight - 36,
      };
    }
    
    const sidebarW = Math.max(340, Math.floor(sw * 0.26));
    const rightW = sw - sidebarW;
    const margin = 24;
    
    const availableW = rightW - margin * 2;
    const bottomUIHeight = 124;
    const availableH = sh - margin * 2 - bottomUIHeight;
    const boardPixels = Math.floor(Math.min(availableW, availableH, 800));
    const tileSize = Math.floor(boardPixels / BOARD_SIZE);
    const boardW = tileSize * BOARD_SIZE;
    const boardH = tileSize * BOARD_SIZE;
    
    const boardX = sidebarW + Math.floor((rightW - boardW) / 2);
    const boardY = Math.floor((sh - bottomUIHeight - boardH) / 2);

    return {
      compact,
      sw,
      sh,
      sidebarW,
      boardX,
      boardY,
      boardW,
      boardH,
      tileSize,
      bottomUIHeight,
      leftX: 16,
      leftY: 16,
      leftW: sidebarW - 32,
      leftH: sh - 32,
    };
  }

  function tileRect(layout, x, y) {
    return {
      x: layout.boardX + x * layout.tileSize,
      y: layout.boardY + y * layout.tileSize,
      w: layout.tileSize,
      h: layout.tileSize,
    };
  }

  function tileAt(layout, px, py) {
    const renderedTile = state.boardInteraction?.tileAt?.(layout, px, py);
    if (renderedTile !== undefined) return renderedTile;

    if (
      px < layout.boardX ||
      py < layout.boardY ||
      px >= layout.boardX + layout.boardW ||
      py >= layout.boardY + layout.boardH
    ) {
      return null;
    }

    const x = Math.floor((px - layout.boardX) / layout.tileSize);
    const y = Math.floor((py - layout.boardY) / layout.tileSize);
    return inBounds({ x, y }) ? { x, y } : null;
  }

  function hoveredTile() {
    if (state.game.phase === PHASES.ENERGY) return null;
    return tileAt(getLayout(), state.mouse.x, state.mouse.y);
  }

  function hoveredMonster() {
    const tile = hoveredTile();
    if (!tile) return null;
    return state.game.monsters.find((monster) => monster.x === tile.x && monster.y === tile.y) || null;
  }

  function hoveredPlayer() {
    const tile = hoveredTile();
    return tile && samePos(tile, state.game.player);
  }

  function hoveredButton() {
    return state.game.buttons.find((button) => pointInRect(state.mouse.x, state.mouse.y, button));
  }

  function hoveredDraggableDie() {
    if (state.game.phase !== PHASES.ENERGY || state.game.busy) return null;
    return state.game.diceRects.find((rect) => pointInRect(state.mouse.x, state.mouse.y, rect));
  }

  return {
    getLayout,
    hoveredButton,
    hoveredDraggableDie,
    hoveredMonster,
    hoveredPlayer,
    hoveredTile,
    pointInRect,
    resize,
    tileAt,
    tileRect,
  };
}
