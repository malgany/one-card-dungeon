import { expect, test } from '@playwright/test';

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
  await expect(page.locator('.menu-logo')).toBeVisible();
  const webglCanvas = page.locator('.board-webgl');
  const canvas = page.locator('#game');
  await expect(webglCanvas).toBeVisible();
  await expect(canvas).toBeVisible();

  await expect(page.locator('canvas')).toHaveCount(2);

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

test('opens character creation when no character exists', async ({ page }) => {
  await page.goto('/');

  await page.locator('.menu-home-panel .menu-primary-button').click();
  await expect(page.locator('.menu-screen--create')).toBeVisible();

  await page.getByPlaceholder('Nome do personagem').fill('Aria');
  await page.locator('[data-menu-action="choose-type"][data-type-id="knight"]').click();
  await page.locator('[data-menu-action="choose-color"][data-color="#5f8f54"]').click();
  await page.locator('.menu-create-form .menu-primary-button').click();

  await expect(page.locator('#menu-root')).toBeHidden();
  await page.waitForFunction(() => {
    const player = window.__ONE_RPG_DEBUG__?.state?.game?.player;
    return player?.name === 'Aria' && player?.characterType === 'knight';
  });
});

test('opens character selection when a character exists', async ({ page }) => {
  await page.addInitScript(() => {
    const character = {
      id: 'saved-character',
      name: 'Doran',
      type: 'ranger',
      typeLabel: 'Patrulheiro',
      color: '#d39b32',
      image: '/assets/characters/ranger.png',
      createdAt: Date.now(),
    };
    window.localStorage.setItem('one-rpg-characters-v1', JSON.stringify([character]));
    window.localStorage.setItem('one-rpg-selected-character-v1', character.id);
  });

  await page.goto('/');
  await page.locator('.menu-home-panel .menu-primary-button').click();

  await expect(page.locator('.menu-screen--select')).toBeVisible();
  await expect(page.locator('.menu-character-row', { hasText: 'Doran' })).toBeVisible();
  await page.locator('.menu-actions .menu-primary-button').click();

  await expect(page.locator('#menu-root')).toBeHidden();
  await page.waitForFunction(() => {
    const player = window.__ONE_RPG_DEBUG__?.state?.game?.player;
    return player?.name === 'Doran' && player?.characterType === 'ranger';
  });
});

test('moves from overworld into combat and returns after victory', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ONE_RPG_DEBUG__?.state?.game?.mode === 'overworld');

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
      game.player.x === 0 &&
      game.player.y === 5 &&
      !game.busy
    );
  });
});
