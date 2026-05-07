import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../js/ui/menu-character-viewer.js', () => ({
  mountMenuCharacterPreview: vi.fn(() => ({
    dispose: vi.fn(),
    flashPaletteSlot: vi.fn(),
    updatePalette: vi.fn(),
  })),
}));

import { createMenuFlow } from '../../js/ui/menu-flow.js';

function createMenuHarness() {
  const root = document.createElement('div');
  document.body.append(root);

  const actions = {
    setEvent: vi.fn(),
    startNurseryCutscene: vi.fn(),
    startOverworldAtMap: vi.fn(),
  };
  const state = {
    debugSettings: {},
    game: {
      player: {
        apMax: 3,
        speedBase: 4,
      },
    },
  };

  const flow = createMenuFlow({ state, actions, root });
  return { actions, flow, root, state };
}

describe('menu flow', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    window.requestAnimationFrame = vi.fn(() => 1);
    window.cancelAnimationFrame = vi.fn();
  });

  it('opens character creation before the intro when no character exists', () => {
    const { flow, root } = createMenuHarness();

    flow.show();
    root.querySelector('[data-menu-action="start-flow"]').click();

    expect(root.classList.contains('menu-root--create')).toBe(true);
    expect(root.querySelector('.menu-intro-screen')).toBeNull();
    expect(root.querySelector('[name="characterName"]')).toBeTruthy();

    flow.dispose();
  });

  it('uses the optimized intro images after creating the first character', () => {
    const { actions, flow, root } = createMenuHarness();

    flow.show();
    root.querySelector('[data-menu-action="start-flow"]').click();

    const input = root.querySelector('[name="characterName"]');
    input.value = 'Aria';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector('[data-character-form]').dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true,
    }));

    expect(root.classList.contains('menu-root--intro')).toBe(true);
    expect(root.querySelector('.menu-intro-screen')).toBeTruthy();
    expect(root.querySelector('[data-intro-scene]').style.getPropertyValue('--intro-image')).toContain('scene-01.webp');
    expect(actions.startOverworldAtMap).not.toHaveBeenCalled();

    flow.dispose();
  });
});
