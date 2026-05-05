import { expect, test } from '@playwright/test';

async function switchDebugGameToMap(page, mapId) {
  await page.evaluate(async (targetMapId) => {
    const [{ GAME_MODES, getWorldMap }, { createOverworldMapState }] = await Promise.all([
      import('/js/config/game-data.js'),
      import('/js/game/game-factories.js'),
    ]);
    const debug = window.__ONE_RPG_DEBUG__;
    const map = getWorldMap(targetMapId);

    debug.state.game.mode = GAME_MODES.OVERWORLD;
    debug.state.game.player.x = map.playerStart.x;
    debug.state.game.player.y = map.playerStart.y;
    debug.state.game.monsters = [];
    debug.state.game.combatContext = null;
    debug.state.game.busy = false;
    debug.state.game.animations = [];
    debug.state.game.overworld.currentMapId = map.id;
    debug.state.game.overworld.mapStates[map.id] = createOverworldMapState(map);
  }, mapId);
}

test('loads and renders the canvas game without console errors', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto('/');
  await expect(page.locator('#menu-root')).toBeVisible();
  await expect(page.locator('.menu-screen--create')).toBeVisible();
  const webglCanvas = page.locator('.board-webgl');
  const canvas = page.locator('#game');
  await expect(webglCanvas).toBeVisible();
  await expect(canvas).toBeVisible();

  expect(await page.locator('canvas').count()).toBeGreaterThanOrEqual(2);
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__?.state?.game?.overworld?.currentMapId === 'chao3-start');
  await page.waitForFunction(() => document.querySelector('.board-webgl')?.clientWidth > 100);
  expect(await page.evaluate(() => {
    const game = window.__ONE_RPG_DEBUG__.state.game;
    return game.overworld.mapStates[game.overworld.currentMapId].enemies.length;
  })).toBe(2);

  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(100);
  expect(box?.height).toBeGreaterThan(100);

  await page.waitForFunction(() => {
    const canvasElement = document.querySelector('#game');
    const ctx = canvasElement?.getContext('2d');
    if (!canvasElement || !ctx) return false;

    const sample = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
    for (let index = 3; index < sample.length; index += 4) {
      if (sample[index] !== 0) return true;
    }
    return false;
  });

  expect(consoleErrors).toEqual([]);
});

test('positions the home panel proportionally on very wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 768 });
  await page.goto('/');
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__?.menuFlow);
  await page.evaluate(() => window.__ONE_RPG_DEBUG__.menuFlow.show());

  const box = await page.locator('.menu-home-panel').boundingBox();
  expect(box?.x).toBeGreaterThan(250);
  expect(box?.x).toBeLessThan(380);
});

test('opens character creation when no character exists', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.menu-screen--create')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.locator('.menu-home-panel')).toBeVisible();

  await page.locator('.menu-home-panel .menu-primary-button').click();
  await expect(page.locator('.menu-screen--create')).toBeVisible();

  await page.getByPlaceholder('Nome do personagem').fill('Aria');
  await page.locator('[data-menu-action="choose-type"][data-type-id="knight"]').click();
  await page.locator('[data-palette-color-input][data-slot-id="r4c2"]').evaluate((input) => {
    input.value = '#00ff88';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('.menu-create-form .menu-primary-button').click();

  await expect(page.locator('#menu-root')).toBeHidden();
  await page.waitForFunction(() => {
    const player = window.__ONE_RPG_DEBUG__?.state?.game?.player;
    return (
      player?.name === 'Aria' &&
      player?.characterType === 'knight' &&
      player?.characterPalette?.slots?.r4c2 === '#00FF88'
    );
  });
  const savedCharacters = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem('one-rpg-characters-v1'));
  });
  expect(savedCharacters[0].palette.slots.r4c2).toBe('#00FF88');
});

test('edits grouped mage palette slots together', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.menu-screen--create')).toBeVisible();
  await expect(page.locator('[data-palette-slot-id]')).toHaveCount(6);
  await expect(page.locator('.menu-palette-row-label')).toHaveText([
    'PELE',
    'CABELO',
    'ROUPAS 1',
    'ROUPAS 2',
    'ROUPAS 3',
    'ROUPAS 4',
  ]);

  await page.getByPlaceholder('Nome do personagem').fill('Mira');
  await page.locator('[data-palette-color-input][data-slot-id="r2c2"]').evaluate((input) => {
    input.value = '#aa33ff';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('.menu-create-form .menu-primary-button').click();

  await expect(page.locator('#menu-root')).toBeHidden();
  await page.waitForFunction(() => {
    const palette = window.__ONE_RPG_DEBUG__?.state?.game?.player?.characterPalette;
    return (
      palette?.slots?.r2c2 === '#AA33FF' &&
      palette?.slots?.r3c2 === '#AA33FF' &&
      palette?.slots?.r4c0 === '#AA33FF' &&
      palette?.slots?.r4c1 === '#AA33FF' &&
      palette?.slots?.r5c0 === '#AA33FF' &&
      palette?.slots?.r5c1 === '#AA33FF' &&
      palette?.slots?.r2c0 === '#BDC185' &&
      palette?.slots?.r3c0 === '#BDC185' &&
      palette?.slots?.r4c7 === '#1F1F1F' &&
      palette?.slots?.r5c7 === '#1F1F1F'
    );
  });
  const savedCharacters = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem('one-rpg-characters-v1'));
  });
  expect(savedCharacters[0].palette.slots).toMatchObject({
    r2c2: '#AA33FF',
    r3c2: '#AA33FF',
    r4c0: '#AA33FF',
    r4c1: '#AA33FF',
    r5c0: '#AA33FF',
    r5c1: '#AA33FF',
    r2c0: '#BDC185',
    r3c0: '#BDC185',
    r4c7: '#1F1F1F',
    r5c7: '#1F1F1F',
  });
});

test('opens character selection when a character exists', async ({ page }) => {
  await page.addInitScript(() => {
    const character = {
      id: 'saved-character',
      name: 'Doran',
      type: 'ranger',
      typeLabel: 'Patrulheiro',
      color: '#112233',
      palette: {
        version: 1,
        slots: {
          r6c5: '#4455AA',
          r2c3: '#AA6633',
        },
      },
      image: '/assets/characters/ranger.png',
      createdAt: Date.now(),
    };
    const selectedButNotFirst = {
      id: 'second-character',
      name: 'Mira',
      type: 'mage',
      typeLabel: 'Mago',
      color: '#653681',
      palette: { version: 1, slots: {} },
      image: '/assets/characters/mage.png',
      createdAt: Date.now() + 1,
    };
    window.localStorage.setItem('one-rpg-characters-v1', JSON.stringify([character, selectedButNotFirst]));
    window.localStorage.setItem('one-rpg-selected-character-v1', selectedButNotFirst.id);
  });

  await page.goto('/');
  await expect(page.locator('#menu-root')).toBeHidden();
  await page.waitForFunction(() => {
    const player = window.__ONE_RPG_DEBUG__?.state?.game?.player;
    return player?.name === 'Doran' && player?.characterType === 'ranger';
  });
  await page.evaluate(() => window.__ONE_RPG_DEBUG__.menuFlow.showCharacterSelect());

  await expect(page.locator('.menu-screen--select')).toBeVisible();
  const characterRow = page.locator('.menu-character-row', { hasText: 'Doran' });
  await expect(characterRow).toBeVisible();
  await page.getByRole('button', { name: 'Criar novo personagem' }).click();
  await expect(page.locator('.menu-screen--create')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.locator('.menu-screen--select')).toBeVisible();
  await expect(characterRow).toBeVisible();

  const swatchColors = await characterRow.locator('.menu-character-color').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      primary: style.getPropertyValue('--character-primary-color').trim(),
      secondary: style.getPropertyValue('--character-secondary-color').trim(),
    };
  });
  expect(swatchColors).toEqual({ primary: '#4455AA', secondary: '#AA6633' });
  await page.locator('.menu-actions .menu-primary-button').click();

  await expect(page.locator('#menu-root')).toBeHidden();
  await page.waitForFunction(() => {
    const player = window.__ONE_RPG_DEBUG__?.state?.game?.player;
    return (
      player?.name === 'Doran' &&
      player?.characterType === 'ranger' &&
      player?.characterPalette?.slots?.r6c5 === '#4455AA' &&
      player?.characterPalette?.slots?.r2c3 === '#AA6633'
    );
  });
});

test('opens flattened in-game menu actions', async ({ page }) => {
  await page.addInitScript(() => {
    const character = {
      id: 'saved-character',
      name: 'Doran',
      type: 'ranger',
      typeLabel: 'Patrulheiro',
      color: '#112233',
      palette: { version: 1, slots: {} },
      image: '/assets/characters/ranger.png',
      createdAt: Date.now(),
    };
    window.localStorage.setItem('one-rpg-characters-v1', JSON.stringify([character]));
    window.localStorage.setItem('one-rpg-selected-character-v1', character.id);
  });

  await page.goto('/');
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__?.state?.game?.player?.name === 'Doran');

  async function waitFrame() {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  }

  async function openMainMenu() {
    await page.evaluate(() => {
      const game = window.__ONE_RPG_DEBUG__.state.game;
      game.menuOpen = true;
      game.menuView = 'main';
    });
    await waitFrame();
  }

  async function menuPoint(width, height, offsetX, offsetY) {
    return page.evaluate(({ width: panelW, height: panelH, offsetX: xOffset, offsetY: yOffset }) => {
      const { sw, sh } = window.__ONE_RPG_DEBUG__.layout.getLayout();
      return {
        x: (sw - panelW) / 2 + xOffset,
        y: (sh - panelH) / 2 + yOffset,
      };
    }, { width, height, offsetX, offsetY });
  }

  async function clickMainMenuButton(index) {
    const buttonH = 38;
    const buttonGap = 10;
    const point = await menuPoint(260, 288, 130, 54 + index * (buttonH + buttonGap) + buttonH / 2);
    await page.mouse.click(point.x, point.y);
  }

  await openMainMenu();
  await clickMainMenuButton(0);
  await expect(page.locator('#tutorial-modal')).toBeVisible();
  await page.locator('#tutorial-modal .modal-close').click();
  await expect(page.locator('#tutorial-modal')).toBeHidden();

  await openMainMenu();
  await clickMainMenuButton(1);
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__.state.game.menuView === 'sound');
  await waitFrame();
  const sliderPoint = await menuPoint(360, 228, 24 + (360 - 48) * 0.25, 64 + 80 + 12);
  await page.mouse.click(sliderPoint.x, sliderPoint.y);
  await page.waitForFunction(() => Math.abs(window.__ONE_RPG_DEBUG__.actions.getOverworldMusicVolume() - 0.25) < 0.02);
  const closePoint = await menuPoint(360, 228, 180, 228 - 31);
  await page.mouse.click(closePoint.x, closePoint.y);
  await page.waitForFunction(() => !window.__ONE_RPG_DEBUG__.state.game.menuOpen);

  await openMainMenu();
  const closeXPoint = await menuPoint(260, 288, 260 - 24, 22);
  await page.mouse.click(closeXPoint.x, closeXPoint.y);
  await page.waitForFunction(() => !window.__ONE_RPG_DEBUG__.state.game.menuOpen);

  await openMainMenu();
  await clickMainMenuButton(2);
  await page.waitForFunction(() => {
    const game = window.__ONE_RPG_DEBUG__.state.game;
    return game.mode === 'dungeonLegacy' && !game.menuOpen;
  });
});

test('moves from overworld into combat and returns after victory', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__?.state?.game?.mode === 'overworld');
  await switchDebugGameToMap(page, 'open-road');

  await page.evaluate(() => {
    window.__ONE_RPG_DEBUG__.actions.moveOverworldPlayer({ x: 2, y: 9 });
  });
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__.state.game.player.y === 9);
  await page.waitForFunction(() => !window.__ONE_RPG_DEBUG__.state.game.busy);

  await page.evaluate(() => {
    const { state, actions } = window.__ONE_RPG_DEBUG__;
    const mapState = state.game.overworld.mapStates[state.game.overworld.currentMapId];
    const target = mapState.enemies.find((enemy) => enemy.groupId === 'skeleton-mages');
    actions.startOverworldEncounter(target.id);
  });
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__.state.game.mode === 'combat');

  await page.evaluate(() => {
    const { state, actions } = window.__ONE_RPG_DEBUG__;
    const target = state.game.monsters[0];
    state.game.player.attackSlot.damage = 99;
    state.game.player.rangeBase = 10;
    state.game.apRemaining = 5;
    state.game.selectedAttackId = state.game.player.attackSlot.id;
    actions.attackMonster(target.id);
  });

  await page.waitForFunction(() => {
    const game = window.__ONE_RPG_DEBUG__.state.game;
    const mapState = game.overworld.mapStates[game.overworld.currentMapId];
    return game.mode === 'overworld' && !mapState.enemies.some((enemy) => enemy.groupId === 'skeleton-mages');
  });
});

test('moves between connected overworld chunks', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__?.state?.game?.mode === 'overworld');
  await switchDebugGameToMap(page, 'open-road');

  await page.evaluate(() => {
    const { state, actions } = window.__ONE_RPG_DEBUG__;
    state.game.player.x = 8;
    state.game.player.y = 5;
    actions.moveOverworldPlayer({ x: 9, y: 5 });
  });

  await page.waitForFunction(() => {
    const game = window.__ONE_RPG_DEBUG__.state.game;
    return (
      game.mode === 'overworld' &&
      game.overworld.currentMapId === 'stone-grove' &&
      game.player.x === 1 &&
      game.player.y === 5 &&
      !game.busy
    );
  });
});

test('clicks any visible bridge part to enter its overworld connection', async ({ page }) => {
  await page.addInitScript(() => {
    const character = {
      id: 'bridge-click-character',
      name: 'Doran',
      type: 'ranger',
      typeLabel: 'Patrulheiro',
      color: '#112233',
      palette: { version: 1, slots: {} },
      image: '/assets/characters/ranger.png',
      createdAt: Date.now(),
    };
    window.localStorage.setItem('one-rpg-characters-v1', JSON.stringify([character]));
    window.localStorage.setItem('one-rpg-selected-character-v1', character.id);
  });
  await page.goto('/');
  await expect(page.locator('#menu-root')).toBeHidden();
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__?.state?.game?.mode === 'overworld');
  await switchDebugGameToMap(page, 'chao3-start');

  await page.evaluate(async () => {
    const { PHASES } = await import('/js/config/game-data.js');
    const { state } = window.__ONE_RPG_DEBUG__;
    state.game.phase = PHASES.HERO;
    state.game.player.x = 4;
    state.game.player.y = 5;
    state.game.player.facing = { x: 0, y: -1 };
    state.game.busy = false;
    state.game.animations = [];
    state.debugZoom = 0.98;
    state.visuals.overworldOrthographicCamera = true;
    state.visuals.overworldWater = true;
  });

  async function waitFrames(count = 8) {
    for (let frame = 0; frame < count; frame += 1) {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
  }

  async function findBridgePoint() {
    return page.evaluate(() => {
      const debug = window.__ONE_RPG_DEBUG__;
      const currentLayout = debug.layout.getLayout();

      for (let y = 0; y < currentLayout.sh; y += 6) {
        for (let x = 0; x < currentLayout.sw; x += 6) {
          const point = debug.state.boardInteraction?.worldPointAt?.(currentLayout, x, y);
          if (point?.kind === 'connectionBridge') {
            return { screenX: x, screenY: y, tile: { x: point.x, y: point.y } };
          }
        }
      }

      return null;
    });
  }

  await waitFrames();
  expect(await findBridgePoint()).not.toBeNull();

  await page.evaluate(() => {
    window.__ONE_RPG_DEBUG__.state.visuals.overworldWater = false;
  });
  await waitFrames();
  expect(await findBridgePoint()).toBeNull();

  await page.evaluate(() => {
    window.__ONE_RPG_DEBUG__.state.visuals.overworldWater = true;
  });
  await waitFrames();
  const bridgePoint = await findBridgePoint();

  expect(bridgePoint).not.toBeNull();
  await page.mouse.click(bridgePoint.screenX, bridgePoint.screenY);

  await page.waitForFunction(() => {
    const game = window.__ONE_RPG_DEBUG__.state.game;
    return game.mode === 'overworld' && game.overworld.currentMapId !== 'chao3-start' && !game.busy;
  });

  expect(await page.evaluate(() => window.__ONE_RPG_DEBUG__.state.game.overworld.currentMapId)).not.toBe('chao3-start');
});
