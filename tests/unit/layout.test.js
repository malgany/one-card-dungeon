import { describe, expect, it, vi } from 'vitest';
import { GAME_MODES, PHASES } from '../../js/config/game-data.js';
import { pointInRect, createLayoutTools } from '../../js/ui/layout.js';

function createLayoutHarness() {
  const canvas = document.createElement('canvas');
  const ctx = { setTransform: vi.fn() };
  const state = {
    mouse: { x: 0, y: 0 },
    game: {
      phase: PHASES.HERO,
      player: { x: 0, y: 5 },
      monsters: [{ id: 'm1', x: 1, y: 5 }],
      buttons: [{ x: 10, y: 10, w: 30, h: 20 }],
      diceRects: [{ x: 50, y: 50, w: 20, h: 20 }],
      busy: false,
    },
  };
  const layout = createLayoutTools({ canvas, ctx, state });
  return { canvas, ctx, state, layout };
}

describe('layout tools', () => {
  it('checks whether points are inside rectangles', () => {
    expect(pointInRect(10, 10, { x: 10, y: 10, w: 20, h: 20 })).toBe(true);
    expect(pointInRect(30, 30, { x: 10, y: 10, w: 20, h: 20 })).toBe(true);
    expect(pointInRect(31, 30, { x: 10, y: 10, w: 20, h: 20 })).toBe(false);
  });

  it('resizes the canvas using window dimensions and device pixel ratio', () => {
    const { canvas, ctx, layout } = createLayoutHarness();
    window.innerWidth = 900;
    window.innerHeight = 700;
    window.devicePixelRatio = 2;

    layout.resize();

    expect(canvas.width).toBe(1800);
    expect(canvas.height).toBe(1400);
    expect(canvas.style.width).toBe('900px');
    expect(canvas.style.height).toBe('700px');
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('maps between board tiles and screen coordinates', () => {
    const { layout } = createLayoutHarness();
    window.innerWidth = 1000;
    window.innerHeight = 800;
    const currentLayout = layout.getLayout();
    const rect = layout.tileRect(currentLayout, 2, 3);

    expect(layout.tileAt(currentLayout, rect.x + 1, rect.y + 1)).toEqual({ x: 2, y: 3 });
    expect(layout.tileAt(currentLayout, currentLayout.boardX - 1, rect.y)).toBe(null);
  });

  it('detects hovered tiles, entities, buttons, and dice', () => {
    const { state, layout } = createLayoutHarness();
    const currentLayout = layout.getLayout();
    const monsterRect = layout.tileRect(currentLayout, 1, 5);
    state.mouse = { x: monsterRect.x + 2, y: monsterRect.y + 2 };

    expect(layout.hoveredTile()).toEqual({ x: 1, y: 5 });
    expect(layout.hoveredMonster()).toMatchObject({ id: 'm1' });
    expect(layout.hoveredPlayer()).toBe(false);

    state.mouse = { x: 11, y: 11 };
    expect(layout.hoveredButton()).toEqual(state.game.buttons[0]);

    state.game.phase = PHASES.ENERGY;
    state.mouse = { x: 55, y: 55 };
    expect(layout.hoveredDraggableDie()).toEqual(state.game.diceRects[0]);
    expect(layout.hoveredTile()).toBe(null);
  });

  it('uses the rendered 3D hit test for overworld tiles and enemies', () => {
    const { state, layout } = createLayoutHarness();
    state.game.mode = GAME_MODES.OVERWORLD;
    state.game.overworld = {
      width: 18,
      height: 14,
      enemies: [{ id: 'e1', x: 7, y: 9, hp: 10 }],
    };
    state.boardInteraction = {
      tileAt: vi.fn(() => ({ x: 7, y: 9 })),
    };

    expect(layout.tileAt(layout.getLayout(), 100, 100)).toEqual({ x: 7, y: 9 });
    expect(layout.hoveredOverworldEnemy()).toMatchObject({ id: 'e1' });
  });
});
