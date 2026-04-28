import { BOARD_SIZE, GAME_MODES, PHASES } from '../config/game-data.js';
import { inBounds, samePos } from '../game/board-logic.js';

export function pointInRect(px, py, rect) {
  return px >= rect.x && py >= rect.y && px <= rect.x + rect.w && py <= rect.y + rect.h;
}

export function createLayoutTools({ canvas, ctx, state }) {
  function isOverworldMode() {
    return state.game.mode === GAME_MODES.OVERWORLD;
  }

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

  function overworldViewport(layout) {
    const top = layout.compact ? layout.leftY + layout.leftH + 8 : 0;
    const bottomPadding = layout.compact ? 10 : 0;
    const x = layout.compact ? 0 : layout.sidebarW;
    const y = Math.max(0, top);
    const w = layout.compact ? layout.sw : layout.sw - layout.sidebarW;
    const h = Math.max(1, layout.sh - y - bottomPadding);

    return { x, y, w, h };
  }

  function overworldTileSize(layout) {
    return layout.compact ? 44 : 56;
  }

  function overworldCamera(layout) {
    const overworld = state.game.overworld;
    const viewport = overworldViewport(layout);
    const tileSize = overworldTileSize(layout);
    if (!overworld) return { x: 0, y: 0 };

    const mapW = overworld.width * tileSize;
    const mapH = overworld.height * tileSize;
    const desiredX = state.game.player.x * tileSize + tileSize / 2 - viewport.w / 2;
    const desiredY = state.game.player.y * tileSize + tileSize / 2 - viewport.h / 2;

    return {
      x: Math.max(0, Math.min(Math.max(0, mapW - viewport.w), desiredX)),
      y: Math.max(0, Math.min(Math.max(0, mapH - viewport.h), desiredY)),
    };
  }

  function overworldTileRect(layout, x, y) {
    const viewport = overworldViewport(layout);
    const tileSize = overworldTileSize(layout);
    const camera = overworldCamera(layout);

    return {
      x: viewport.x + x * tileSize - camera.x,
      y: viewport.y + y * tileSize - camera.y,
      w: tileSize,
      h: tileSize,
    };
  }

  function overworldTileAt(layout, px, py) {
    const overworld = state.game.overworld;
    if (!overworld) return null;

    const viewport = overworldViewport(layout);
    if (
      px < viewport.x ||
      py < viewport.y ||
      px >= viewport.x + viewport.w ||
      py >= viewport.y + viewport.h
    ) {
      return null;
    }

    const tileSize = overworldTileSize(layout);
    const camera = overworldCamera(layout);
    const x = Math.floor((px - viewport.x + camera.x) / tileSize);
    const y = Math.floor((py - viewport.y + camera.y) / tileSize);
    const bounds = { width: overworld.width, height: overworld.height };

    return inBounds({ x, y }, bounds) ? { x, y } : null;
  }

  function tileAt(layout, px, py) {
    const renderedTile = state.boardInteraction?.tileAt?.(layout, px, py);
    if (renderedTile !== undefined) return renderedTile;

    if (isOverworldMode()) return overworldTileAt(layout, px, py);

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
    if (isOverworldMode()) return null;

    const tile = hoveredTile();
    if (!tile) return null;
    return state.game.monsters.find((monster) => monster.x === tile.x && monster.y === tile.y) || null;
  }

  function hoveredOverworldEnemy() {
    if (!isOverworldMode()) return null;

    const tile = hoveredTile();
    if (!tile) return null;
    return (state.game.overworld?.enemies || []).find((enemy) => {
      return enemy.hp !== 0 && enemy.x === tile.x && enemy.y === tile.y;
    }) || null;
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
    hoveredOverworldEnemy,
    hoveredPlayer,
    hoveredTile,
    overworldCamera,
    overworldTileAt,
    overworldTileRect,
    overworldTileSize,
    overworldViewport,
    pointInRect,
    resize,
    tileAt,
    tileRect,
  };
}
