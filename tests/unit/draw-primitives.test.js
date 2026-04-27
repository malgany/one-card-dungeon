import { describe, expect, it, vi } from 'vitest';
import { PHASES } from '../../js/config/game-data.js';
import { createDrawPrimitives } from '../../js/ui/draw-primitives.js';

function createCtx() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    set fillStyle(value) { this._fillStyle = value; },
    get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; },
    get strokeStyle() { return this._strokeStyle; },
    set font(value) { this._font = value; },
    get font() { return this._font; },
    set textAlign(value) { this._textAlign = value; },
    get textAlign() { return this._textAlign; },
    set textBaseline(value) { this._textBaseline = value; },
    get textBaseline() { return this._textBaseline; },
    set lineWidth(value) { this._lineWidth = value; },
    get lineWidth() { return this._lineWidth; },
  };
}

describe('draw primitives', () => {
  it('registers enabled buttons for click handling', () => {
    const ctx = createCtx();
    const state = { mouse: { x: 5, y: 5 }, game: { buttons: [] } };
    const draw = createDrawPrimitives({ ctx, state, cardImages: {} });
    const onClick = vi.fn();

    draw.drawButton(0, 0, 20, 20, 'Go', onClick);
    draw.drawButton(30, 0, 20, 20, 'No', vi.fn(), { disabled: true });

    expect(state.game.buttons).toHaveLength(1);
    expect(state.game.buttons[0]).toMatchObject({ x: 0, y: 0, w: 20, h: 20, onClick });
  });

  it('registers draggable dice only during energy phase', () => {
    const ctx = createCtx();
    const state = {
      mouse: { x: 100, y: 100 },
      game: { phase: PHASES.ENERGY, draggingDie: null, diceRects: [] },
    };
    const draw = createDrawPrimitives({ ctx, state, cardImages: {} });

    draw.drawDieToken(0, 0, 40, 6, 2);
    expect(state.game.diceRects).toEqual([{ x: 0, y: 0, w: 40, h: 40, dieIndex: 2 }]);

    state.game.phase = PHASES.HERO;
    draw.drawDieToken(50, 0, 40, 3, 1);
    expect(state.game.diceRects).toHaveLength(1);
  });

  it('uses image cover cropping when image dimensions are available', () => {
    const ctx = createCtx();
    const state = { mouse: { x: 0, y: 0 }, game: { buttons: [] } };
    const draw = createDrawPrimitives({ ctx, state, cardImages: {} });
    const image = { complete: true, naturalWidth: 200, naturalHeight: 100 };

    expect(draw.drawImageCover(image, 0, 0, 50, 50)).toBe(true);
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 50, 0, 100, 100, 0, 0, 50, 50);
    expect(draw.drawImageCover(null, 0, 0, 50, 50)).toBe(false);
  });
});
