import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../js/ui/menu-character-viewer.js', () => ({
  mountMenuCharacterPreview: vi.fn(() => ({
    dispose: vi.fn(),
    flashPaletteSlot: vi.fn(),
    updatePalette: vi.fn(),
  })),
}));

import { createMenuFlow } from '../../js/ui/menu-flow.js';
import { CHARACTERS_KEY, SELECTED_CHARACTER_KEY } from '../../js/game/character-progress.js';
import { GAME_MODES, START_WORLD_MAP_ID } from '../../js/config/game-data.js';

function createMenuHarness() {
  const root = document.createElement('div');
  document.body.append(root);

  const actions = {
    loadGame: vi.fn(() => false),
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

  it('shows character level on the selection screen', () => {
    window.localStorage.setItem(CHARACTERS_KEY, JSON.stringify([
      {
        id: 'mage-7',
        name: 'Dsa',
        type: 'mage',
        progress: { level: 7, experience: 0 },
      },
    ]));
    window.localStorage.setItem(SELECTED_CHARACTER_KEY, 'mage-7');
    const { flow, root } = createMenuHarness();

    flow.show();
    root.querySelector('[data-menu-action="start-flow"]').click();

    expect(root.querySelector('.menu-character-row')?.textContent).toContain('Nível 7');
    expect(root.querySelector('.menu-character-nameplate')?.textContent).toContain('Nível 7');

    flow.dispose();
  });

  it('does not reuse another character combat state when entering without a save', () => {
    window.localStorage.setItem(CHARACTERS_KEY, JSON.stringify([
      { id: 'char-a', name: 'A', type: 'mage' },
      { id: 'char-b', name: 'B', type: 'knight' },
    ]));
    window.localStorage.setItem(SELECTED_CHARACTER_KEY, 'char-a');
    const { actions, flow, root, state } = createMenuHarness();
    state.game.mode = GAME_MODES.COMBAT;
    state.game.player.characterId = 'char-a';

    flow.show();
    root.querySelector('[data-menu-action="start-flow"]').click();
    root.querySelector('[data-character-id="char-b"]').click();
    root.querySelector('[data-menu-action="play-selected"]').click();

    expect(actions.loadGame).toHaveBeenCalledWith({ silent: true, characterId: 'char-b' });
    expect(actions.startOverworldAtMap).toHaveBeenCalledWith(START_WORLD_MAP_ID);
    expect(state.game.player.characterId).toBe('char-b');

    flow.dispose();
  });
});
